import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import { shiftStartNZ } from "@/lib/concurrent-shifts";
import { UNSPECIFIED_LOCATION } from "@/lib/recruitment-types";

/**
 * Thresholds (fraction of capacity filled) used to classify staffing levels.
 * `understaffed` is the superset (< 75% filled) and `criticallyUnderstaffed`
 * is the worst subset of that (< 50% filled).
 */
export const UNDERSTAFFED_THRESHOLD = 0.75;
export const CRITICALLY_UNDERSTAFFED_THRESHOLD = 0.5;

/** Coverage figures for a single restaurant (or "Unspecified"). */
export interface ShiftCoverageRow {
  location: string;
  /** Number of shift slots scheduled in the period. */
  totalShifts: number;
  /** Sum of `capacity` across those shifts (positions offered). */
  totalPositions: number;
  /** Positions filled (capped at capacity), i.e. confirmed + regulars + walk-ins. */
  filledPositions: number;
  /** Shifts with at least one empty position (`filled < capacity`). */
  unfilledShifts: number;
  /** Shifts with nobody signed up (`filled = 0`). */
  fullyEmptyShifts: number;
  /** Shifts under 75% filled (includes critically understaffed). */
  understaffedShifts: number;
  /** Shifts under 50% filled. */
  criticallyUnderstaffedShifts: number;
  /** filledPositions / totalPositions as a 0–100 percentage. */
  fillRate: number;
}

export interface ShiftCoverageData {
  totals: ShiftCoverageRow;
  byLocation: ShiftCoverageRow[];
  periodMonths: number;
}

interface CoverageQueryRow {
  location: string;
  total_shifts: bigint;
  total_positions: bigint;
  filled_positions: bigint;
  unfilled_shifts: bigint;
  fully_empty_shifts: bigint;
  understaffed_shifts: bigint;
  critically_understaffed_shifts: bigint;
}

export function fillRate(filled: number, positions: number): number {
  return positions > 0 ? Math.round((filled / positions) * 100) : 0;
}

/**
 * Roll per-restaurant coverage rows up into an "All Locations" total.
 * Pure helper (no DB) so it can be unit tested independently.
 */
export function computeCoverageTotals(
  byLocation: ShiftCoverageRow[]
): ShiftCoverageRow {
  const totals = byLocation.reduce<ShiftCoverageRow>(
    (acc, row) => {
      acc.totalShifts += row.totalShifts;
      acc.totalPositions += row.totalPositions;
      acc.filledPositions += row.filledPositions;
      acc.unfilledShifts += row.unfilledShifts;
      acc.fullyEmptyShifts += row.fullyEmptyShifts;
      acc.understaffedShifts += row.understaffedShifts;
      acc.criticallyUnderstaffedShifts += row.criticallyUnderstaffedShifts;
      return acc;
    },
    {
      location: "All Locations",
      totalShifts: 0,
      totalPositions: 0,
      filledPositions: 0,
      unfilledShifts: 0,
      fullyEmptyShifts: 0,
      understaffedShifts: 0,
      criticallyUnderstaffedShifts: 0,
      fillRate: 0,
    }
  );
  totals.fillRate = fillRate(totals.filledPositions, totals.totalPositions);
  return totals;
}

/**
 * Restaurant-level shift coverage for the engagement report:
 *  - how many shifts each restaurant ran in the period,
 *  - how many positions were offered vs filled,
 *  - how many shifts went unfilled / understaffed / critically understaffed.
 *
 * "Filled" matches the staffing definition used elsewhere (the shortage
 * endpoint): CONFIRMED + REGULAR_PENDING signups plus walk-in placeholders.
 * The window covers shifts that have already started within the period
 * (`start >= periodStart AND start < now`) so fill rates reflect shifts that
 * actually ran rather than future ones that are still filling up.
 */
export async function getShiftCoverage(
  months: number,
  location: string | null,
  daysFilter: number[] | null = null
): Promise<ShiftCoverageData> {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setMonth(periodStart.getMonth() - months);

  const isLocationFiltered = !!location && location !== "all";
  const locationCond = isLocationFiltered
    ? Prisma.sql`AND sh.location = ${location}`
    : Prisma.empty;
  const daysCond =
    daysFilter && daysFilter.length > 0
      ? Prisma.sql`AND EXTRACT(DOW FROM ${shiftStartNZ()})::int IN (${Prisma.join(
          daysFilter
        )})`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<CoverageQueryRow[]>`
    WITH shift_fill AS (
      SELECT
        COALESCE(NULLIF(sh.location, ''), ${UNSPECIFIED_LOCATION}) AS location,
        sh.capacity AS capacity,
        (
          SELECT COUNT(*) FROM "Signup" sg
          WHERE sg."shiftId" = sh.id
            AND sg.status IN ('CONFIRMED'::"SignupStatus", 'REGULAR_PENDING'::"SignupStatus")
        )
        + (
          SELECT COUNT(*) FROM "ShiftPlaceholder" p
          WHERE p."shiftId" = sh.id
        ) AS filled
      FROM "Shift" sh
      WHERE sh."start" >= ${periodStart}
        AND sh."start" < ${now}
        ${locationCond}
        ${daysCond}
    )
    SELECT
      location,
      COUNT(*)::bigint AS total_shifts,
      COALESCE(SUM(capacity), 0)::bigint AS total_positions,
      COALESCE(SUM(LEAST(filled, capacity)), 0)::bigint AS filled_positions,
      COUNT(*) FILTER (WHERE filled < capacity)::bigint AS unfilled_shifts,
      COUNT(*) FILTER (WHERE filled = 0)::bigint AS fully_empty_shifts,
      COUNT(*) FILTER (
        WHERE capacity > 0 AND filled::float / capacity < ${UNDERSTAFFED_THRESHOLD}
      )::bigint AS understaffed_shifts,
      COUNT(*) FILTER (
        WHERE capacity > 0 AND filled::float / capacity < ${CRITICALLY_UNDERSTAFFED_THRESHOLD}
      )::bigint AS critically_understaffed_shifts
    FROM shift_fill
    GROUP BY location
    ORDER BY location
  `;

  const byLocation: ShiftCoverageRow[] = rows.map((r) => {
    const totalPositions = Number(r.total_positions);
    const filledPositions = Number(r.filled_positions);
    return {
      location: r.location,
      totalShifts: Number(r.total_shifts),
      totalPositions,
      filledPositions,
      unfilledShifts: Number(r.unfilled_shifts),
      fullyEmptyShifts: Number(r.fully_empty_shifts),
      understaffedShifts: Number(r.understaffed_shifts),
      criticallyUnderstaffedShifts: Number(r.critically_understaffed_shifts),
      fillRate: fillRate(filledPositions, totalPositions),
    };
  });

  const totals = computeCoverageTotals(byLocation);

  return { totals, byLocation, periodMonths: months };
}
