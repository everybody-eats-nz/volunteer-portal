// Client-safe types for milestone analytics segments. Kept separate from
// `@/lib/milestone-analytics` so client components can import without pulling
// Prisma into the bundle.

export const MILESTONE_DISTRIBUTION_BANDS = [
  "d_1_9",
  "d_10_24",
  "d_25_49",
  "d_50_99",
  "d_100_199",
  "d_200_499",
  "d_500_plus",
] as const;
export type MilestoneDistributionBand =
  (typeof MILESTONE_DISTRIBUTION_BANDS)[number];

export const DISTRIBUTION_BAND_LABEL: Record<MilestoneDistributionBand, string> =
  {
    d_1_9: "1–9 shifts",
    d_10_24: "10–24 shifts",
    d_25_49: "25–49 shifts",
    d_50_99: "50–99 shifts",
    d_100_199: "100–199 shifts",
    d_200_499: "200–499 shifts",
    d_500_plus: "500+ shifts",
  };

export type MilestoneSegment =
  | {
      chart: "milestoneHits";
      threshold: number;
      location: string;
    }
  | {
      chart: "milestoneDistribution";
      band: MilestoneDistributionBand;
      location: string;
    }
  | {
      chart: "milestoneProjections";
      threshold: number;
      location: string;
    };

export interface MilestoneSegmentUser {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  profilePhotoUrl: string | null;
  defaultLocation: string | null;
  totalShifts: number;
  /** Average shifts per month over the last 6 months (projections only) */
  monthlyRate: number | null;
  /** Months until they hit the threshold at current rate (projections only) */
  projectedMonths: number | null;
  /** ISO date the user crossed the threshold (milestoneHits only) */
  achievedAt: string | null;
}

export interface MilestoneSegmentResult {
  users: MilestoneSegmentUser[];
  total: number;
  cap: number;
}
