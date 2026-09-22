import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  parseWaitlistOfferAction,
  respondToWaitlistOffer,
} from "@/lib/waitlist-offer-response";

/**
 * POST /api/shifts/[id]/waitlist-offer
 *
 * Answer a waitlist offer on this shift: `{ action: "accept" | "decline" }`.
 *
 * Addressed by shift rather than by signup id, because that's what the
 * volunteer has in front of them - the notification links to a shift, not to
 * a row in our database.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
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
    where: { userId_shiftId: { userId: user.id, shiftId } },
    select: { id: true },
  });
  if (!signup) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  const { status, body: payload } = await respondToWaitlistOffer(
    signup.id,
    user.id,
    action
  );
  return NextResponse.json(payload, { status });
}
