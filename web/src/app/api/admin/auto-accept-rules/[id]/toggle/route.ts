import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// POST /api/admin/auto-accept-rules/[id]/toggle - Toggle rule enabled/disabled
export async function POST(
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

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    // Get current rule state
    const rule = await prisma.autoAcceptRule.findUnique({
      where: { id },
      select: { enabled: true },
    });

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    // Toggle the enabled state
    const updatedRule = await prisma.autoAcceptRule.update({
      where: { id },
      data: { enabled: !rule.enabled },
      include: {
        shiftType: {
          select: {
            id: true,
            name: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            approvals: true,
          },
        },
      },
    });

    return NextResponse.json({
      rule: updatedRule,
      message: updatedRule.enabled ? "Rule enabled" : "Rule disabled",
    });
  } catch (error) {
    console.error("Error toggling auto-accept rule:", error);
    return NextResponse.json(
      { error: "Failed to toggle rule" },
      { status: 500 }
    );
  }
}