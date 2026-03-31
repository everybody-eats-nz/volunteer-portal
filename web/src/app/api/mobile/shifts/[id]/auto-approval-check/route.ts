import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { checkAutoApprovalEligibility } from "@/lib/auto-accept-rules";

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
    return NextResponse.json(eligibility);
  } catch (error) {
    console.error("Error checking auto-approval eligibility:", error);
    return NextResponse.json(
      { eligible: false, reason: "Error checking eligibility" },
      { status: 500 }
    );
  }
}
