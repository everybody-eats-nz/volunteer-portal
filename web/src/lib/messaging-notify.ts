import type { Message, Role, User } from "@/generated/client";
import { createNotification } from "./notifications";
import { notificationSSEManager } from "./notification-sse-manager";

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

  await notificationSSEManager
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
    .catch((err) =>
      console.error("[messaging-notify] broadcastNewMessageToAdmins:", err)
    );
}
