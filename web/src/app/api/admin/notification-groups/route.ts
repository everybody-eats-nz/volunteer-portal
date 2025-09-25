import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const groups = await prisma.notificationGroup.findMany({
      where: {
        isActive: true,
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const groupsWithCount = groups.map(group => ({
      ...group,
      memberCount: group._count.members,
    }));

    return NextResponse.json(groupsWithCount);
  } catch (error) {
    console.error("Error fetching notification groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification groups" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, description, filters, memberIds } = body;

    // Create the notification group
    const group = await prisma.notificationGroup.create({
      data: {
        name,
        description,
        filters,
        createdBy: session.user.id,
        members: {
          create: memberIds.map((userId: string) => ({
            userId,
          })),
        },
      },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    return NextResponse.json({
      ...group,
      memberCount: group._count.members,
    });
  } catch (error) {
    console.error("Error creating notification group:", error);
    return NextResponse.json(
      { error: "Failed to create notification group" },
      { status: 500 }
    );
  }
}