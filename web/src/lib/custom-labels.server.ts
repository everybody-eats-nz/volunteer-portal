/**
 * Putting a custom label on a volunteer, and the side effects that go with it.
 *
 * Most labels are plain tags. Two settings on a label change that:
 *
 * - `requiresNote`: the admin must say why when they add it (a "Management
 *   Note" is only useful with the note). The note sits on the assignment and
 *   is only ever shown to admins.
 * - watchers: admins who asked to be told whenever the label goes on someone.
 *   They get an in-app notification, a push and an email. Whoever added the
 *   label is not told about their own action.
 *
 * Server-only: uses Prisma.
 */

import { prisma } from "@/lib/prisma";
import { createNotificationsForUsers } from "@/lib/notifications";
import { getEmailService } from "@/lib/email-service";

/** Long enough for a proper handover, short enough to read on a roster. */
export const LABEL_NOTE_MAX_LENGTH = 1000;

export class LabelAssignmentError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "LabelAssignmentError";
  }
}

/** Trim a note; empty means none. Throws when it is too long. */
export function normaliseLabelNote(note: unknown): string | null {
  if (note === undefined || note === null) return null;
  if (typeof note !== "string") {
    throw new LabelAssignmentError(400, "Note must be text");
  }
  const trimmed = note.trim();
  if (!trimmed) return null;
  if (trimmed.length > LABEL_NOTE_MAX_LENGTH) {
    throw new LabelAssignmentError(
      400,
      `Note must be ${LABEL_NOTE_MAX_LENGTH} characters or fewer`
    );
  }
  return trimmed;
}

function displayName(user: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.name ||
    user.email
  );
}

const assignmentInclude = {
  label: true,
  assignedBy: {
    select: { id: true, name: true, firstName: true, lastName: true },
  },
} as const;

export async function assignLabel(params: {
  userId: string;
  labelId: string;
  note?: unknown;
  assignedById: string;
}) {
  const note = normaliseLabelNote(params.note);

  const [user, label] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.userId },
      select: { id: true },
    }),
    prisma.customLabel.findUnique({
      where: { id: params.labelId, isActive: true },
    }),
  ]);
  if (!user) throw new LabelAssignmentError(404, "User not found");
  if (!label) throw new LabelAssignmentError(404, "Label not found or inactive");
  if (label.requiresNote && !note) {
    throw new LabelAssignmentError(
      400,
      `Add a note to explain the ${label.name} label`
    );
  }

  const existing = await prisma.userCustomLabel.findUnique({
    where: {
      userId_labelId: { userId: params.userId, labelId: params.labelId },
    },
    select: { id: true },
  });
  if (existing) {
    throw new LabelAssignmentError(409, "User already has this label");
  }

  const assignment = await prisma.userCustomLabel.create({
    data: {
      userId: params.userId,
      labelId: params.labelId,
      note,
      assignedById: params.assignedById,
    },
    include: assignmentInclude,
  });

  // Telling the watchers must never undo or delay the assignment itself.
  notifyLabelWatchers(assignment.id).catch((err) =>
    console.error("[labels] Failed to notify label watchers:", err)
  );

  return assignment;
}

export async function updateLabelNote(params: {
  userId: string;
  labelId: string;
  note: unknown;
}) {
  const note = normaliseLabelNote(params.note);

  const assignment = await prisma.userCustomLabel.findUnique({
    where: {
      userId_labelId: { userId: params.userId, labelId: params.labelId },
    },
    include: { label: { select: { name: true, requiresNote: true } } },
  });
  if (!assignment) {
    throw new LabelAssignmentError(404, "User label assignment not found");
  }
  if (assignment.label.requiresNote && !note) {
    throw new LabelAssignmentError(
      400,
      `The ${assignment.label.name} label needs a note`
    );
  }

  return prisma.userCustomLabel.update({
    where: { id: assignment.id },
    data: { note },
    include: assignmentInclude,
  });
}

/**
 * Tell everyone watching the label that it was just put on a volunteer.
 * Only admins are told, and never the admin who added it.
 */
export async function notifyLabelWatchers(assignmentId: string): Promise<void> {
  const assignment = await prisma.userCustomLabel.findUnique({
    where: { id: assignmentId },
    include: {
      label: {
        include: {
          watchers: {
            where: { user: { role: "ADMIN" } },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
      user: {
        select: { id: true, email: true, name: true, firstName: true, lastName: true },
      },
      assignedBy: {
        select: { id: true, email: true, name: true, firstName: true, lastName: true },
      },
    },
  });
  if (!assignment) return;

  const recipients = assignment.label.watchers
    .map((w) => w.user)
    .filter((u) => u.id !== assignment.assignedById);
  if (recipients.length === 0) return;

  const volunteerName = displayName(assignment.user);
  const assignedBy = assignment.assignedBy
    ? displayName(assignment.assignedBy)
    : "Someone on the team";
  const labelName = assignment.label.icon
    ? `${assignment.label.icon} ${assignment.label.name}`
    : assignment.label.name;

  await createNotificationsForUsers({
    userIds: recipients.map((r) => r.id),
    type: "LABEL_ASSIGNED",
    title: `${labelName} added`,
    message: assignment.note
      ? `${assignedBy} added ${assignment.label.name} to ${volunteerName}: ${assignment.note}`
      : `${assignedBy} added ${assignment.label.name} to ${volunteerName}`,
    actionUrl: `/admin/volunteers/${assignment.userId}`,
    relatedId: assignment.userId,
  });

  const emailService = getEmailService();
  await Promise.allSettled(
    recipients.map((recipient) =>
      emailService
        .sendLabelAssignedNotification({
          to: recipient.email,
          recipientName: displayName(recipient),
          volunteerName,
          labelName: assignment.label.name,
          note: assignment.note,
          assignedBy,
          volunteerId: assignment.userId,
        })
        .catch((err) =>
          console.error(
            `[labels] Failed to email label alert to ${recipient.id}:`,
            err
          )
        )
    )
  );
}

/**
 * Replace a label's watcher list. Only admins can watch; anyone else in the
 * list is ignored rather than rejected, since roles can change under a form.
 */
export async function setLabelWatchers(labelId: string, userIds: string[]) {
  const admins = await prisma.user.findMany({
    where: { id: { in: [...new Set(userIds)] }, role: "ADMIN" },
    select: { id: true },
  });
  const ids = admins.map((a) => a.id);

  await prisma.$transaction([
    prisma.customLabelWatcher.deleteMany({
      where: { labelId, userId: { notIn: ids } },
    }),
    prisma.customLabelWatcher.createMany({
      data: ids.map((userId) => ({ labelId, userId })),
      skipDuplicates: true,
    }),
  ]);
}

/** Parse a `watcherIds` field from a request body. Undefined = leave as is. */
export function parseWatcherIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new LabelAssignmentError(400, "watcherIds must be a list of user ids");
  }
  return value as string[];
}
