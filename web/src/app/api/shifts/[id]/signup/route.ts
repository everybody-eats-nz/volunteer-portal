import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { checkAndUnlockAchievements } from "@/lib/achievements";
import { getNotificationService } from "@/lib/notification-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const shift = await prisma.shift.findUnique({
    where: { id },
    include: { signups: true },
  });
  if (!shift)
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });

  let confirmedCount = 0;
  for (const signup of shift.signups) {
    if (signup.status === "CONFIRMED") confirmedCount += 1;
  }

  // Read optional waitlist flag from form body
  let waitlistRequested = false;
  try {
    const form = await req.formData();
    const val = form.get("waitlist");
    waitlistRequested = val === "1" || val === "true" || val === "on";
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

  // Check if user already has a confirmed signup for the same day
  const shiftDate = new Date(shift.start);
  const startOfDay = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  
  const existingDailySignup = await prisma.signup.findFirst({
    where: {
      userId: user.id,
      status: "CONFIRMED",
      shift: {
        start: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    },
    include: {
      shift: {
        include: {
          shiftType: true,
        },
      },
    },
  });
  
  if (existingDailySignup) {
    const existingShiftTime = new Intl.DateTimeFormat('en-NZ', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(existingDailySignup.shift.start);
    
    return NextResponse.json(
      { 
        error: `You already have a confirmed shift on this day: ${existingDailySignup.shift.shiftType.name} at ${existingShiftTime}. You can only sign up for one shift per day.`
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
      data: { userId: user.id, shiftId: shift.id, status: "WAITLISTED" },
    });

    // Check for new achievements after successful signup
    try {
      await checkAndUnlockAchievements(user.id);
    } catch (achievementError) {
      // Don't fail the signup if achievement checking fails
      console.error("Error checking achievements:", achievementError);
    }

    return NextResponse.json(signup);
  }

  // Spots available → create pending signup that requires admin approval
  try {
    const signup = await prisma.signup.create({
      data: { userId: user.id, shiftId: shift.id, status: "PENDING" },
    });

    // Check for new achievements after successful signup
    try {
      await checkAndUnlockAchievements(user.id);
    } catch (achievementError) {
      // Don't fail the signup if achievement checking fails
      console.error("Error checking achievements:", achievementError);
    }

    return NextResponse.json(signup);
  } catch {
    return NextResponse.json({ error: "Already signed up?" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
      console.log(`[DELETE] Signup not found for user ${user.id} and shift ${shiftId}`);
      return NextResponse.json({ error: "Signup not found" }, { status: 404 });
    }

    console.log(`[DELETE] Found signup ${existingSignup.id} with status ${existingSignup.status}`);

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
    const updateData: { status: "CANCELED"; canceledAt?: Date; previousStatus?: string } = { status: "CANCELED" };
    
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
    notificationService.notifyManagersOfShiftCancellation({
      shift: existingSignup.shift,
      volunteer: user,
      canceledSignup,
    }).catch((error) => {
      console.error("[DELETE] Failed to send manager notifications:", error);
      // Continue - don't fail the cancellation due to notification errors
    });

    return NextResponse.json(canceledSignup);
  } catch (error) {
    console.error("[DELETE] Error in shift cancellation:", error);
    return NextResponse.json(
      { 
        error: "Failed to cancel shift signup",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
