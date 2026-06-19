import Stripe from "stripe";

/**
 * Stripe API client — lazily initialised so importing this module never throws
 * when no key is configured (the sync feature degrades gracefully instead).
 *
 * Use a **restricted, read-only** key. The service-night koha sync only needs
 * read access to Checkout Sessions, PaymentIntents, and Products/Prices.
 */
let client: Stripe | null = null;

/** True when a Stripe secret key is present in the environment. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Returns the singleton Stripe client. Throws if the key is missing — callers
 * should gate on {@link isStripeConfigured} first and surface a friendly error.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!client) {
    // apiVersion intentionally omitted — pinned by the installed SDK version.
    client = new Stripe(key, {
      typescript: true,
      appInfo: { name: "everybody-eats-volunteer-portal" },
    });
  }
  return client;
}
