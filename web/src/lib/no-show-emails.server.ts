/**
 * The no-show follow-up email.
 *
 * Marking someone a no-show doesn't email them on the spot. Attendance is
 * marked during service, and a volunteer who turns up twenty minutes late is
 * marked present again; an email that had already gone out would be telling
 * them off for something they didn't do. So marking only records
 * `noShowMarkedAt`, and this sweep sends the email once:
 *
 *   - the shift has ended (the last chance to walk in has passed), and
 *   - the mark is at least {@link UNDO_GRACE_MS} old (a mark made after the
 *     shift can still be a mis-tap, corrected straight away).
 *
 * Marks older than {@link MAX_AGE_MS} are left alone: an email about a shift
 * from weeks ago (say, after the template was missing for a while) does more
 * harm than good. Historical no-shows recorded before this existed never have
 * `noShowMarkedAt`, so they are never emailed.
 *
 * Server-only: uses Prisma.
 */

import { prisma } from "@/lib/prisma";
import { getEmailService } from "@/lib/email-service";
import { getLocationAddresses } from "@/lib/locations";
import { formatInNZT } from "@/lib/timezone";

export const UNDO_GRACE_MS = 10 * 60 * 1000;
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

export interface NoShowSweepResult {
  sent: number;
  failed: number;
  /** Set when nothing could be sent at all, e.g. the template isn't set up. */
  skippedReason?: string;
}

export async function sendDueNoShowEmails(
  now: Date = new Date()
): Promise<NoShowSweepResult> {
  const emailService = getEmailService();
  if (!emailService.isNoShowEmailConfigured()) {
    // Left queued rather than marked sent: once the template is configured,
    // anything still inside MAX_AGE_MS goes out on the next run.
    return {
      sent: 0,
      failed: 0,
      skippedReason: "CAMPAIGN_MONITOR_NO_SHOW_EMAIL_ID is not configured",
    };
  }

  const due = await prisma.signup.findMany({
    where: {
      status: "NO_SHOW",
      noShowEmailSentAt: null,
      noShowMarkedAt: {
        not: null,
        lte: new Date(now.getTime() - UNDO_GRACE_MS),
      },
      shift: {
        end: { lte: now, gte: new Date(now.getTime() - MAX_AGE_MS) },
      },
    },
    orderBy: { noShowMarkedAt: "asc" },
    take: BATCH_SIZE,
    select: {
      id: true,
      user: {
        select: { email: true, name: true, firstName: true, lastName: true },
      },
      shift: {
        select: {
          start: true,
          end: true,
          location: true,
          shiftType: { select: { name: true } },
        },
      },
    },
  });
  if (due.length === 0) return { sent: 0, failed: 0 };

  const addresses = await getLocationAddresses();
  const result: NoShowSweepResult = { sent: 0, failed: 0 };

  for (const signup of due) {
    // Claim before sending so two overlapping runs can never both send it.
    const claim = await prisma.signup.updateMany({
      where: { id: signup.id, noShowEmailSentAt: null, status: "NO_SHOW" },
      data: { noShowEmailSentAt: now },
    });
    if (claim.count === 0) continue;

    const { user, shift } = signup;
    const volunteerName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.name ||
      user.email;

    try {
      await emailService.sendNoShowNotification({
        to: user.email,
        volunteerName,
        shiftName: shift.shiftType.name,
        shiftDate: formatInNZT(shift.start, "EEEE d MMMM yyyy"),
        shiftTime: `${formatInNZT(shift.start, "h:mm a")} - ${formatInNZT(
          shift.end,
          "h:mm a"
        )}`,
        location: shift.location
          ? addresses[shift.location] || shift.location
          : "TBD",
      });
      result.sent++;
    } catch (err) {
      console.error(`[no-show] Failed to email signup ${signup.id}:`, err);
      // Release the claim so the next run tries again.
      await prisma.signup.update({
        where: { id: signup.id },
        data: { noShowEmailSentAt: null },
      });
      result.failed++;
    }
  }

  return result;
}
