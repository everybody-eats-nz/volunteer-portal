import { prisma } from "@/lib/prisma";
import type { Prisma, Role } from "@/generated/client";
import {
  broadcastNewMessageToAdmins,
  notifyVolunteerOfTeamMessage,
} from "@/lib/messaging-notify";

const MAX_MESSAGE_LENGTH = 4000;

export class MessagingError extends Error {
  constructor(
    public code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "EMPTY_BODY"
      | "BODY_TOO_LONG"
      | "VOLUNTEER_REQUIRED",
    message: string
  ) {
    super(message);
    this.name = "MessagingError";
  }
}

const messageInclude = {
  sender: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      profilePhotoUrl: true,
    },
  },
} satisfies Prisma.MessageInclude;

const threadInclude = {
  volunteer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      profilePhotoUrl: true,
      defaultLocation: true,
      volunteerGrade: true,
    },
  },
} satisfies Prisma.MessageThreadInclude;

export type ThreadWithVolunteer = Prisma.MessageThreadGetPayload<{
  include: typeof threadInclude;
}>;

export type MessageWithSender = Prisma.MessageGetPayload<{
  include: typeof messageInclude;
}>;

function validateBody(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new MessagingError("EMPTY_BODY", "Message body is required");
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new MessagingError("EMPTY_BODY", "Message body is required");
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new MessagingError(
      "BODY_TOO_LONG",
      `Message must be at most ${MAX_MESSAGE_LENGTH} characters`
    );
  }
  return trimmed;
}

/**
 * Get-or-create a thread for a volunteer. Used by both volunteer-initiated
 * sends (mobile) and admin-initiated "Message volunteer" buttons (web).
 */
export async function getOrCreateThreadForVolunteer(
  volunteerId: string
): Promise<ThreadWithVolunteer> {
  const volunteer = await prisma.user.findUnique({
    where: { id: volunteerId },
    select: { id: true, role: true },
  });
  if (!volunteer) {
    throw new MessagingError("NOT_FOUND", "Volunteer not found");
  }
  if (volunteer.role !== "VOLUNTEER") {
    throw new MessagingError(
      "VOLUNTEER_REQUIRED",
      "Threads are only created for volunteers"
    );
  }

  const existing = await prisma.messageThread.findUnique({
    where: { volunteerId },
    include: threadInclude,
  });
  if (existing) return existing;

  return prisma.messageThread.create({
    data: { volunteerId },
    include: threadInclude,
  });
}

interface ListMessagesOptions {
  threadId: string;
  before?: Date;
  limit?: number;
}

export async function listMessages({
  threadId,
  before,
  limit = 50,
}: ListMessagesOptions): Promise<MessageWithSender[]> {
  const messages = await prisma.message.findMany({
    where: {
      threadId,
      ...(before ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
    include: messageInclude,
  });
  return messages.reverse();
}

interface SendMessageArgs {
  threadId: string;
  senderId: string;
  senderRole: Role;
  body: string;
}

export async function sendMessage(
  args: SendMessageArgs
): Promise<MessageWithSender> {
  const body = validateBody(args.body);
  const sentByVolunteer = args.senderRole === "VOLUNTEER";

  const thread = await prisma.messageThread.findUnique({
    where: { id: args.threadId },
    include: { volunteer: { select: { id: true } } },
  });
  if (!thread) {
    throw new MessagingError("NOT_FOUND", "Thread not found");
  }
  if (sentByVolunteer && thread.volunteerId !== args.senderId) {
    throw new MessagingError("FORBIDDEN", "You can only send to your own thread");
  }

  const now = new Date();

  // Sender's own write also clears their unread marker.
  const readMarker: Prisma.MessageThreadUpdateInput = sentByVolunteer
    ? { volunteerLastReadAt: now }
    : { teamLastReadAt: now };

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        threadId: args.threadId,
        senderId: args.senderId,
        senderRole: args.senderRole,
        body,
      },
      include: messageInclude,
    }),
    prisma.messageThread.update({
      where: { id: args.threadId },
      data: {
        lastMessageAt: now,
        // Re-open if a previously resolved thread gets a new message.
        status: "OPEN",
        ...readMarker,
      },
    }),
  ]);

  // Fan-out notifications outside the transaction.
  if (sentByVolunteer) {
    const volunteer = await prisma.user.findUnique({
      where: { id: thread.volunteerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
      },
    });
    if (volunteer) {
      void broadcastNewMessageToAdmins({
        threadId: args.threadId,
        message: {
          id: message.id,
          body: message.body,
          senderId: message.senderId,
          senderRole: message.senderRole,
          createdAt: message.createdAt,
        },
        volunteer,
      });
    }
  } else {
    void notifyVolunteerOfTeamMessage({
      threadId: args.threadId,
      volunteerId: thread.volunteerId,
      body,
      sender: {
        id: args.senderId,
        firstName: message.sender.firstName,
        name: message.sender.name,
      },
    });
  }

  return message;
}

/**
 * Mark the thread read for the volunteer or for the admin team. Idempotent.
 */
export async function markThreadRead(
  threadId: string,
  side: "volunteer" | "team"
): Promise<void> {
  await prisma.messageThread.update({
    where: { id: threadId },
    data:
      side === "volunteer"
        ? { volunteerLastReadAt: new Date() }
        : { teamLastReadAt: new Date() },
  });
}

export async function setThreadStatus(
  threadId: string,
  status: "OPEN" | "RESOLVED"
): Promise<void> {
  await prisma.messageThread.update({
    where: { id: threadId },
    data: { status },
  });
}

export interface ThreadListItem {
  id: string;
  status: "OPEN" | "RESOLVED";
  lastMessageAt: Date;
  unreadForTeam: boolean;
  lastMessage: {
    body: string;
    senderRole: Role;
    createdAt: Date;
  } | null;
  volunteer: {
    id: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    profilePhotoUrl: string | null;
    defaultLocation: string | null;
  };
}

interface ListThreadsOptions {
  status?: "OPEN" | "RESOLVED" | "ALL";
  unreadOnly?: boolean;
  search?: string;
  location?: string;
  limit?: number;
  cursor?: string;
}

export async function listThreadsForAdmin(
  opts: ListThreadsOptions = {}
): Promise<ThreadListItem[]> {
  const {
    status = "OPEN",
    unreadOnly,
    search,
    location,
    limit = 30,
    cursor,
  } = opts;

  const where: Prisma.MessageThreadWhereInput = {};
  if (status !== "ALL") where.status = status;
  const volunteerFilters: Prisma.UserWhereInput[] = [];
  if (location) volunteerFilters.push({ defaultLocation: location });
  if (search) {
    volunteerFilters.push({
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (volunteerFilters.length > 0) {
    where.volunteer = { AND: volunteerFilters };
  }

  const threads = await prisma.messageThread.findMany({
    where,
    orderBy: [{ lastMessageAt: "desc" }],
    take: Math.min(limit, 100),
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      ...threadInclude,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          body: true,
          senderRole: true,
          createdAt: true,
        },
      },
    },
  });

  const items: ThreadListItem[] = threads.map((t) => {
    const last = t.messages[0] ?? null;
    const unreadForTeam = isUnreadForTeam(t.teamLastReadAt, t.lastMessageAt, last);
    return {
      id: t.id,
      status: t.status,
      lastMessageAt: t.lastMessageAt,
      unreadForTeam,
      lastMessage: last
        ? {
            body: last.body,
            senderRole: last.senderRole,
            createdAt: last.createdAt,
          }
        : null,
      volunteer: {
        id: t.volunteer.id,
        firstName: t.volunteer.firstName,
        lastName: t.volunteer.lastName,
        name:
          [t.volunteer.firstName, t.volunteer.lastName]
            .filter(Boolean)
            .join(" ") ||
          t.volunteer.name ||
          t.volunteer.email,
        email: t.volunteer.email,
        profilePhotoUrl: t.volunteer.profilePhotoUrl,
        defaultLocation: t.volunteer.defaultLocation,
      },
    };
  });

  return unreadOnly ? items.filter((t) => t.unreadForTeam) : items;
}

function isUnreadForTeam(
  teamLastReadAt: Date | null,
  lastMessageAt: Date,
  lastMessage: { senderRole: Role } | null
): boolean {
  if (!lastMessage) return false;
  if (lastMessage.senderRole !== "VOLUNTEER") return false;
  if (!teamLastReadAt) return true;
  return lastMessageAt.getTime() > teamLastReadAt.getTime();
}

export function isUnreadForVolunteer(thread: {
  volunteerLastReadAt: Date | null;
  lastMessageAt: Date;
  messages: Array<{ senderRole: Role }>;
}): boolean {
  const last = thread.messages[thread.messages.length - 1];
  if (!last || last.senderRole === "VOLUNTEER") return false;
  if (!thread.volunteerLastReadAt) return true;
  return thread.lastMessageAt.getTime() > thread.volunteerLastReadAt.getTime();
}

export async function countUnreadForTeam(): Promise<number> {
  // Open threads where the latest message is from a volunteer and after the
  // team's last-read marker (or never read).
  const threads = await prisma.messageThread.findMany({
    where: { status: "OPEN" },
    select: {
      id: true,
      teamLastReadAt: true,
      lastMessageAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { senderRole: true },
      },
    },
  });
  return threads.filter((t) =>
    isUnreadForTeam(t.teamLastReadAt, t.lastMessageAt, t.messages[0] ?? null)
  ).length;
}
