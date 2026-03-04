import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET endpoint to retrieve a survey by ID
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get("surveyId");

    if (!surveyId) {
      return NextResponse.json(
        { error: "surveyId required" },
        { status: 400 }
      );
    }

    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        assignments: {
          include: {
            token: true,
            response: true,
          },
        },
      },
    });

    if (!survey) {
      return NextResponse.json(
        { error: "Survey not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(survey);
  } catch (error) {
    console.error("Error getting survey:", error);
    return NextResponse.json(
      { error: "Failed to get survey" },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint to create a test survey
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const {
      title,
      description,
      questions,
      triggerType = "MANUAL",
      triggerValue = 0,
      triggerMaxValue,
      isActive = true,
      createdBy,
    } = body;

    if (!title || !questions || !createdBy) {
      return NextResponse.json(
        { error: "title, questions, and createdBy are required" },
        { status: 400 }
      );
    }

    const survey = await prisma.survey.create({
      data: {
        title,
        description,
        questions,
        triggerType,
        triggerValue,
        triggerMaxValue,
        isActive,
        createdBy,
      },
    });

    return NextResponse.json({ id: survey.id });
  } catch (error) {
    console.error("Error creating test survey:", error);
    return NextResponse.json(
      { error: "Failed to create survey" },
      { status: 500 }
    );
  }
}

/**
 * DELETE endpoint to clean up test surveys
 */
export async function DELETE(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get("surveyId");

    if (!surveyId) {
      return NextResponse.json(
        { error: "surveyId required" },
        { status: 400 }
      );
    }

    // Delete in correct order: responses → tokens → assignments → survey
    const assignments = await prisma.surveyAssignment.findMany({
      where: { surveyId },
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
        where: { surveyId },
      });
    }

    await prisma.survey.delete({
      where: { id: surveyId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting test survey:", error);
    return NextResponse.json(
      { error: "Failed to delete survey" },
      { status: 500 }
    );
  }
}
