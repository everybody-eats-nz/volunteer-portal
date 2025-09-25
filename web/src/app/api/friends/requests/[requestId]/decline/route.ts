import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const { requestId } = await params;

    // Find the friend request
    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: {
        fromUser: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!friendRequest) {
      return NextResponse.json(
        { error: "Friend request not found" },
        { status: 404 }
      );
    }

    // Verify this request is for the current user
    if (friendRequest.toEmail !== user.email) {
      return NextResponse.json(
        { error: "Unauthorized to decline this request" },
        { status: 403 }
      );
    }

    // Check if request is still pending
    if (friendRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: "Friend request is no longer pending" },
        { status: 400 }
      );
    }

    // Update friend request status to declined
    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: "DECLINED" },
    });

    // TODO: Send notification to the requester about decline
    // This would integrate with your notification service

    return NextResponse.json({
      message: "Friend request declined",
    });
  } catch (error) {
    console.error("Error declining friend request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}