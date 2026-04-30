import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { listMessages } from "@/lib/services/messaging";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(req.url);
  const before = url.searchParams.get("before");
  const limit = Number(url.searchParams.get("limit") ?? 50);

  const thread = await prisma.messageThread.findUnique({
    where: { id },
    include: {
      volunteer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          name: true,
          email: true,
          phone: true,
          profilePhotoUrl: true,
          defaultLocation: true,
          volunteerGrade: true,
          createdAt: true,
        },
      },
    },
  });
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const messages = await listMessages({
    threadId: id,
    before: before ? new Date(before) : undefined,
    limit,
  });

  // Count of upcoming shifts for the volunteer-context sidebar.
  const upcomingShiftCount = await prisma.signup.count({
    where: {
      userId: thread.volunteerId,
      status: { in: ["CONFIRMED", "PENDING", "WAITLISTED"] },
      shift: { start: { gte: new Date() } },
    },
  });

  return NextResponse.json({ thread, messages, upcomingShiftCount });
}
