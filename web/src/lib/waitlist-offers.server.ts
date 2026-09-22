/**
 * Waitlist offers: filling a place that just opened up, without waiting for an
 * admin to notice.
 *
 * The old waitlist was a list and nothing more. A confirmed volunteer would
 * cancel at 4pm, the place would sit empty, and the restaurant ran short even
 * though eight people had put their hand up. This module closes that loop.
 *
 * How it works:
 *
 *   1. A confirmed place frees up (someone cancels, an admin cancels them, or
 *      capacity goes up). Something calls {@link offerWaitlistPlaces}.
 *   2. The waitlist is walked oldest-first. Each person is put through the
 *      normal auto-approval rules for that shift - the same evaluator a fresh
 *      signup goes through - and the first who would be auto-approved is
 *      offered the place.
 *   3. They get a push notification and have until `waitlistOfferExpiresAt` to
 *      accept. Their status stays WAITLISTED the whole time: an offer is not a
 *      place, and nothing should render it as one.
 *   4. If they decline, or the window lapses, the offer moves to the next
 *      eligible person.
 *
 * Only auto-approval-eligible volunteers are offered anything. Anyone else on
 * the list is still the team's call, exactly as before - this never confirms
 * someone a human would have wanted to look at first.
 *
 * Server-only: uses Prisma. Volunteer-facing copy lives in `@/lib/waitlist`.
 */

import { prisma } from "@/lib/prisma";
import {
  buildShiftContext,
  evaluateOutcome,
  getLiveRules,
  getVolunteerSnapshots,
} from "@/lib/auto-approval";
import { createWaitlistOfferNotification } from "@/lib/notifications";
import { formatInNZT } from "@/lib/timezone";

/**
 * How long someone has to answer.
 *
 * Long enough to survive a work day away from your phone, short enough that a
 * place isn't parked with one unresponsive person while the shift approaches.
 * Never runs past the shift itself - an offer you can accept after service has
 * started is worse than no offer.
 */
export const OFFER_WINDOW_MS = 4 * 60 * 60 * 1000;

/** A place is only worth offering if there's still time to act on it. */
const MIN_OFFER_WINDOW_MS = 10 * 60 * 1000;

export interface OfferResult {
  /** Offers created by this call. */
  offered: number;
  /** Live offers that had run out and were rolled past. */
  expired: number;
}

function offerExpiryFor(shiftStart: Date, now: Date): Date | null {
  const cap = shiftStart.getTime();
  const wanted = now.getTime() + OFFER_WINDOW_MS;
  const expiry = Math.min(wanted, cap);
  if (expiry - now.getTime() < MIN_OFFER_WINDOW_MS) return null;
  return new Date(expiry);
}

/**
 * Retire offers whose window has closed.
 *
 * Lapsed offers are recorded as declined rather than simply cleared: staying
 * silent is an answer, and it means the place moves on instead of being
 * offered to the same person over and over.
 *
 * Pass a `shiftId` to sweep one shift (the hot path, before making new
 * offers); omit it for the periodic sweep across every shift.
 */
export async function expireLapsedOffers(shiftId?: string): Promise<number> {
  const { count } = await prisma.signup.updateMany({
    where: {
      ...(shiftId ? { shiftId } : {}),
      status: "WAITLISTED",
      waitlistOfferDeclinedAt: null,
      waitlistOfferExpiresAt: { not: null, lte: new Date() },
    },
    data: { waitlistOfferDeclinedAt: new Date() },
  });
  return count;
}

/**
 * Offer every currently-free place on a shift to the next eligible people on
 * its waitlist.
 *
 * Safe to call whenever a place might have opened up - it is a no-op when the
 * shift is full, already has enough live offers out, has started, or has
 * nobody eligible waiting. Never throws into the caller's path: filling a
 * place is worth doing but is not worth failing a cancellation over.
 */
export async function offerWaitlistPlaces(
  shiftId: string
): Promise<OfferResult> {
  const result: OfferResult = { offered: 0, expired: 0 };

  try {
    result.expired = await expireLapsedOffers(shiftId);

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      select: {
        id: true,
        start: true,
        capacity: true,
        location: true,
        shiftTypeId: true,
        shiftType: { select: { name: true } },
      },
    });
    if (!shift) return result;

    const now = new Date();
    // A shift that has started fills itself, by people walking in.
    if (shift.start <= now) return result;

    const expiresAt = offerExpiryFor(shift.start, now);
    if (!expiresAt) return result;

    const [confirmedCount, liveOfferCount] = await Promise.all([
      prisma.signup.count({ where: { shiftId, status: "CONFIRMED" } }),
      prisma.signup.count({
        where: {
          shiftId,
          status: "WAITLISTED",
          waitlistOfferDeclinedAt: null,
          waitlistOfferExpiresAt: { gt: now },
        },
      }),
    ]);

    // Offers are never written for more places than exist. Two people holding
    // offers for one place would mean telling one of them, after they said
    // yes, that it had gone.
    const placesToOffer = shift.capacity - confirmedCount - liveOfferCount;
    if (placesToOffer <= 0) return result;

    // Oldest first. The portal has never promised a queue position, but time
    // waited is the only ordering anyone would accept as fair, and it is the
    // one people assume.
    const candidates = await prisma.signup.findMany({
      where: {
        shiftId,
        status: "WAITLISTED",
        waitlistOfferedAt: null,
        waitlistOfferDeclinedAt: null,
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true },
    });
    if (candidates.length === 0) return result;

    // One aggregate query for the whole waitlist rather than one per person.
    const [snapshots, rules] = await Promise.all([
      getVolunteerSnapshots(shift.shiftTypeId, {
        userIds: candidates.map((c) => c.userId),
      }),
      getLiveRules(),
    ]);
    const snapshotByUser = new Map(snapshots.map((s) => [s.userId, s]));
    const shiftContext = buildShiftContext(shift);

    const shiftDate = formatInNZT(shift.start, "EEEE, MMMM d");

    for (const candidate of candidates) {
      if (result.offered >= placesToOffer) break;

      const snapshot = snapshotByUser.get(candidate.userId);
      if (!snapshot) continue;

      // "Provided they are on auto-approval" - the same rules, the same
      // evaluator, the same answer a fresh signup would have got.
      const { outcome } = evaluateOutcome(rules, snapshot, shiftContext);
      if (outcome !== "APPROVED") continue;

      await prisma.signup.update({
        where: { id: candidate.id },
        data: { waitlistOfferedAt: now, waitlistOfferExpiresAt: expiresAt },
      });

      try {
        await createWaitlistOfferNotification({
          userId: candidate.userId,
          shiftName: shift.shiftType.name,
          shiftDate,
          shiftId: shift.id,
          expiresAt,
        });
      } catch (err) {
        // The offer is real whether or not the push landed; they will still
        // see it in the app. Don't roll it back over a notification.
        console.error("[waitlist] Failed to notify offer recipient:", err);
      }

      result.offered++;
    }
  } catch (err) {
    console.error(
      `[waitlist] Failed to offer places on shift ${shiftId}:`,
      err
    );
  }

  return result;
}

export class WaitlistOfferError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "WaitlistOfferError";
  }
}

/** The signup fields every offer decision needs. */
const offerSelect = {
  id: true,
  userId: true,
  shiftId: true,
  status: true,
  waitlistOfferExpiresAt: true,
  waitlistOfferDeclinedAt: true,
  shift: {
    select: {
      id: true,
      start: true,
      capacity: true,
      shiftType: { select: { name: true } },
    },
  },
} as const;

async function loadLiveOffer(signupId: string, userId: string) {
  const signup = await prisma.signup.findUnique({
    where: { id: signupId },
    select: offerSelect,
  });

  if (!signup || signup.userId !== userId) {
    throw new WaitlistOfferError(404, "Offer not found");
  }
  if (signup.status !== "WAITLISTED") {
    throw new WaitlistOfferError(400, "You're no longer on this waitlist");
  }
  if (
    !signup.waitlistOfferExpiresAt ||
    signup.waitlistOfferDeclinedAt ||
    signup.waitlistOfferExpiresAt <= new Date()
  ) {
    throw new WaitlistOfferError(
      410,
      "This offer has expired and the place has moved on"
    );
  }

  return signup;
}

/**
 * Take the offered place.
 *
 * Capacity is re-checked here rather than trusted from when the offer went
 * out: an admin can confirm someone by hand in the meantime, and being told
 * "yes" and then silently going over capacity is worse than being told the
 * place has gone.
 */
export async function acceptWaitlistOffer(signupId: string, userId: string) {
  const signup = await loadLiveOffer(signupId, userId);

  const confirmedCount = await prisma.signup.count({
    where: { shiftId: signup.shiftId, status: "CONFIRMED" },
  });
  if (confirmedCount >= signup.shift.capacity) {
    await prisma.signup.update({
      where: { id: signup.id },
      data: { waitlistOfferDeclinedAt: new Date() },
    });
    throw new WaitlistOfferError(
      409,
      "Sorry - that place was filled before you accepted. You're still on the waitlist."
    );
  }

  const updated = await prisma.signup.update({
    where: { id: signup.id },
    data: {
      status: "CONFIRMED",
      waitlistOfferExpiresAt: null,
      waitlistOfferDeclinedAt: null,
    },
  });

  return { signup: updated, shift: signup.shift };
}

/**
 * Turn the offered place down. The place immediately moves to the next
 * eligible person rather than waiting for the sweep.
 */
export async function declineWaitlistOffer(signupId: string, userId: string) {
  const signup = await loadLiveOffer(signupId, userId);

  const updated = await prisma.signup.update({
    where: { id: signup.id },
    data: { waitlistOfferDeclinedAt: new Date() },
  });

  await offerWaitlistPlaces(signup.shiftId);

  return { signup: updated, shift: signup.shift };
}

/**
 * Is there a live offer on this signup right now?
 *
 * Takes the raw fields so callers can use it on whatever they already
 * selected, without another read.
 */
export function hasLiveWaitlistOffer(signup: {
  status: string;
  waitlistOfferExpiresAt: Date | null;
  waitlistOfferDeclinedAt: Date | null;
}): boolean {
  return (
    signup.status === "WAITLISTED" &&
    !signup.waitlistOfferDeclinedAt &&
    signup.waitlistOfferExpiresAt !== null &&
    signup.waitlistOfferExpiresAt > new Date()
  );
}
