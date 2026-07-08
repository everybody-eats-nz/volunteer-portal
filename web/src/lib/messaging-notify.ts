import type { Message, Role, User } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { createNotification } from "./notifications";
import { notificationSSEManager } from "./notification-sse-manager";
import { sendPushToUsers } from "./services/expo-push";

/**
 * Realtime + push notification helpers for the volunteer ↔ team direct
 * messaging system.
 *
 * Volunteers receive a normal Notification row + mobile push so the bell
 * badge and OS badge stay in sync. The bell SSE event already carries the
 * threadId in metadata, so the open mobile thread screen can refetch on
 * receipt — no duplicate event is needed.
 *
 * Admins are web-only and would drown in DB notifications if every new
 * message created one — they get a live SSE event only with the full
 * message body, and their inbox UI keeps unread state from the thread's
 * `teamLastReadAt` column.
 *
 * On top of the SSE event, admins who have opted in (`adminMessageNotifications`,
 * toggled on the mobile admin messages screen, off by default) get a mobile
 * push so they can reply on the go. Push-only — still no DB notification row,
 * to keep the "don't drown admins" property.
 */

const MESSAGE_PREVIEW_LIMIT = 140;

function preview(body: string): string {
  if (body.length <= MESSAGE_PREVIEW_LIMIT) return body;
  return body.slice(0, MESSAGE_PREVIEW_LIMIT - 1).trimEnd() + "…";
}

function senderDisplayName(sender: Pick<User, "firstName" | "name">): string {
  return sender.firstName || sender.name || "Everybody Eats";
}

interface NotifyVolunteerArgs {
  threadId: string;
  volunteerId: string;
  body: string;
  sender: Pick<User, "id" | "firstName" | "name">;
}

export async function notifyVolunteerOfTeamMessage(
  args: NotifyVolunteerArgs
): Promise<void> {
  const title = `${senderDisplayName(args.sender)} from Everybody Eats`;
  await createNotification({
    userId: args.volunteerId,
    type: "DIRECT_MESSAGE",
    title,
    message: preview(args.body),
    actionUrl: "/help/team",
    relatedId: args.threadId,
  }).catch((err) =>
    console.error("[messaging-notify] notifyVolunteerOfTeamMessage:", err)
  );
}

interface BroadcastToAdminsArgs {
  threadId: string;
  message: Pick<Message, "id" | "body" | "senderId" | "createdAt"> & {
    senderRole: Role;
  };
  volunteer: Pick<User, "id" | "firstName" | "lastName" | "name" | "email">;
}

export async function broadcastNewMessageToAdmins(
  args: BroadcastToAdminsArgs
): Promise<void> {
  const volunteerName =
    [args.volunteer.firstName, args.volunteer.lastName]
      .filter(Boolean)
      .join(" ") ||
    args.volunteer.name ||
    args.volunteer.email;

  console.log(
    `[messaging-notify] SSE admin broadcast starting for message ${args.message.id}`
  );
  const sseStart = Date.now();
  const sseCount = await notificationSSEManager
    .broadcastToAdmins({
      type: "notification",
      timestamp: Date.now(),
      data: {
        notification: {
          kind: "direct_message",
          threadId: args.threadId,
          directMessage: {
            id: args.message.id,
            body: args.message.body,
            senderId: args.message.senderId,
            senderRole: args.message.senderRole,
            createdAt: args.message.createdAt,
          },
          volunteer: {
            id: args.volunteer.id,
            name: volunteerName,
          },
        },
      },
    })
    .catch((err) => {
      console.error("[messaging-notify] broadcastNewMessageToAdmins:", err);
      return 0;
    });
  console.log(
    `[messaging-notify] SSE admin broadcast done in ${Date.now() - sseStart}ms (${sseCount ?? 0} admin user(s) reached)`
  );

  // Opt-in mobile push to admins (push-only, no DB notification row).
  try {
    const optedInAdmins = await prisma.user.findMany({
      where: {
        role: "ADMIN",
        adminMessageNotifications: true,
        id: { not: args.message.senderId },
      },
      select: { id: true },
    });
    console.log(
      `[messaging-notify] volunteer ${args.volunteer.id} messaged team; ${optedInAdmins.length} opted-in admin(s) to push`
    );
    if (optedInAdmins.length > 0) {
      const pushStart = Date.now();
      // No badge: admins track message unread via the thread's teamLastReadAt
      // column (SSE-driven), not Notification rows, so there's no per-user count
      // to surface — and we don't want to clobber their real notification badge.
      await sendPushToUsers(
        optedInAdmins.map((a) => a.id),
        {
          title: `${volunteerName} messaged the team`,
          body: preview(args.message.body),
          data: {
            type: "DIRECT_MESSAGE_ADMIN",
            threadId: args.threadId,
            actionUrl: "/admin/messages",
          },
        }
      );
      console.log(
        `[messaging-notify] admin push dispatch for message ${args.message.id} completed in ${Date.now() - pushStart}ms`
      );
    }
  } catch (err) {
    console.error("[messaging-notify] admin message push:", err);
  }
}
