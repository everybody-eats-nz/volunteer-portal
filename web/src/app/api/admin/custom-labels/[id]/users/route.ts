import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// List every volunteer assigned a given custom label.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;

    const label = await prisma.customLabel.findUnique({
      where: { id },
      select: { id: true, name: true, color: true, icon: true },
    });

    if (!label) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }

    const assignments = await prisma.userCustomLabel.findMany({
      where: { labelId: id },
      orderBy: { assignedAt: "desc" },
      select: {
        assignedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            profilePhotoUrl: true,
            volunteerGrade: true,
          },
        },
      },
    });

    const members = assignments.map((a) => ({
      ...a.user,
      assignedAt: a.assignedAt,
    }));

    return NextResponse.json({ label, members });
  } catch (error) {
    console.error("Error fetching label members:", error);
    return NextResponse.json(
      { error: "Failed to fetch label members" },
      { status: 500 }
    );
  }
}
