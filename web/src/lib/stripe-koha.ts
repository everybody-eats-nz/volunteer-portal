/**
 * Pure helpers for attributing Stripe payments to an EE service night.
 *
 * EE runs a single Stripe account, so a location can't be filtered server-side.
 * Instead the location name is embedded as text in two flows, both of which
 * reduce to "a string that contains the location name":
 *
 *  1. Donations — a product per restaurant, e.g. the line item's product name
 *     "You're supporting Everybody Eats – Wellington" (en-dash).
 *  2. Pay-at-table — a PaymentIntent whose `description` is
 *     "Everybody Eats — Wellington" (em-dash).
 *
 * These helpers contain no network calls so they can be unit-tested in isolation
 * (mirrors restaurant-stats.ts). The sync service in services/stripe-koha-sync.ts
 * fetches the raw Stripe objects and feeds plain shapes in here.
 */

const NZD = "nzd";

/** Normalise a label for matching: lowercase, dashes → '-', collapse whitespace. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[–—]/g, "-") // en-dash, em-dash → hyphen
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when `text` (a product name or PaymentIntent description) names the given
 * location. Dash style, casing, and spacing are normalised on both sides, so
 * "…Everybody Eats – Wellington" and "Everybody Eats — Wellington" both match
 * the location "Wellington", while "…- Special events" matches no real location.
 */
export function matchesLocation(
  text: string | null | undefined,
  location: string
): boolean {
  if (!text || !location) return false;
  return normalize(text).includes(normalize(location));
}

/** Stripe minor units (cents) → dollars. NZD has 2 decimals. */
export function centsToDollars(amount: number): number {
  return amount / 100;
}

/** A paid Checkout Session, flattened to the fields koha attribution needs. */
export interface KohaSession {
  id: string;
  /** Session total in cents (Stripe `amount_total`). */
  amountTotal: number | null;
  currency: string | null;
  /** Underlying PaymentIntent id — used to dedupe against the PI pass. */
  paymentIntentId: string | null;
  /** Product names resolved from the session's line items. */
  productNames: string[];
}

/** A succeeded PaymentIntent (the pay-at-table flow), flattened. */
export interface KohaPaymentIntent {
  id: string;
  /** Captured amount in cents (Stripe `amount_received`). */
  amountReceived: number;
  currency: string | null;
  description: string | null;
}

export interface NightKohaInput {
  /** Every paid Checkout Session in the night's window (all locations). */
  sessions: KohaSession[];
  /** Every succeeded PaymentIntent in the night's window (all locations). */
  paymentIntents: KohaPaymentIntent[];
}

export interface NightKohaResult {
  totalCents: number;
  /** Total koha in dollars. */
  total: number;
  /** Number of payments (sessions + intents) attributed to the location. */
  paymentCount: number;
}

/**
 * Sum the koha for one location from already-fetched Stripe objects.
 *
 * Dedupe: a donation creates both a Checkout Session and a PaymentIntent, so
 * every session's `paymentIntentId` is collected first and any PaymentIntent in
 * that set is skipped — only standalone pay-at-table intents survive the PI pass.
 * Non-NZD payments are ignored.
 */
export function sumNightKoha(
  input: NightKohaInput,
  location: string
): NightKohaResult {
  let totalCents = 0;
  let paymentCount = 0;

  // Collect PI ids from ALL paid sessions (every location) before matching, so a
  // donation's intent can never be double-counted by the PaymentIntent pass.
  const sessionPaymentIntentIds = new Set<string>();
  for (const s of input.sessions) {
    if (s.paymentIntentId) sessionPaymentIntentIds.add(s.paymentIntentId);
  }

  for (const s of input.sessions) {
    if (s.amountTotal == null) continue;
    if (s.currency && s.currency.toLowerCase() !== NZD) continue;
    if (!s.productNames.some((name) => matchesLocation(name, location))) continue;
    totalCents += s.amountTotal;
    paymentCount += 1;
  }

  for (const pi of input.paymentIntents) {
    if (sessionPaymentIntentIds.has(pi.id)) continue; // counted via its session
    if (pi.currency && pi.currency.toLowerCase() !== NZD) continue;
    if (!matchesLocation(pi.description, location)) continue;
    totalCents += pi.amountReceived;
    paymentCount += 1;
  }

  return { totalCents, total: centsToDollars(totalCents), paymentCount };
}
