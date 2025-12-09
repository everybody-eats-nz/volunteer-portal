import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Test-only endpoint for managing notifications
 * Only available in development/test environments
 */

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { userId, type, title, message, shiftId } = body;

    const data: any = {
      userId,
      type,
      title,
      message,
    };

    if (shiftId) {
      data.shiftId = shiftId;
    }

    const notification = await prisma.notification.create({ data });

    return NextResponse.json(notification);
  } catch (error) {
    console.error("Error creating notification:", error);
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const type = searchParams.get("type");

    const where: any = {};
    if (userId) where.userId = userId;
    if (type) where.type = type;

    await prisma.notification.deleteMany({ where });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting notifications:", error);
    return NextResponse.json(
      { error: "Failed to delete notifications" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const type = searchParams.get("type");

    const where: any = {};
    if (userId) where.userId = userId;
    if (type) where.type = type;

    const notifications = await prisma.notification.findMany({ where });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Error getting notifications:", error);
    return NextResponse.json(
      { error: "Failed to get notifications" },
      { status: 500 }
    );
  }
}
