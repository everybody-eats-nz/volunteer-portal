import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/client";
import { requireMobileAdmin } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { listMessages } from "@/lib/services/messaging";

/**
 * GET /api/mobile/admin/messages/threads/[id]
 *
 * Thread detail for the mobile admin conversation screen: the volunteer's
 * contact card, recent messages, and a small upcoming-shift context line.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileAdmin(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const now = new Date();
  const upcomingShiftCount = await prisma.signup.count({
    where: {
      userId: thread.volunteerId,
      status: { in: ["CONFIRMED", "PENDING", "WAITLISTED"] },
      shift: { start: { gte: now } },
    } satisfies Prisma.SignupWhereInput,
  });

  return NextResponse.json({
    thread: {
      id: thread.id,
      status: thread.status,
      lastMessageAt: thread.lastMessageAt,
      volunteer: thread.volunteer,
    },
    messages,
    upcomingShiftCount,
  });
}
