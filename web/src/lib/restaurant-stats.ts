/**
 * Derived restaurant service-night figures.
 *
 * These mirror the figures in the WGTN "Numbers" spreadsheet and are computed
 * on read (never stored), so the entry form and any future analytics share one
 * source of truth. Every input is nullable — a figure is `null` whenever the
 * values it depends on are missing.
 */

export interface RestaurantNightInputs {
  /** Customers / people served — the headline count (sheet "customers"). */
  customers?: number | null;
  /** Customers who didn't pay koha (observed count; sheet "non paying no."). */
  nonPayingCount?: number | null;
  /** Cash koha in dollars. */
  cash?: number | null;
  /** Eftpos koha in dollars. */
  eftpos?: number | null;
  /** Stripe koha in dollars. */
  stripe?: number | null;
}

const isNum = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** Non-paying ratio = non-paying count / customers (0–1). */
export function computeNonPayingRatio(
  nonPayingCount?: number | null,
  customers?: number | null
): number | null {
  if (!isNum(nonPayingCount) || !isNum(customers) || customers === 0) {
    return null;
  }
  return nonPayingCount / customers;
}

/**
 * Total koha = cash + eftpos + quest/stripe. Returns null only when every
 * stream is missing; otherwise missing streams count as zero.
 */
export function computeTotalDonations(
  cash?: number | null,
  eftpos?: number | null,
  stripe?: number | null
): number | null {
  if (!isNum(cash) && !isNum(eftpos) && !isNum(stripe)) return null;
  return (
    (isNum(cash) ? cash : 0) +
    (isNum(eftpos) ? eftpos : 0) +
    (isNum(stripe) ? stripe : 0)
  );
}

/** Koha per head = total donations / customers. */
export function computePerHead(
  totalDonations: number | null,
  customers?: number | null
): number | null {
  if (!isNum(totalDonations) || !isNum(customers) || customers === 0) {
    return null;
  }
  return totalDonations / customers;
}

/** Koha per paying customer = total donations / (customers − non-paying). */
export function computePerPaying(
  totalDonations: number | null,
  customers?: number | null,
  nonPayingCount?: number | null
): number | null {
  if (!isNum(totalDonations) || !isNum(customers)) return null;
  const paying = customers - (isNum(nonPayingCount) ? nonPayingCount : 0);
  if (paying <= 0) return null;
  return totalDonations / paying;
}

/** Compute all derived figures for a night in one call. */
export function computeNightDerived(input: RestaurantNightInputs) {
  const totalDonations = computeTotalDonations(
    input.cash,
    input.eftpos,
    input.stripe
  );
  return {
    nonPayingRatio: computeNonPayingRatio(input.nonPayingCount, input.customers),
    totalDonations,
    perHead: computePerHead(totalDonations, input.customers),
    perPaying: computePerPaying(
      totalDonations,
      input.customers,
      input.nonPayingCount
    ),
  };
}
