import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  WaitlistOfferError,
  confirmWaitlistPlace,
} from "@/lib/waitlist-offers.server";

/**
 * POST /api/shifts/[id]/waitlist-confirm
 *
 * Keep a waitlist place the team put you in. Leaving instead is the normal
 * cancel (DELETE /api/shifts/[id]/signup).
 */
export async function POST(
  _req: Request,
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

  const { id: shiftId } = await params;
  try {
    return NextResponse.json(await confirmWaitlistPlace(shiftId, user.id));
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
