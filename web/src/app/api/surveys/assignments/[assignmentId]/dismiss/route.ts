import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ assignmentId: string }>;
}

// POST /api/surveys/assignments/[assignmentId]/dismiss - Dismiss a survey (authenticated)
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { assignmentId } = await params;

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the assignment
    const assignment = await prisma.surveyAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        token: {
          select: {
            expiresAt: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Survey assignment not found" },
        { status: 404 }
      );
    }

    // Verify the assignment belongs to the user
    if (assignment.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Can only dismiss pending surveys
    if (assignment.status !== "PENDING") {
      return NextResponse.json(
        { error: "Survey cannot be dismissed in current state" },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (assignment.token && assignment.token.expiresAt < new Date()) {
      // Update to expired instead
      await prisma.surveyAssignment.update({
        where: { id: assignmentId },
        data: { status: "EXPIRED" },
      });

      return NextResponse.json(
        { error: "Survey has expired and cannot be dismissed" },
        { status: 410 }
      );
    }

    // Dismiss the survey
    await prisma.surveyAssignment.update({
      where: { id: assignmentId },
      data: {
        status: "DISMISSED",
        dismissedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Survey dismissed. You can still access it via the email link.",
    });
  } catch (error) {
    console.error("Error dismissing survey:", error);
    return NextResponse.json(
      { error: "Failed to dismiss survey" },
      { status: 500 }
    );
  }
}
