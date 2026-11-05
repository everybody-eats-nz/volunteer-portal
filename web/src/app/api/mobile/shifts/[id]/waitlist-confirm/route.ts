import { NextResponse } from "next/server";

import { requireMobileUser } from "@/lib/mobile-auth";
import {
  WaitlistOfferError,
  confirmWaitlistPlace,
} from "@/lib/waitlist-offers.server";

/**
 * POST /api/mobile/shifts/[id]/waitlist-confirm
 *
 * Mobile twin of the web route: keep a waitlist place the team put you in.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: shiftId } = await params;
  try {
    return NextResponse.json(await confirmWaitlistPlace(shiftId, auth.userId));
  } catch (error) {
    if (error instanceof WaitlistOfferError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error confirming waitlist place:", error);
    return NextResponse.json(
      { error: "Couldn't keep your waitlist place. Please try again." },
      { status: 500 }
    );
  }
}
