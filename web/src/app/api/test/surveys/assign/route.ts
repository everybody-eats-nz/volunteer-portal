import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * POST endpoint to assign a survey to a user (creates assignment + token)
 * Does NOT send emails — for test use only
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { surveyId, userId, status = "PENDING", expiresAt } = body;

    if (!surveyId || !userId) {
      return NextResponse.json(
        { error: "surveyId and userId are required" },
        { status: 400 }
      );
    }

    // Create assignment
    const assignment = await prisma.surveyAssignment.create({
      data: {
        surveyId,
        userId,
        status,
        completedAt: status === "COMPLETED" ? new Date() : undefined,
      },
    });

    // Create token
    const token = randomBytes(32).toString("hex");
    await prisma.surveyToken.create({
      data: {
        token,
        assignmentId: assignment.id,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      },
    });

    return NextResponse.json({
      assignmentId: assignment.id,
      token,
    });
  } catch (error) {
    console.error("Error assigning test survey:", error);
    return NextResponse.json(
      { error: "Failed to assign survey" },
      { status: 500 }
    );
  }
}

/**
 * DELETE endpoint to clean up survey assignments
 */
export async function DELETE(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get("surveyId");
    const userId = searchParams.get("userId");

    const where: Record<string, string> = {};
    if (surveyId) where.surveyId = surveyId;
    if (userId) where.userId = userId;

    if (Object.keys(where).length === 0) {
      return NextResponse.json(
        { error: "surveyId or userId required" },
        { status: 400 }
      );
    }

    const assignments = await prisma.surveyAssignment.findMany({
      where,
      select: { id: true },
    });

    const assignmentIds = assignments.map((a) => a.id);

    if (assignmentIds.length > 0) {
      await prisma.surveyResponse.deleteMany({
        where: { assignmentId: { in: assignmentIds } },
      });
      await prisma.surveyToken.deleteMany({
        where: { assignmentId: { in: assignmentIds } },
      });
      await prisma.surveyAssignment.deleteMany({
        where: { id: { in: assignmentIds } },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting survey assignments:", error);
    return NextResponse.json(
      { error: "Failed to delete assignments" },
      { status: 500 }
    );
  }
}
