import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { processAutoApproval } from "@/lib/auto-accept-rules";
import { isAMShift, getShiftDate } from "@/lib/concurrent-shifts";
import { getNotificationService } from "@/lib/notification-service";
import { getShiftConfirmedCount } from "@/lib/placeholder-utils";

/**
 * POST /api/mobile/shifts/[id]/signup
 *
 * Signs the authenticated mobile user up for a shift.
 * Reuses the same business logic as the web signup endpoint:
 * - Email verification check
 * - Parental consent check
 * - Duplicate signup prevention (re-signup allowed from CANCELED)
 * - Concurrent shift conflict detection (max 1 AM + 1 PM per day)
 * - Capacity check with optional waitlist
 * - Auto-approval processing
 *
 * Body (JSON): { waitlist?: boolean }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;
  const { id: shiftId } = await params;

  // Fetch the full user record for validation checks
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      profileCompleted: true,
      requiresParentalConsent: true,
      parentalConsentReceived: true,
      dateOfBirth: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check email verification
  if (!user.emailVerified) {
    return NextResponse.json(
      {
        error: "Email verification required",
        message:
          "Please verify your email address before signing up for shifts. Check your inbox for a verification email.",
      },
      { status: 403 }
    );
  }

  // Mirror the web gate: a complete profile is required before signing up.
  if (!user.profileCompleted) {
    return NextResponse.json(
      {
        error: "Profile incomplete",
        message:
          "Please complete your profile before signing up for shifts. Visit your profile to fill in the remaining required fields.",
      },
      { status: 403 }
    );
  }

  // Check parental consent for minors
  if (user.requiresParentalConsent && !user.parentalConsentReceived) {
    return NextResponse.json(
      {
        error: "Parental consent required",
        message:
          "Since you are under 16, we need parental consent before you can sign up for shifts.",
      },
      { status: 403 }
    );
  }

  // Fetch the shift
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      signups: true,
      shiftType: true,
      _count: {
        select: { placeholders: true },
      },
    },
  });

  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  // Parse optional body
  let waitlistRequested = false;
  let note: string | null = null;
  let backupShiftIds: string[] = [];
  try {
    const body = await request.json();
    waitlistRequested = body.waitlist === true;
    if (typeof body.note === "string" && body.note.trim()) {
      note = body.note.trim().slice(0, 500); // Enforce max length
    }
    if (Array.isArray(body.backupShiftIds)) {
      backupShiftIds = body.backupShiftIds.filter(
        (id: unknown) => typeof id === "string"
      );
    }
  } catch {
    // No body or invalid JSON — defaults are fine
  }

  // Count confirmed signups + unregistered volunteers
  const confirmedCount = getShiftConfirmedCount(shift);

  // Check for existing signup on this shift
  const existing = await prisma.signup.findUnique({
    where: { userId_shiftId: { userId: user.id, shiftId: shift.id } },
  });

  if (existing) {
    if (existing.status === "CANCELED") {
      // Allow re-signup — delete the canceled record
      await prisma.signup.delete({ where: { id: existing.id } });
    } else {
      return NextResponse.json(
        { error: `Already ${existing.status.toLowerCase()}` },
        { status: 400 }
      );
    }
  }

  // Check for concurrent shift conflicts (same date + same AM/PM period)
  const shiftDate = getShiftDate(shift.start);
  const shiftIsAM = isAMShift(shift.start);

  const existingSignups = await prisma.signup.findMany({
    where: {
      userId: user.id,
      status: { in: ["CONFIRMED", "PENDING"] },
    },
    include: {
      shift: { include: { shiftType: true } },
    },
  });

  const conflictingSignup = existingSignups.find((signup) => {
    const signupDate = getShiftDate(signup.shift.start);
    const signupIsAM = isAMShift(signup.shift.start);
    return signupDate === shiftDate && signupIsAM === shiftIsAM;
  });

  if (conflictingSignup) {
    const existingShiftTime = new Intl.DateTimeFormat("en-NZ", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Pacific/Auckland",
    }).format(conflictingSignup.shift.start);

    const location = conflictingSignup.shift.location;
    const period = shiftIsAM ? "AM" : "PM";

    return NextResponse.json(
      {
        error: `You already have a ${period} shift on this day: ${conflictingSignup.shift.shiftType.name} at ${location}, ${existingShiftTime}. One AM and one PM shift per day.`,
      },
      { status: 400 }
    );
  }

  // Capacity check
  if (confirmedCount >= shift.capacity) {
    if (!waitlistRequested) {
      return NextResponse.json(
        { error: "Shift is full", waitlistAvailable: true },
        { status: 400 }
      );
    }

    // Create waitlisted signup
    const signup = await prisma.signup.create({
      data: {
        userId: user.id,
        shiftId: shift.id,
        status: "WAITLISTED",
        note,
        backupForShiftIds: backupShiftIds,
      },
    });

    return NextResponse.json({
      id: signup.id,
      status: "WAITLISTED",
      autoApproved: false,
    });
  }

  // Spots available — create pending signup (may be auto-approved)
  try {
    const signup = await prisma.signup.create({
      data: {
        userId: user.id,
        shiftId: shift.id,
        status: "PENDING",
        note,
        backupForShiftIds: backupShiftIds,
      },
    });

    // Process auto-approval
    const autoApprovalResult = await processAutoApproval(
      signup.id,
      user.id,
      shift.id
    );

    return NextResponse.json({
      id: signup.id,
      status: autoApprovalResult.status,
      autoApproved: autoApprovalResult.autoApproved,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to sign up. Please try again." },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/mobile/shifts/[id]/signup
 *
 * Cancels the authenticated mobile user's signup for a shift.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;
  const { id: shiftId } = await params;

  // Find the existing signup
  const existingSignup = await prisma.signup.findUnique({
    where: { userId_shiftId: { userId, shiftId } },
    include: {
      shift: {
        include: {
          shiftType: true,
          signups: true,
        },
      },
    },
  });

  if (!existingSignup) {
    return NextResponse.json({ error: "Signup not found" }, { status: 404 });
  }

  // Don't allow canceling past shifts
  if (existingSignup.shift.end < new Date()) {
    return NextResponse.json(
      { error: "Cannot cancel past shifts" },
      { status: 400 }
    );
  }

  // Don't allow canceling already canceled signups
  if (existingSignup.status === "CANCELED") {
    return NextResponse.json(
      { error: "Signup is already canceled" },
      { status: 400 }
    );
  }

  // Track cancellation details for CONFIRMED cancellations
  const updateData: {
    status: "CANCELED";
    canceledAt?: Date;
    previousStatus?: string;
  } = { status: "CANCELED" };

  if (existingSignup.status === "CONFIRMED") {
    updateData.canceledAt = new Date();
    updateData.previousStatus = existingSignup.status;
  }

  const canceledSignup = await prisma.signup.update({
    where: { id: existingSignup.id },
    data: updateData,
  });

  // Fetch the user for notification
  const user = await prisma.user.findUnique({ where: { id: userId } });

  // Notify managers asynchronously
  if (user) {
    const notificationService = getNotificationService();
    notificationService
      .notifyManagersOfShiftCancellation({
        shift: existingSignup.shift,
        volunteer: user,
        canceledSignup,
      })
      .catch((error) => {
        console.error(
          "[mobile/signup DELETE] Failed to send manager notifications:",
          error
        );
      });
  }

  return NextResponse.json({
    id: canceledSignup.id,
    status: canceledSignup.status,
  });
}
