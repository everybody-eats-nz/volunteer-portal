import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  expireLapsedOffers,
  offerWaitlistPlaces,
} from "@/lib/waitlist-offers.server";

/**
 * GET /api/cron/waitlist-offers
 *
 * Rolls waitlist offers forward when nobody answered.
 *
 * Every other path into the waitlist is event-driven - a cancellation, a
 * decline, a capacity change - and each of those expires stale offers before
 * it makes new ones. This sweep exists for the case nothing happens at all:
 * one person is offered a place, ignores it, and without a tick nobody would
 * ever ask the next person. Run it every 15 minutes or so.
 *
 * Secured via CRON_SECRET, like the other cron routes.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    // Same reasoning as the other cron routes: a missing secret looks exactly
    // like a quiet job, so say which it is. Volunteers would simply never be
    // asked, and nothing would look broken.
    console.error(
      "[cron] CRON_SECRET is not set - waitlist offers will never roll over"
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Expire first, then re-offer: the shifts worth revisiting are exactly the
  // ones that just lost an offer, plus any that are short for other reasons.
  const expired = await expireLapsedOffers();

  // Only upcoming shifts that actually have somebody waiting are worth
  // walking. Everything else is a no-op inside offerWaitlistPlaces anyway,
  // but there is no reason to pay for the round trip.
  const waiting = await prisma.signup.groupBy({
    by: ["shiftId"],
    where: {
      status: "WAITLISTED",
      waitlistOfferDeclinedAt: null,
      waitlistOfferedAt: null,
      shift: { start: { gt: new Date() } },
    },
  });

  let offered = 0;
  for (const { shiftId } of waiting) {
    const result = await offerWaitlistPlaces(shiftId);
    offered += result.offered;
  }

  console.log(
    `[cron] Waitlist offers: ${expired} expired, ${waiting.length} shifts checked, ${offered} offered`
  );

  return NextResponse.json({
    expired,
    shiftsChecked: waiting.length,
    offered,
  });
}
