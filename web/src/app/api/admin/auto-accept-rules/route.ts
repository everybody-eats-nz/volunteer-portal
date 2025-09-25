import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { z } from "zod";

// Validation schema for creating/updating rules
const ruleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).default(0),
  global: z.boolean().default(false),
  shiftTypeId: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  minVolunteerGrade: z.enum(["GREEN", "YELLOW", "PINK"]).optional().nullable(),
  minCompletedShifts: z.number().int().min(0).optional().nullable(),
  minAttendanceRate: z.number().min(0).max(100).optional().nullable(),
  minAccountAgeDays: z.number().int().min(0).optional().nullable(),
  maxDaysInAdvance: z.number().int().min(0).optional().nullable(),
  requireShiftTypeExperience: z.boolean().default(false),
  criteriaLogic: z.enum(["AND", "OR"]).default("AND"),
  stopOnMatch: z.boolean().default(true),
});

// GET /api/admin/auto-accept-rules - List all rules
export async function GET() {
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

  try {
    const rules = await prisma.autoAcceptRule.findMany({
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
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error("Error fetching auto-accept rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch rules" },
      { status: 500 }
    );
  }
}

// POST /api/admin/auto-accept-rules - Create new rule
export async function POST(req: Request) {
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

  try {
    const body = await req.json();
    const validatedData = ruleSchema.parse(body);

    // Validate that either global is true or shiftTypeId is provided
    if (!validatedData.global && !validatedData.shiftTypeId) {
      return NextResponse.json(
        { error: "Rule must be either global or have a specific shift type" },
        { status: 400 }
      );
    }

    // If shift type is specified, verify it exists
    if (validatedData.shiftTypeId) {
      const shiftType = await prisma.shiftType.findUnique({
        where: { id: validatedData.shiftTypeId },
      });
      if (!shiftType) {
        return NextResponse.json(
          { error: "Invalid shift type" },
          { status: 400 }
        );
      }
    }

    // Ensure at least one criterion is set
    const hasCriteria = 
      validatedData.minVolunteerGrade !== null ||
      validatedData.minCompletedShifts !== null ||
      validatedData.minAttendanceRate !== null ||
      validatedData.minAccountAgeDays !== null ||
      validatedData.maxDaysInAdvance !== null ||
      validatedData.requireShiftTypeExperience;

    if (!hasCriteria) {
      return NextResponse.json(
        { error: "At least one criterion must be set" },
        { status: 400 }
      );
    }

    const rule = await prisma.autoAcceptRule.create({
      data: {
        ...validatedData,
        createdBy: user.id,
      },
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
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error creating auto-accept rule:", error);
    return NextResponse.json(
      { error: "Failed to create rule" },
      { status: 500 }
    );
  }
}