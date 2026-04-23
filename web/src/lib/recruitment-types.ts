// Client-safe recruitment analytics types. Kept in a separate module from
// `@/lib/recruitment` so client components can import these without pulling
// Prisma (and its transitive `pg` dependency) into the client bundle.

// "Unspecified" bucket for users with no defaultLocation set.
export const UNSPECIFIED_LOCATION = "Unspecified";

export interface RecruitmentFunnelBreakdown {
  location: string;
  totalRegistrations: number;
  incompleteProfiles: number;
  completedProfileNoSignup: number;
  signedUpNoShift: number;
  completedShift: number;
  sameDay: number;
  within3Days: number;
  within7Days: number;
  within14Days: number;
  within30Days: number;
  within60Days: number;
  within90Days: number;
  over90Days: number;
}

export interface RecruitmentFunnel {
  totalRegistrations: number;
  /** Registered but profileCompleted = false */
  incompleteProfiles: number;
  /** profileCompleted = true, zero signups ever */
  completedProfileNoSignup: number;
  /** Has at least one signup record, but zero confirmed shifts */
  signedUpNoShift: number;
  /** Has at least one confirmed completed shift */
  completedShift: number;
  /** Average days from registration to first completed shift (null if no data) */
  avgDaysToFirstShift: number | null;
  sameDay: number; // 0 days
  within3Days: number; // 1–3 days
  within7Days: number; // 4–7 days
  within14Days: number; // 8–14 days
  within30Days: number; // 15–30 days
  within60Days: number; // 31–60 days
  within90Days: number; // 61–90 days
  over90Days: number; // 91+ days
  /** Per-location breakdown of all funnel/time-to-first-shift counts. */
  byLocation: RecruitmentFunnelBreakdown[];
}

export interface RecruitmentTrendPoint {
  month: string;
  /** Total across all locations for this month */
  count: number;
  /** Location name → count for that month */
  byLocation: Record<string, number>;
}

export interface RecruitmentData {
  funnel: RecruitmentFunnel;
  /** 12-month rolling monthly registration counts (filled with 0 for empty months) */
  registrationTrend: RecruitmentTrendPoint[];
  /**
   * Distinct location names seen anywhere in the returned data, in stable
   * alphabetical order with "Unspecified" pinned last. Used by the UI to render
   * one chart series per restaurant.
   */
  locations: string[];
}
