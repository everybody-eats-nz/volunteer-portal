"use client";

import { useState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ShareSegment } from "@/lib/van/share";

const nf = new Intl.NumberFormat("en-NZ");

/**
 * The head of the ledger: the month's kilometres, what makes them trustworthy,
 * and who they were driven for.
 *
 * This is the one place on the screen allowed to be loud. The funder's question
 * is "how much, and for whom", and until now the answer lived nowhere in the
 * portal — the office worked it out in a spreadsheet after exporting. Everything
 * below this stays quiet and ruled so the number keeps the attention.
 */

export interface LedgerFigures {
  trips: number;
  km: number;
  daysRun: number;
  openTrips: number;
  needChecking: number;
}

export function LedgerHead({
  periodLabel,
  figures,
  comparison,
  shares,
  vanCount,
  narrowedFrom,
}: {
  periodLabel: string;
  figures: LedgerFigures;
  /** Prose against the period before this one. Null outside month mode. */
  comparison: string | null;
  shares: { organisation: ShareSegment[]; purpose: ShareSegment[] };
  vanCount: number;
  /** Trips in the period before the filters. Null when nothing is filtered. */
  narrowedFrom: number | null;
}) {
  // "2 of 140 trips in all time" is not a sentence anybody says.
  const within = periodLabel === "All time" ? "" : ` in ${periodLabel.toLowerCase()}`;

  return (
    <section
      aria-label={`${periodLabel} summary`}
      data-testid="van-trips-ledger-head"
      className="space-y-7"
    >
      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
      <div data-testid="van-trips-summary">
        <p className="flex items-baseline gap-2">
          <span
            className="display display-medium text-[3.25rem] leading-[0.95] tabular-nums text-forest-600 dark:text-forest-100 sm:text-[4rem]"
            data-testid="van-trips-total-km"
          >
            {nf.format(Math.round(figures.km))}
          </span>
          <span className="text-xl font-medium text-muted-foreground">km</span>
        </p>
        <p className="mt-2 text-[15px] leading-snug text-muted-foreground">
          {figures.trips === 0
            ? `Nothing was logged${within}.`
            : narrowedFrom !== null
              ? `${nf.format(figures.trips)} of ${nf.format(
                  narrowedFrom
                )} trips${within}, after the filters.`
              : `${nf.format(figures.trips)} ${
                  figures.trips === 1 ? "trip" : "trips"
                } across ${vanCount === 1 ? "one van" : `${vanCount} vans`}.`}
          {comparison && <> {comparison}</>}
        </p>

      </div>

      <SharePanel shares={shares} hasDistance={figures.km > 0} />
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-4">
        <Figure label="Days the vans ran" value={nf.format(figures.daysRun)} />
        <Figure
          label="Still open"
          value={nf.format(figures.openTrips)}
          tone={figures.openTrips > 0 ? "warn" : undefined}
        />
        <Figure
          label={figures.needChecking === 1 ? "Trip to check" : "Trips to check"}
          value={nf.format(figures.needChecking)}
          tone={figures.needChecking > 0 ? "alert" : undefined}
          href={figures.needChecking > 0 ? "/admin/van/exceptions" : undefined}
        />
        <Figure
          label="Average trip"
          value={
            figures.trips > 0
              ? `${nf.format(Math.round(figures.km / figures.trips))} km`
              : "–"
          }
        />
      </dl>
    </section>
  );
}

function Figure({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: string;
  tone?: "warn" | "alert";
  href?: string;
}) {
  const body = (
    <>
      <dt className="text-[13px] leading-tight text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          tone === "warn" && "text-amber-700 dark:text-amber-300",
          tone === "alert" && "text-red-700 dark:text-red-300"
        )}
      >
        {tone === "alert" && (
          <TriangleAlert className="mr-1 inline size-4 align-[-2px]" aria-hidden />
        )}
        {value}
      </dd>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="bg-card px-4 py-3 transition-colors hover:bg-primary/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        {body}
      </Link>
    );
  }
  return <div className="bg-card px-4 py-3">{body}</div>;
}

/* -------------------------------------------------------------------------- */
/*  The split                                                                 */
/* -------------------------------------------------------------------------- */

type Split = "organisation" | "purpose";

const SPLIT_HEADINGS: Record<Split, string> = {
  organisation: "Who the kilometres were for",
  purpose: "What they were driven for",
};

function SharePanel({
  shares,
  hasDistance,
}: {
  shares: Record<Split, ShareSegment[]>;
  hasDistance: boolean;
}) {
  const [split, setSplit] = useState<Split>("organisation");
  const segments = shares[split];

  return (
    <div data-testid="van-trips-share">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="font-accent text-lg font-semibold">
          {SPLIT_HEADINGS[split]}
        </h2>
        <div
          role="tablist"
          aria-label="Split the kilometres by"
          className="flex gap-1 rounded-full bg-muted p-0.5"
        >
          {(["organisation", "purpose"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={split === option}
              onClick={() => setSplit(option)}
              data-testid={`van-trips-share-${option}`}
              className={cn(
                "rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
                split === option
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option === "organisation" ? "Who for" : "What for"}
            </button>
          ))}
        </div>
      </div>

      {!hasDistance || segments.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No completed trips to divide up yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {segments.map((segment) => (
            <li key={segment.key}>
              <div className="flex items-baseline gap-2.5 text-sm">
                <span className="min-w-0 truncate font-medium">
                  {segment.label}
                </span>
                <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                  {segment.trips} {segment.trips === 1 ? "trip" : "trips"}
                </span>
                <span className="flex-1" />
                <span className="shrink-0 tabular-nums">
                  {nf.format(Math.round(segment.km))} km
                </span>
                <span className="w-9 shrink-0 text-right tabular-nums text-muted-foreground">
                  {segment.percent > 0 && segment.percent < 1
                    ? "<1%"
                    : `${Math.round(segment.percent)}%`}
                </span>
              </div>
              {/* The fill is the share itself, so the bar and the figure beside
                  it can never tell different stories. */}
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/[0.07]">
                <div
                  className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                  style={{
                    width: `${Math.max(segment.percent, 1)}%`,
                    background: segment.color,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
