import { formatNZT } from "@/lib/dates";
import type { Shift } from "@/lib/dummy-data";

/**
 * Client-side shift signup eligibility — mirrors the web app's pre-emptive
 * checks (web/src/lib/concurrent-shifts.ts + the signup gating in
 * shift-details-content.tsx) so the mobile UI can disable the signup CTA
 * before a doomed request instead of only surfacing a server error.
 *
 * The server (POST /api/mobile/shifts/[id]/signup) remains the source of
 * truth and re-runs every check — these helpers are a UX layer only.
 */

/** Hour cutoff (NZ time): shifts starting before 4pm are "Day", at/after are "Evening". */
const DAY_EVENING_CUTOFF_HOUR = 16;

export type ShiftPeriod = "DAY" | "EVENING";

/** Calendar day key (YYYY-MM-DD) in NZ time — matches web's getShiftDate. */
export function getShiftDayKey(start: string | Date): string {
  return formatNZT(start, "yyyy-MM-dd");
}

/** Whether a shift falls in the day period (before 4pm NZ) — matches web's isAMShift. */
export function getShiftPeriod(start: string | Date): ShiftPeriod {
  const hour = Number(formatNZT(start, "H"));
  return hour < DAY_EVENING_CUTOFF_HOUR ? "DAY" : "EVENING";
}

/** Lowercase label for the period, for inline copy ("day" / "evening"). */
export function getShiftPeriodLabel(start: string | Date): string {
  return getShiftPeriod(start) === "DAY" ? "day" : "evening";
}

/**
 * A volunteer may hold at most one Day and one Evening shift per NZ calendar
 * day. Returns the already-booked shift that clashes with `target`, or null.
 *
 * Only CONFIRMED/PENDING signups count as conflicts, matching the server's
 * conflict query — WAITLISTED and REGULAR_PENDING do not block signup.
 */
export function findConflictingShift(
  target: Pick<Shift, "id" | "start">,
  myShifts: Shift[]
): Shift | null {
  const targetDay = getShiftDayKey(target.start);
  const targetPeriod = getShiftPeriod(target.start);

  return (
    myShifts.find(
      (s) =>
        s.id !== target.id &&
        (s.status === "CONFIRMED" || s.status === "PENDING") &&
        getShiftDayKey(s.start) === targetDay &&
        getShiftPeriod(s.start) === targetPeriod
    ) ?? null
  );
}
