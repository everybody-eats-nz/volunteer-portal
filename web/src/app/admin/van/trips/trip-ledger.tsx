"use client";

import { ArrowRight, TriangleAlert } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusPill } from "@/components/van/van-chrome";
import { OdoPhoto } from "@/components/van/odo-photo";
import { formatOdo } from "@/lib/van/format";
import { cn } from "@/lib/utils";
import type { AdminTripRow } from "./trips-content";

/**
 * The ledger.
 *
 * This replaces a paper Collins log book, and it keeps the two things that made
 * the book auditable. Trips are ruled off by day and each day carries its own
 * total, so a figure can be checked against one page rather than against a
 * running sum. And the odometer is set as a chain — where the previous trip in
 * that van left the dial, then where this one started and finished — because
 * the whole audit is whether the column runs continuously. Where it does not,
 * the row says so, using the same rules as the exceptions view.
 */

const nf = new Intl.NumberFormat("en-NZ");

export function TripLedger({
  rows,
  onOpen,
  isFiltered,
}: {
  rows: AdminTripRow[];
  onOpen: (row: AdminTripRow) => void;
  isFiltered: boolean;
}) {
  const days = groupByDay(rows);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <Th>Time</Th>
            <Th className="hidden lg:table-cell">Van</Th>
            <Th className="hidden xl:table-cell">Driver</Th>
            <Th className="hidden lg:table-cell">For</Th>
            <Th className="hidden xl:table-cell">Purpose</Th>
            <Th className="hidden text-right xl:table-cell">Odometer</Th>
            <Th className="text-right">Distance</Th>
            <Th className="text-right">Photos</Th>
          </TableRow>
        </TableHeader>
        <TableBody>
          {days.map((day) => (
            <DaySection key={day.key} day={day} onOpen={onOpen} />
          ))}
        </TableBody>
      </Table>

      {rows.length === 0 && (
        <div className="px-6 py-16 text-center">
          <p className="font-accent text-lg font-semibold">No trips here</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            {isFiltered
              ? "Nothing in this period matches what you have narrowed to. Drop a filter above, or step to another month."
              : "Nothing was logged in this period. Step to another month, or switch to all time."}
          </p>
        </div>
      )}
    </div>
  );
}

interface Day {
  key: string;
  label: string;
  km: number;
  rows: AdminTripRow[];
}

function groupByDay(rows: AdminTripRow[]): Day[] {
  const days: Day[] = [];
  for (const row of rows) {
    let day = days[days.length - 1];
    if (!day || day.key !== row.dayKey) {
      day = { key: row.dayKey, label: row.dayLabel, km: 0, rows: [] };
      days.push(day);
    }
    day.rows.push(row);
    day.km += row.distanceKm ?? 0;
  }
  return days;
}

function DaySection({ day, onOpen }: { day: Day; onOpen: (row: AdminTripRow) => void }) {
  return (
    <>
      {/* Ruled off by day, the way the book was, with the day's own total in
          the margin. Announced as a row so the table still reads in order. */}
      <TableRow className="border-b-0 hover:bg-transparent">
        <TableCell colSpan={8} className="bg-muted/40 px-4 py-2">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-accent text-[15px] font-semibold">
              {day.label}
            </span>
            <span className="text-[13px] tabular-nums text-muted-foreground">
              {day.rows.length} {day.rows.length === 1 ? "trip" : "trips"}
              {day.km > 0 && `, ${nf.format(Math.round(day.km))} km`}
            </span>
          </div>
        </TableCell>
      </TableRow>

      {day.rows.map((row) => (
        <TripRow key={row.id} row={row} onOpen={onOpen} />
      ))}
    </>
  );
}

function TripRow({
  row,
  onOpen,
}: {
  row: AdminTripRow;
  onOpen: (row: AdminTripRow) => void;
}) {
  const worst = row.flags.some((f) => f.severity === "high")
    ? "high"
    : row.flags.length > 0
      ? "medium"
      : null;

  return (
    <>
    <TableRow
      onClick={() => onOpen(row)}
      data-testid={`van-trip-row-${row.id}`}
      className={cn(
        "cursor-pointer",
        // Marginalia: a rule down the edge of a row the office has to look at,
        // never the only signal — the annotation underneath says what is wrong
        // in words, so the colour is reinforcement rather than the message.
        worst && "border-b-0",
        worst === "high" &&
          "bg-red-50/60 shadow-[inset_3px_0_0_0_var(--color-red-500)] dark:bg-red-400/[0.06]",
        worst === "medium" &&
          "bg-amber-50/50 shadow-[inset_3px_0_0_0_var(--color-amber-400)] dark:bg-amber-400/[0.05]"
      )}
    >
      <TableCell className="py-3 align-top whitespace-normal">
        {/* On a phone the columns to the right of this one are gone, so the van
            and who it was out for fold into the time rather than scrolling off
            the edge where nobody finds them. It wraps: a long borrower name
            must not be what pushes the distance off the screen. */}
        <div className="whitespace-nowrap font-medium tabular-nums">
          {row.time}
        </div>
        <div className="whitespace-nowrap text-[12px] tabular-nums text-muted-foreground">
          {row.endTime ? `to ${row.endTime}` : "not ended"}
        </div>
        <div className="mt-1 text-[13px] leading-snug lg:hidden">
          <span className="font-medium">{row.vehicleName}</span>
          <span className="text-muted-foreground"> for {row.orgLabel}</span>
        </div>
      </TableCell>

      <TableCell className="hidden whitespace-nowrap py-3 align-top font-medium lg:table-cell">
        {row.vehicleName}
      </TableCell>

      <TableCell className="hidden whitespace-nowrap py-3 align-top xl:table-cell">
        {row.driverName}
      </TableCell>

      <TableCell className="hidden whitespace-normal py-3 align-top lg:table-cell">
        {row.orgLabel}
      </TableCell>

      <TableCell className="hidden whitespace-normal py-3 align-top text-muted-foreground xl:table-cell">
        {row.purposeLabel}
      </TableCell>

      <TableCell className="hidden py-3 align-top xl:table-cell">
        <OdoChain row={row} />
      </TableCell>

      <TableCell className="whitespace-nowrap py-3 text-right align-top font-semibold tabular-nums">
        {row.distanceLabel}
      </TableCell>

      <TableCell className="py-3 align-top">
        {/* The only reason to keep a photo is so the recorded number can be
            held against the picture, so the thumbnails open both at a size you
            can actually read, alongside the rest of the record. */}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(row);
          }}
          aria-label={`Open the ${row.vehicleName} trip at ${row.time} on ${row.date}`}
          data-testid={`van-trip-photos-${row.id}`}
          className="ml-auto flex items-center gap-1 rounded-lg p-1 transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        >
          <Thumb url={row.startOdoPhotoUrl} reading={row.startOdo} />
          <Thumb
            url={row.endOdoPhotoUrl}
            reading={row.endOdo}
            open={row.status === "OPEN"}
          />
        </button>
      </TableCell>
    </TableRow>

    {worst && (
      <TableRow
        onClick={() => onOpen(row)}
        className={cn(
          "cursor-pointer border-b",
          worst === "high"
            ? "bg-red-50/60 shadow-[inset_3px_0_0_0_var(--color-red-500)] dark:bg-red-400/[0.06]"
            : "bg-amber-50/50 shadow-[inset_3px_0_0_0_var(--color-amber-400)] dark:bg-amber-400/[0.05]"
        )}
      >
        <TableCell colSpan={8} className="whitespace-normal px-4 pb-3 pt-0">
          <ul
            className={cn(
              "space-y-0.5 text-[13px] leading-snug",
              worst === "high"
                ? "text-red-800 dark:text-red-200"
                : "text-amber-900 dark:text-amber-200"
            )}
          >
            {row.flags.map((flag) => (
              <li key={flag.kind} className="flex gap-1.5">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  <span className="font-semibold">{flag.label}.</span>{" "}
                  <span className="opacity-80">{flag.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </TableCell>
      </TableRow>
    )}
    </>
  );
}

/**
 * The odometer as a chain. The break, where there is one, is the point: a gap
 * means the van moved with nobody logged in, and a reading that drops means one
 * of the two numbers was mistyped.
 */
function OdoChain({ row }: { row: AdminTripRow }) {
  const carried =
    row.previousEndOdo !== null ? row.startOdo - row.previousEndOdo : null;

  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-1.5 tabular-nums">
        <span className="text-muted-foreground">{formatOdo(row.startOdo)}</span>
        <ArrowRight className="size-3 shrink-0 text-muted-foreground/60" aria-hidden />
        {row.endOdo !== null ? (
          <span className="font-medium">{formatOdo(row.endOdo)}</span>
        ) : (
          <StatusPill tone="out">Open</StatusPill>
        )}
      </div>
      {carried !== null && carried !== 0 && (
        <div
          className={cn(
            "mt-0.5 text-[12px] tabular-nums",
            carried < 0
              ? "text-red-700 dark:text-red-300"
              : "text-amber-700 dark:text-amber-400"
          )}
        >
          {carried > 0
            ? `${nf.format(carried)} km unlogged before this`
            : `starts ${nf.format(Math.abs(carried))} km below the last reading`}
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TableHead className={cn("h-9 text-[13px] font-medium", className)}>
      {children}
    </TableHead>
  );
}

function Thumb({
  url,
  reading,
  open,
}: {
  url: string | null;
  reading: number | null;
  open?: boolean;
}) {
  if (!url) {
    return (
      <span
        className={cn(
          "grid h-8 w-11 place-items-center rounded text-[10px] font-semibold",
          open
            ? "bg-muted text-muted-foreground"
            : "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300"
        )}
        title={open ? "Trip still open" : "No photo recorded"}
      >
        {open ? "–" : "none"}
      </span>
    );
  }
  return (
    <OdoPhoto
      url={url}
      reading={reading}
      className="h-8 w-11 overflow-hidden rounded ring-1 ring-inset ring-border"
    />
  );
}
