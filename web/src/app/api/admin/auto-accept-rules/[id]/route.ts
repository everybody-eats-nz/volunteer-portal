import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { z } from "zod";

// Validation schema for updating rules
const updateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
  global: z.boolean().optional(),
  shiftTypeId: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  minVolunteerGrade: z.enum(["GREEN", "YELLOW", "PINK"]).optional().nullable(),
  minCompletedShifts: z.number().int().min(0).optional().nullable(),
  minAttendanceRate: z.number().min(0).max(100).optional().nullable(),
  minAccountAgeDays: z.number().int().min(0).optional().nullable(),
  maxDaysInAdvance: z.number().int().min(0).optional().nullable(),
  requireShiftTypeExperience: z.boolean().optional(),
  criteriaLogic: z.enum(["AND", "OR"]).optional(),
  stopOnMatch: z.boolean().optional(),
});

// GET /api/admin/auto-accept-rules/[id] - Get single rule
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

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const rule = await prisma.autoAcceptRule.findUnique({
      where: { id },
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

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error("Error fetching auto-accept rule:", error);
    return NextResponse.json(
      { error: "Failed to fetch rule" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/auto-accept-rules/[id] - Update rule
export async function PATCH(
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
    const body = await req.json();
    const validatedData = updateRuleSchema.parse(body);

    // Check if rule exists
    const existingRule = await prisma.autoAcceptRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    // If updating global/shiftTypeId, validate
    const isGlobal = validatedData.global ?? existingRule.global;
    const shiftTypeId = validatedData.shiftTypeId ?? existingRule.shiftTypeId;

    if (!isGlobal && !shiftTypeId) {
      return NextResponse.json(
        { error: "Rule must be either global or have a specific shift type" },
        { status: 400 }
      );
    }

    // If shift type is specified, verify it exists
    if (shiftTypeId && validatedData.shiftTypeId !== undefined) {
      const shiftType = await prisma.shiftType.findUnique({
        where: { id: shiftTypeId },
      });
      if (!shiftType) {
        return NextResponse.json(
          { error: "Invalid shift type" },
          { status: 400 }
        );
      }
    }

    const updatedRule = await prisma.autoAcceptRule.update({
      where: { id },
      data: validatedData,
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

    return NextResponse.json(updatedRule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error updating auto-accept rule:", error);
    return NextResponse.json(
      { error: "Failed to update rule" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/auto-accept-rules/[id] - Delete rule
export async function DELETE(
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
    // Check if rule exists
    const existingRule = await prisma.autoAcceptRule.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            approvals: true,
          },
        },
      },
    });

    if (!existingRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    // Warn if rule has been used
    if (existingRule._count.approvals > 0) {
      // We'll delete it anyway but return a warning
      await prisma.autoAcceptRule.delete({
        where: { id },
      });

      return NextResponse.json({
        message: "Rule deleted successfully",
        warning: `This rule had been used for ${existingRule._count.approvals} approvals. Historical records are preserved.`,
      });
    }

    await prisma.autoAcceptRule.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Rule deleted successfully" });
  } catch (error) {
    console.error("Error deleting auto-accept rule:", error);
    return NextResponse.json(
      { error: "Failed to delete rule" },
      { status: 500 }
    );
  }
}