import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { checkAutoApprovalEligibility } from "@/lib/auto-approval";
import { getApplicationLimitStatus } from "@/lib/application-limit.server";

/**
 * GET /api/mobile/shifts/[id]/auto-approval-check
 *
 * Check if the authenticated mobile user is eligible for auto-approval
 * on a given shift. Used by the signup sheet to show "Instant Signup" UI.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;
  const { id: shiftId } = await params;

  try {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: { id: true },
    });

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    // Check if user is already signed up
    const existingSignup = await prisma.signup.findUnique({
      where: { userId_shiftId: { userId, shiftId } },
    });

    if (existingSignup) {
      return NextResponse.json({
        eligible: false,
        reason: "Already signed up",
      });
    }

    const eligibility = await checkAutoApprovalEligibility(userId, shiftId);

    // Where the volunteer stands against the cap on open applications, so the
    // signup UI can say so up front instead of failing on confirm.
    const applicationLimit = await getApplicationLimitStatus(
      userId,
      shiftId,
      eligibility.eligible
    );

    return NextResponse.json({ ...eligibility, applicationLimit });
  } catch (error) {
    console.error("Error checking auto-approval eligibility:", error);
    return NextResponse.json(
      { eligible: false, reason: "Error checking eligibility" },
      { status: 500 }
    );
  }
}
