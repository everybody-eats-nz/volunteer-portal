/**
 * Shared milestone thresholds (number of completed shifts).
 *
 * This is a *pure* module — no Prisma/server imports — so it can be safely
 * imported from client components (e.g. the admin roster) as well as the
 * server-side analytics code. `milestone-analytics.ts` re-exports these.
 */

export const MILESTONE_THRESHOLDS = [10, 25, 50, 100, 200, 500] as const;
export type MilestoneThreshold = (typeof MILESTONE_THRESHOLDS)[number];

export interface MilestoneStatus {
  /** The next milestone the volunteer is working toward, or null if past the top one. */
  nextThreshold: MilestoneThreshold | null;
  /** Completed shifts still needed to reach `nextThreshold` (0 once reached). */
  shiftsAway: number;
  /**
   * True when completing one more shift lands the volunteer exactly on a
   * milestone — i.e. the shift they're rostered on is their Nth.
   */
  hitsOnNext: boolean;
}

/**
 * Given a volunteer's number of already-completed shifts, describe their
 * progress toward the next milestone.
 *
 * Examples (thresholds 10/25/50/…):
 *  - completed 9  → nextThreshold 10, shiftsAway 1, hitsOnNext true
 *  - completed 24 → nextThreshold 25, shiftsAway 1, hitsOnNext true
 *  - completed 23 → nextThreshold 25, shiftsAway 2, hitsOnNext false
 *  - completed 25 → nextThreshold 50, shiftsAway 25, hitsOnNext false
 *  - completed 500+ → nextThreshold null, shiftsAway 0, hitsOnNext false
 */
export function getMilestoneStatus(completedShifts: number): MilestoneStatus {
  const safeCompleted = Number.isFinite(completedShifts)
    ? Math.max(0, Math.floor(completedShifts))
    : 0;

  const nextThreshold =
    MILESTONE_THRESHOLDS.find((t) => t > safeCompleted) ?? null;

  if (nextThreshold === null) {
    return { nextThreshold: null, shiftsAway: 0, hitsOnNext: false };
  }

  const shiftsAway = nextThreshold - safeCompleted;
  return {
    nextThreshold,
    shiftsAway,
    hitsOnNext: shiftsAway === 1,
  };
}
