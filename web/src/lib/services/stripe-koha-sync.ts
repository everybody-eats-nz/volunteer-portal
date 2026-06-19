import type Stripe from "stripe";
import { startOfDay, endOfDay } from "date-fns";
import { parseISOInNZT, toUTC } from "@/lib/timezone";
import { getStripe } from "@/lib/stripe";
import {
  sumNightKoha,
  type KohaSession,
  type KohaPaymentIntent,
  type NightKohaResult,
} from "@/lib/stripe-koha";

/** Convert a Date to a Stripe `created` filter bound (unix seconds). */
const toUnix = (d: Date) => Math.floor(d.getTime() / 1000);

/** A line item's product name, when the product is expanded and not deleted. */
function productName(item: Stripe.LineItem): string | null {
  const product = item.price?.product;
  if (product && typeof product === "object" && "name" in product) {
    return product.name ?? null;
  }
  return null;
}

/**
 * Pull the Stripe koha for a single service night + location.
 *
 * Reads two flows over the NZ-day window (see lib/stripe-koha.ts for why both
 * carry the location as text):
 *  - paid Checkout Sessions → product names (via line items)
 *  - succeeded PaymentIntents → description (pay-at-table)
 *
 * `sumNightKoha` dedupes a donation's session against its PaymentIntent and
 * filters to the requested location. The caller should gate on
 * {@link import("@/lib/stripe").isStripeConfigured} first.
 */
export async function getStripeKohaForNight({
  date,
  location,
}: {
  date: string; // YYYY-MM-DD (NZ service day)
  location: string;
}): Promise<NightKohaResult> {
  const stripe = getStripe();

  // NZ service-day bounds → UTC → unix seconds for Stripe's `created` filter.
  const dateNZT = parseISOInNZT(date);
  const created = {
    gte: toUnix(toUTC(startOfDay(dateNZT))),
    lte: toUnix(toUTC(endOfDay(dateNZT))),
  };

  // 1. Paid Checkout Sessions in the window (all locations; filtered later).
  const paidSessions: Stripe.Checkout.Session[] = [];
  for await (const session of stripe.checkout.sessions.list({
    created,
    limit: 100,
  })) {
    if (session.status === "complete" && session.payment_status === "paid") {
      paidSessions.push(session);
    }
  }

  // Resolve each paid session's product names from its line items. Line items
  // aren't expandable on the list call, so they're fetched per session.
  const sessions: KohaSession[] = await Promise.all(
    paidSessions.map(async (session) => {
      const lineItems = await stripe.checkout.sessions.listLineItems(
        session.id,
        { expand: ["data.price.product"], limit: 100 }
      );
      return {
        id: session.id,
        amountTotal: session.amount_total,
        currency: session.currency,
        paymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null),
        productNames: lineItems.data
          .map(productName)
          .filter((name): name is string => name !== null),
      };
    })
  );

  // 2. Succeeded PaymentIntents in the window (pay-at-table flow).
  const paymentIntents: KohaPaymentIntent[] = [];
  for await (const pi of stripe.paymentIntents.list({ created, limit: 100 })) {
    if (pi.status !== "succeeded") continue;
    paymentIntents.push({
      id: pi.id,
      amountReceived: pi.amount_received,
      currency: pi.currency,
      description: pi.description,
    });
  }

  return sumNightKoha({ sessions, paymentIntents }, location);
}
