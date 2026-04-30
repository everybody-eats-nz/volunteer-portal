import { NextResponse } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import {
  getOrCreateThreadForVolunteer,
  isUnreadForVolunteer,
  listMessages,
  MessagingError,
} from "@/lib/services/messaging";
import {
  evaluateOpenStatus,
  getHoursForLocation,
  getPrimaryLocationForVolunteer,
} from "@/lib/services/messaging-hours";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/mobile/messages/thread
 *
 * Returns the volunteer's team thread + recent messages + an off-hours hint
 * for their primary location. Auto-creates the thread on first hit so the
 * mobile UI never has to handle a "no thread yet" state explicitly.
 */
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const thread = await getOrCreateThreadForVolunteer(auth.userId);

    const messages = await listMessages({ threadId: thread.id, limit: 50 });

    const primaryLocation = await getPrimaryLocationForVolunteer(auth.userId);
    const hoursStatus = primaryLocation
      ? evaluateOpenStatus(await getHoursForLocation(primaryLocation))
      : null;

    const lastForUnread = messages.length > 0 ? messages[messages.length - 1] : null;
    const unread = lastForUnread
      ? isUnreadForVolunteer({
          volunteerLastReadAt: thread.volunteerLastReadAt,
          lastMessageAt: thread.lastMessageAt,
          messages: [{ senderRole: lastForUnread.senderRole }],
        })
      : false;

    return NextResponse.json({
      thread: {
        id: thread.id,
        status: thread.status,
        lastMessageAt: thread.lastMessageAt,
        unread,
      },
      messages,
      hours: hoursStatus
        ? {
            location: primaryLocation,
            isOpenNow: hoursStatus.isOpenNow,
            todayHours: hoursStatus.todayHours,
            nextOpenLabel: hoursStatus.nextOpenLabel ?? null,
          }
        : null,
    });
  } catch (err) {
    if (err instanceof MessagingError) {
      const code = err.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status: code });
    }
    console.error("[mobile messages thread GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/mobile/messages/thread/read — clears volunteer-side unread.
 */
export async function POST(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.messageThread.updateMany({
    where: { volunteerId: auth.userId },
    data: { volunteerLastReadAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
