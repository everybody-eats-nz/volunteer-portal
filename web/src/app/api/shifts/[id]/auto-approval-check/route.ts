import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkAutoApprovalEligibility } from "@/lib/auto-accept-rules";

// GET /api/shifts/[id]/auto-approval-check - Check if user is eligible for auto-approval
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id: shiftId } = await params;

  try {
    // Check if shift exists
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: { id: true },
    });

    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    // Check if user is already signed up
    const existingSignup = await prisma.signup.findUnique({
      where: { userId_shiftId: { userId: user.id, shiftId } },
    });

    if (existingSignup) {
      return NextResponse.json({
        eligible: false,
        reason: "Already signed up",
        alreadySignedUp: true,
      });
    }

    // Check auto-approval eligibility
    const eligibility = await checkAutoApprovalEligibility(user.id, shiftId);

    return NextResponse.json(eligibility);
  } catch (error) {
    console.error("Error checking auto-approval eligibility:", error);
    return NextResponse.json(
      { eligible: false, reason: "Error checking eligibility" },
      { status: 500 }
    );
  }
}