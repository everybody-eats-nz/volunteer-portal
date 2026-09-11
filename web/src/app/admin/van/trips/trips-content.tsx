"use client";

import { useMemo, useState } from "react";

import { downloadCsv, toCsv } from "@/lib/csv";
import type { ExceptionKind, Severity } from "@/lib/van/exceptions";
import {
  inPeriod,
  monthLabel,
  monthsCovered,
  periodLabel,
  periodSlug,
  shiftMonth,
  type Period,
} from "@/lib/van/period";
import { assignShareHues, shareOf } from "@/lib/van/share";
import { LedgerHead } from "./ledger-head";
import { PeriodBar } from "./period-bar";
import { TripDetail } from "./trip-detail";
import { TripLedger } from "./trip-ledger";
import {
  EMPTY_FILTERS,
  TripFilterBar,
  type TripFilterOptions,
  type TripFilters,
} from "./trip-filters";

export type { TripFilterOptions };

export interface TripFlag {
  kind: ExceptionKind;
  label: string;
  severity: Severity;
  detail: string;
}

export interface AdminTripRow {
  id: string;
  /** "3 Sep 2026" */
  date: string;
  /** "Wed 3 Sep" */
  dayLabel: string;
  time: string;
  endTime: string | null;
  dayKey: string;
  monthKey: string;
  durationLabel: string | null;
  vehicleId: string;
  vehicleName: string;
  vehicleRego: string;
  driverId: string;
  driverName: string;
  organisationId: string;
  orgLabel: string;
  purposeId: string | null;
  purposeLabel: string;
  startOdo: number;
  endOdo: number | null;
  /** Where the previous trip in this van left the dial. Null for the first. */
  previousEndOdo: number | null;
  distanceKm: number | null;
  distanceLabel: string;
  startOdoPhotoUrl: string | null;
  endOdoPhotoUrl: string | null;
  status: "OPEN" | "CLOSED" | "FLAGGED";
  notes: string | null;
  flags: TripFlag[];
}

const nf = new Intl.NumberFormat("en-NZ");

function matchesFilters(row: AdminTripRow, filters: TripFilters): boolean {
  if (filters.vehicleId && row.vehicleId !== filters.vehicleId) return false;
  if (filters.driverId && row.driverId !== filters.driverId) return false;
  if (filters.purposeId && row.purposeId !== filters.purposeId) return false;
  // Matched on the display label so a borrower typed in as free text filters
  // the same way a real organisation does.
  if (filters.orgLabel && row.orgLabel !== filters.orgLabel) return false;
  if (filters.query) {
    const needle = filters.query.trim().toLowerCase();
    const haystack = [
      row.driverName,
      row.vehicleName,
      row.vehicleRego,
      row.orgLabel,
      row.purposeLabel,
      row.notes ?? "",
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export function VanTripsContent({
  rows,
  options,
  initialVehicleId,
  windowed,
}: {
  rows: AdminTripRow[];
  options: TripFilterOptions;
  initialVehicleId: string | null;
  /** The server's trip window filled up, so the record here starts mid-month. */
  windowed: boolean;
}) {
  const months = useMemo(() => {
    const covered = monthsCovered(rows.map((r) => r.dayKey));
    // The oldest month of a full window is only partly loaded, so its total
    // would under-report. A month you cannot open beats a month whose figure is
    // quietly wrong, on the screen the funder's number comes off.
    return windowed && covered.length > 1 ? covered.slice(0, -1) : covered;
  }, [rows, windowed]);

  const [filters, setFilters] = useState<TripFilters>({
    ...EMPTY_FILTERS,
    vehicleId: initialVehicleId ?? "",
  });

  // Arriving from the fleet board with a van already chosen should land on a
  // month that van was actually driven in, not on an empty newest month.
  const [period, setPeriod] = useState<Period>(() => {
    const firstMatch = initialVehicleId
      ? rows.find((row) => row.vehicleId === initialVehicleId)
      : rows[0];
    const month = firstMatch?.monthKey ?? months[0];
    // A van last driven inside the dropped partial month has no month to land
    // on, so it falls back to all time rather than to an empty September.
    return month && months.includes(month)
      ? { mode: "month", month }
      : { mode: "all" };
  });

  const [viewing, setViewing] = useState<AdminTripRow | null>(null);

  const narrowed = useMemo(
    () => rows.filter((row) => matchesFilters(row, filters)),
    [rows, filters]
  );
  const shown = useMemo(
    () => narrowed.filter((row) => inPeriod(row.dayKey, period)),
    [narrowed, period]
  );
  const inPeriodUnfiltered = useMemo(
    () => rows.filter((row) => inPeriod(row.dayKey, period)),
    [rows, period]
  );

  // Hues are assigned over the whole record, so narrowing the view never
  // repaints the organisations that survived the filter.
  const orgHues = useMemo(
    () => assignShareHues(rows, (r) => r.organisationId, (r) => r.orgLabel),
    [rows]
  );
  const purposeHues = useMemo(
    () => assignShareHues(rows, (r) => r.purposeId ?? "none", (r) => r.purposeLabel),
    [rows]
  );

  const shares = useMemo(
    () => ({
      organisation: shareOf(shown, (r) => r.organisationId, (r) => r.orgLabel, orgHues),
      purpose: shareOf(shown, (r) => r.purposeId ?? "none", (r) => r.purposeLabel, purposeHues),
    }),
    [shown, orgHues, purposeHues]
  );

  const figures = useMemo(
    () => ({
      trips: shown.length,
      km: shown.reduce((sum, row) => sum + (row.distanceKm ?? 0), 0),
      daysRun: new Set(shown.map((row) => row.dayKey)).size,
      openTrips: shown.filter((row) => row.status === "OPEN").length,
      needChecking: shown.filter((row) => row.flags.length > 0).length,
    }),
    [shown]
  );

  const comparison = useMemo(() => {
    if (period.mode !== "month") return null;
    const previous = shiftMonth(period.month, -1);
    const previousRows = narrowed.filter((row) => row.monthKey === previous);
    const label = periodLabel({ mode: "month", month: previous }).split(" ")[0];
    if (previousRows.length === 0) return `Nothing was logged in ${label}.`;
    const previousKm = previousRows.reduce((sum, r) => sum + (r.distanceKm ?? 0), 0);
    const delta = Math.round(figures.km - previousKm);
    if (delta === 0) return `The same as ${label}.`;
    return `${nf.format(Math.abs(delta))} km ${
      delta > 0 ? "more than" : "less than"
    } ${label}.`;
  }, [period, narrowed, figures.km]);

  function exportCsv() {
    const csv = toCsv(
      [
        "Trip ID", "Date", "Start time", "End time", "Van", "Rego", "Driver",
        "Organisation", "Purpose", "Start odo (km)", "End odo (km)",
        "Distance (km)", "Start photo", "End photo", "Status", "Notes",
        "Unlogged before (km)", "Exceptions",
      ],
      shown.map((row) => [
        row.id,
        row.date,
        row.time,
        row.endTime ?? "",
        row.vehicleName,
        row.vehicleRego,
        row.driverName,
        row.orgLabel,
        row.purposeLabel,
        row.startOdo,
        row.endOdo ?? "",
        row.distanceKm ?? "",
        row.startOdoPhotoUrl ? "yes" : "missing",
        row.endOdoPhotoUrl ? "yes" : row.status === "OPEN" ? "" : "missing",
        row.status.toLowerCase(),
        row.notes ?? "",
        row.previousEndOdo !== null && row.startOdo > row.previousEndOdo
          ? row.startOdo - row.previousEndOdo
          : "",
        row.flags.map((flag) => flag.label).join("; "),
      ])
    );
    // Named for the period rather than for the day it was downloaded: the file
    // that goes to Meridian says which month it is on the way in.
    downloadCsv(`van-log-${periodSlug(period)}.csv`, csv);
  }

  const isFiltered = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-6" data-testid="van-trips-page">
      <div className="space-y-4 border-b border-border pb-5">
        <PeriodBar
          period={period}
          onChange={setPeriod}
          months={months}
          onExport={exportCsv}
          exportDisabled={shown.length === 0}
        />
        <TripFilterBar filters={filters} onChange={setFilters} options={options} />
        {windowed && (
          <p className="text-[13px] text-muted-foreground">
            Only the most recent {nf.format(rows.length)} trips are loaded, so
            anything before {monthLabel(months[months.length - 1] ?? "")} is not
            counted here.
          </p>
        )}
      </div>

      <LedgerHead
        periodLabel={periodLabel(period)}
        figures={figures}
        comparison={comparison}
        shares={shares}
        vanCount={new Set(shown.map((row) => row.vehicleId)).size}
        narrowedFrom={isFiltered ? inPeriodUnfiltered.length : null}
      />

      <TripLedger rows={shown} onOpen={setViewing} isFiltered={isFiltered} />

      <TripDetail trip={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
