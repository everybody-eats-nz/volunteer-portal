import { NextResponse } from "next/server";

import { requireMobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import {
  parseWaitlistOfferAction,
  respondToWaitlistOffer,
} from "@/lib/waitlist-offer-response";

/**
 * POST /api/mobile/shifts/[id]/waitlist-offer
 *
 * Mobile twin of the web route: `{ action: "accept" | "decline" }`. Accepting
 * from the push notification is the whole point of the feature, so this is the
 * path that matters most.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = parseWaitlistOfferAction(body?.action);
  if (!action) {
    return NextResponse.json(
      { error: "Expected action 'accept' or 'decline'" },
      { status: 400 }
    );
  }

  const { id: shiftId } = await params;
  const signup = await prisma.signup.findUnique({
    where: { userId_shiftId: { userId: auth.userId, shiftId } },
    select: { id: true },
  });
  if (!signup) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  const { status, body: payload } = await respondToWaitlistOffer(
    signup.id,
    auth.userId,
    action
  );
  return NextResponse.json(payload, { status });
}
