import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getNotificationService } from "@/lib/notification-service";
import { processAutoApproval } from "@/lib/auto-accept-rules";
import { checkForBot } from "@/lib/bot-protection";
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { MAX_NOTE_LENGTH, GUARDIAN_REQUIRED_AGE, calculateAge } from "@/lib/utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check for bot traffic first
  const botResponse = await checkForBot(
    "Shift signup blocked due to automated activity detection."
  );
  if (botResponse) {
    return botResponse;
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      requiresParentalConsent: true,
      parentalConsentReceived: true,
      firstName: true,
      lastName: true,
      role: true,
      dateOfBirth: true,
    },
  });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // Check parental consent for minors
  if (user.requiresParentalConsent && !user.parentalConsentReceived) {
    return NextResponse.json(
      {
        error: "Parental consent required",
        message:
          "Since you are under 16, we need parental consent before you can sign up for shifts. Please ensure your parent/guardian has submitted the signed consent form to our team.",
      },
      { status: 403 }
    );
  }

  const { id } = await params;

  const shift = await prisma.shift.findUnique({
    where: { id },
    include: {
      signups: true,
      shiftType: true,
    },
  });
  if (!shift)
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });

  let confirmedCount = 0;
  for (const signup of shift.signups) {
    if (signup.status === "CONFIRMED") confirmedCount += 1;
  }

  // Read optional waitlist flag and note from form body
  let waitlistRequested = false;
  let note: string | null = null;
  try {
    const form = await req.formData();
    const val = form.get("waitlist");
    waitlistRequested = val === "1" || val === "true" || val === "on";

    // Get optional note
    const noteValue = form.get("note");
    if (noteValue && typeof noteValue === "string") {
      const trimmedNote = noteValue.trim();

      // Add length validation
      if (trimmedNote.length > MAX_NOTE_LENGTH) {
        return NextResponse.json(
          { error: "Note too long" },
          { status: 400 }
        );
      }

      // Add input sanitization using DOMPurify
      if (trimmedNote) {
        const window = new JSDOM('').window;
        const purify = DOMPurify(window);
        note = purify.sanitize(trimmedNote) || null;
      } else {
        note = null;
      }

      // Add server-side age validation for guardian requirement
      if (user.dateOfBirth) {
        const userAge = calculateAge(user.dateOfBirth);
        if (userAge <= GUARDIAN_REQUIRED_AGE && note && !note.toLowerCase().includes('guardian')) {
          return NextResponse.json(
            {
              error: "Guardian name required",
              message: "Since you are under 15, please include your guardian's name in the note."
            },
            { status: 400 }
          );
        }
      }
    }
  } catch {
    // ignore body parse errors for non-form requests
  }

  // Check if user already has a signup for this shift
  const existing = await prisma.signup.findUnique({
    where: { userId_shiftId: { userId: user.id, shiftId: shift.id } },
  });
  if (existing) {
    // If the existing signup was canceled, delete it and allow re-signup
    if (existing.status === "CANCELED") {
      await prisma.signup.delete({
        where: { id: existing.id },
      });
    } else {
      return NextResponse.json(
        { error: `Already ${existing.status.toLowerCase()}` },
        { status: 400 }
      );
    }
  }

  // Check if user already has a confirmed signup for the same day (in NZ timezone)
  // Get the calendar date of this shift in NZ timezone
  const shiftNZDate = new Intl.DateTimeFormat("en-NZ", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Pacific/Auckland",
  }).format(shift.start);

  // Get all confirmed signups for this user
  const confirmedSignups = await prisma.signup.findMany({
    where: {
      userId: user.id,
      status: "CONFIRMED",
    },
    include: {
      shift: {
        include: {
          shiftType: true,
        },
      },
    },
  });

  // Check if any of them are on the same NZ calendar day
  const existingDailySignup = confirmedSignups.find((signup) => {
    const signupNZDate = new Intl.DateTimeFormat("en-NZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Pacific/Auckland",
    }).format(signup.shift.start);
    return signupNZDate === shiftNZDate;
  });

  if (existingDailySignup) {
    const existingShiftTime = new Intl.DateTimeFormat("en-NZ", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Pacific/Auckland",
    }).format(existingDailySignup.shift.start);

    const location = existingDailySignup.shift.location;

    return NextResponse.json(
      {
        error: `You already have a confirmed shift on this day: ${existingDailySignup.shift.shiftType.name} at ${location}, ${existingShiftTime}. You can only sign up for one shift per day.`,
      },
      { status: 400 }
    );
  }

  if (confirmedCount >= shift.capacity) {
    if (!waitlistRequested) {
      return NextResponse.json(
        { error: "Shift is full; waitlist available" },
        { status: 400 }
      );
    }
    const signup = await prisma.signup.create({
      data: {
        userId: user.id,
        shiftId: shift.id,
        status: "WAITLISTED",
        note: note,
      },
    });

    // Achievements will be calculated when user visits dashboard/achievements page

    return NextResponse.json(signup);
  }

  // Spots available → create pending signup that might be auto-approved
  try {
    const signup = await prisma.signup.create({
      data: {
        userId: user.id,
        shiftId: shift.id,
        status: "PENDING",
        note: note,
      },
    });

    // Check for auto-approval
    const autoApprovalResult = await processAutoApproval(
      signup.id,
      user.id,
      shift.id
    );

    // Achievements will be calculated when user visits dashboard/achievements page

    // Return signup with updated status and auto-approval flag
    // Use the signup object we already have and update its status based on auto-approval result
    return NextResponse.json({
      ...signup,
      status: autoApprovalResult.status,
      autoApproved: autoApprovalResult.autoApproved,
    });
  } catch {
    return NextResponse.json({ error: "Already signed up?" }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("[DELETE] Starting shift cancellation");

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.log("[DELETE] No session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      console.log("[DELETE] User not found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: shiftId } = await params;
    console.log(`[DELETE] Canceling shift ${shiftId} for user ${user.email}`);

    // Find the existing signup with full shift details for notifications
    const existingSignup = await prisma.signup.findUnique({
      where: { userId_shiftId: { userId: user.id, shiftId } },
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
      console.log(
        `[DELETE] Signup not found for user ${user.id} and shift ${shiftId}`
      );
      return NextResponse.json({ error: "Signup not found" }, { status: 404 });
    }

    console.log(
      `[DELETE] Found signup ${existingSignup.id} with status ${existingSignup.status}`
    );

    // Don't allow canceling past shifts
    const now = new Date();
    if (existingSignup.shift.end < now) {
      console.log("[DELETE] Attempted to cancel past shift");
      return NextResponse.json(
        { error: "Cannot cancel past shifts" },
        { status: 400 }
      );
    }

    // Don't allow canceling already canceled signups
    if (existingSignup.status === "CANCELED") {
      console.log("[DELETE] Signup is already canceled");
      return NextResponse.json(
        { error: "Signup is already canceled" },
        { status: 400 }
      );
    }

    // Update the signup status to CANCELED
    // Track cancellation details only if canceling from CONFIRMED status
    console.log(`[DELETE] Updating signup ${existingSignup.id} to CANCELED`);
    const updateData: {
      status: "CANCELED";
      canceledAt?: Date;
      previousStatus?: string;
    } = { status: "CANCELED" };

    // Only track cancellation details for CONFIRMED cancellations
    if (existingSignup.status === "CONFIRMED") {
      console.log(`[DELETE] Tracking CONFIRMED cancellation for reporting`);
      updateData.canceledAt = new Date();
      updateData.previousStatus = existingSignup.status;
      // Could add cancellationReason if we collect it from user in future
    }

    const canceledSignup = await prisma.signup.update({
      where: { id: existingSignup.id },
      data: updateData,
    });

    console.log(`[DELETE] Successfully canceled signup ${canceledSignup.id}`);

    // Notify restaurant managers of the cancellation (async - don't await)
    // This won't block the cancellation response even if notifications fail
    const notificationService = getNotificationService();
    notificationService
      .notifyManagersOfShiftCancellation({
        shift: existingSignup.shift,
        volunteer: user,
        canceledSignup,
      })
      .catch((error) => {
        console.error("[DELETE] Failed to send manager notifications:", error);
        // Continue - don't fail the cancellation due to notification errors
      });

    return NextResponse.json(canceledSignup);
  } catch (error) {
    console.error("[DELETE] Error in shift cancellation:", error);
    return NextResponse.json(
      {
        error: "Failed to cancel shift signup",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
