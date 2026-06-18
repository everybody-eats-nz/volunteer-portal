import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe";
import { getStripeKohaForNight } from "@/lib/services/stripe-koha-sync";

// GET - Compute tonight's Stripe koha total for a date + location.
// Read-only: returns the figure for the admin to review and save manually.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date");
  const location = searchParams.get("location");

  if (!date || !location) {
    return NextResponse.json(
      { error: "Date and location are required" },
      { status: 400 }
    );
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe isn't configured yet" },
      { status: 503 }
    );
  }

  // Pop-up / special-event venues are koha-manual-only — koha there isn't taken
  // through the per-restaurant Stripe products, so never attribute charges to them.
  const locationConfig = await prisma.location.findUnique({
    where: { name: location },
    select: { isPopup: true },
  });
  if (locationConfig?.isPopup) {
    return NextResponse.json(
      { error: "Stripe sync isn't available for special events — enter koha manually" },
      { status: 422 }
    );
  }

  try {
    const { total, paymentCount } = await getStripeKohaForNight({
      date,
      location,
    });
    return NextResponse.json({ total, currency: "nzd", paymentCount });
  } catch (error) {
    console.error("Error syncing Stripe koha:", error);
    return NextResponse.json(
      { error: "Failed to sync with Stripe" },
      { status: 500 }
    );
  }
}
