export type EngagementStatus = "highly_active" | "active" | "inactive" | "never";

/**
 * Classify a volunteer's engagement level based on their shift history.
 *
 * - "never": 0 completed shifts ever
 * - "inactive": has completed shifts, but none in the selected period
 * - "active": at least 1 shift in the period (but fewer than 2/month avg)
 * - "highly_active": averaging 2+ shifts per month in the period
 */
export function classifyEngagement(
  totalShifts: number,
  shiftsInPeriod: number,
  months: number
): EngagementStatus {
  if (totalShifts === 0) return "never";
  if (shiftsInPeriod === 0) return "inactive";
  const avgPerMonth = shiftsInPeriod / months;
  return avgPerMonth >= 2 ? "highly_active" : "active";
}
