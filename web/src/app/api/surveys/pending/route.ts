import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

// GET /api/surveys/pending - Get pending surveys for current user
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get pending and dismissed assignments (not completed or expired)
    const assignments = await prisma.surveyAssignment.findMany({
      where: {
        userId: user.id,
        status: { in: ["PENDING", "DISMISSED"] },
        survey: { isActive: true },
      },
      include: {
        survey: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
        token: {
          select: {
            token: true,
            expiresAt: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    // Filter out expired tokens and update their status
    const now = new Date();
    const validAssignments = [];

    for (const assignment of assignments) {
      if (assignment.token && assignment.token.expiresAt < now) {
        // Token has expired, update status
        await prisma.surveyAssignment.update({
          where: { id: assignment.id },
          data: { status: "EXPIRED" },
        });
      } else {
        validAssignments.push({
          id: assignment.id,
          status: assignment.status,
          assignedAt: assignment.assignedAt,
          dismissedAt: assignment.dismissedAt,
          survey: assignment.survey,
          token: assignment.token?.token,
          expiresAt: assignment.token?.expiresAt,
        });
      }
    }

    return NextResponse.json(validAssignments);
  } catch (error) {
    console.error("Error fetching pending surveys:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending surveys" },
      { status: 500 }
    );
  }
}
