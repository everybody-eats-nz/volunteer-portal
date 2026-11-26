"use client";

import { motion } from "motion/react";
import {
  CalendarCheck,
  CalendarRange,
  Clock,
  Gauge,
  Info,
  Pencil,
  Target,
  TrendingUp,
} from "lucide-react";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import {
  budgetYearLabel,
  ratioToPercent,
  type BudgetStatus,
  type RangeProgress,
} from "@/lib/budget-calculations";
import type { BudgetPeriod } from "@/lib/budget-periods";
import type {
  BudgetTrackingData,
  LocationBudgetSummary,
} from "@/lib/budget-tracking";
import { money0, type ChartTokens } from "../_lib/chart-theme";
import { BudgetProgressBar, StatusPill } from "@/components/budget-status";
import {
  CumulativeChart,
  Figure,
  NightlyChart,
  NightsTable,
  NoBudgetState,
} from "./location-budget-view";
import { UnbudgetedCard } from "./network-budget-view";

/**
 * Week, month and custom-range views. There is no fixed total for a range, so
 * everything is measured against the target for the nights actually held:
 * each night's own nightly target, added up.
 */

type Selected = NonNullable<BudgetTrackingData["selected"]>;

const NOUN: Record<BudgetPeriod["kind"], string> = {
  year: "year",
  month: "month",
  week: "week",
  custom: "period",
};

/** "this week", "that month", "these dates" */
function periodPhrase(period: BudgetPeriod): string {
  if (period.kind === "custom") {
    return period.timing === "past" ? "in those dates" : "in these dates";
  }
  return `${period.timing === "past" ? "that" : "this"} ${NOUN[period.kind]}`;
}

function signedMoney(v: number): string {
  return `${v >= 0 ? "+" : "−"}${money0(Math.abs(v))}`;
}

function rangeHeadline(
  period: BudgetPeriod,
  range: RangeProgress
): { title: string; status: BudgetStatus | null; label: string } {
  if (range.nightsHeld === 0) {
    if (period.timing === "future") {
      return {
        title:
          period.kind === "custom"
            ? "These dates haven't started yet"
            : `This ${NOUN[period.kind]} hasn't started yet`,
        status: null,
        label: "Not started",
      };
    }
    return {
      title: `No service nights banked ${periodPhrase(period)}${period.timing === "current" ? " yet" : ""}`,
      status: null,
      label: "No nights",
    };
  }
  if (range.status === null) {
    return {
      title: `${money0(range.actual)} banked`,
      status: null,
      label: "Not scored",
    };
  }
  const gap = money0(Math.abs(range.variance));
  if (range.status === "green") {
    return {
      title: range.variance > 0.5 ? `${gap} ahead of target` : "Right on target",
      status: "green",
      label: "On target",
    };
  }
  return {
    title: `${gap} behind target`,
    status: range.status,
    label: range.status === "yellow" ? "Slightly behind" : "Behind",
  };
}

/**
 * Koha against the range's target. The bar is scaled to whichever is larger,
 * so a strong week visibly runs past the target notch instead of capping.
 */
function RangeBar({
  range,
  status,
  size = "md",
}: {
  range: RangeProgress;
  status: BudgetStatus | null;
  size?: "sm" | "md";
}) {
  const scale = Math.max(range.scoredActual, range.target);
  const pct = range.ratio !== null ? ratioToPercent(range.ratio) : 0;
  return (
    <BudgetProgressBar
      annualRatio={scale > 0 ? range.scoredActual / scale : 0}
      proRataRatio={scale > 0 ? range.target / scale : 0}
      status={status}
      size={size}
      ariaLabel={`${pct}% of the target for the nights held`}
    />
  );
}

function nightsLabel(n: number): string {
  return `${n} ${n === 1 ? "night" : "nights"}`;
}

// ── All restaurants ──────────────────────────────────────────────────────

export function RangeNetworkView({
  data,
  onOpenLocation,
  onEditBudget,
}: {
  data: BudgetTrackingData;
  onOpenLocation: (location: string) => void;
  onEditBudget: (summary: LocationBudgetSummary) => void;
}) {
  const totals = data.rangeTotals!;
  const { period } = data;
  const counts = totals.statusCounts;

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {totals.budgetedLocations > 0 && (
        <motion.section
          variants={staggerItem}
          className="rounded-xl border bg-card p-5 shadow-sm sm:p-6"
          data-testid="budget-range-summary"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                All restaurants · {period.label}
              </p>
              <h2 className="mt-1 font-accent text-2xl font-semibold leading-tight">
                {totals.nightsHeld === 0 ? (
                  rangeHeadline(period, totals).title
                ) : (
                  <>
                    {money0(totals.actual)}{" "}
                    <span className="text-base font-normal text-muted-foreground">
                      banked against a {money0(totals.target)} target
                    </span>
                  </>
                )}
              </h2>
            </div>
            {totals.status && totals.ratio !== null && (
              <StatusPill
                status={totals.status}
                label={`${ratioToPercent(totals.ratio)}% of target`}
                className="text-sm"
              />
            )}
          </div>
          {totals.nightsHeld > 0 && (
            <div className="mt-4">
              <RangeBar range={totals} status={totals.status} />
              <p className="mt-2 text-xs text-muted-foreground">
                {nightsLabel(totals.nightsHeld)} held across{" "}
                {totals.budgetedLocations}{" "}
                {totals.budgetedLocations === 1 ? "restaurant" : "restaurants"}{" "}
                with a budget · {counts.green} on target, {counts.yellow} close,{" "}
                {counts.red} below
              </p>
            </div>
          )}
        </motion.section>
      )}

      <motion.ul
        variants={staggerItem}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {data.locations.map((summary) => (
          <li key={summary.locationId} className="list-none">
            {summary.range ? (
              <RangeCard
                summary={summary}
                range={summary.range}
                onOpen={() => onOpenLocation(summary.location)}
                onEdit={() => onEditBudget(summary)}
              />
            ) : (
              <UnbudgetedCard
                summary={summary}
                year={data.year}
                onSet={() => onEditBudget(summary)}
              />
            )}
          </li>
        ))}
      </motion.ul>
    </motion.div>
  );
}

function RangeCard({
  summary,
  range,
  onOpen,
  onEdit,
}: {
  summary: LocationBudgetSummary;
  range: RangeProgress;
  onOpen: () => void;
  onEdit: () => void;
}) {
  return (
    <article
      className="group relative flex h-full flex-col rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
      data-testid={`budget-range-card-${summary.location}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 cursor-pointer flex-col gap-4 rounded-xl p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Open ${summary.location} budget tracking`}
      >
        <div className="flex items-start justify-between gap-2 pr-9">
          <h3 className="font-accent text-lg font-semibold leading-tight">
            {summary.location}
          </h3>
          <StatusPill
            status={range.status}
            label={
              range.ratio !== null
                ? `${ratioToPercent(range.ratio)}% of target`
                : range.nightsHeld > 0
                  ? "Not scored"
                  : "No nights yet"
            }
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span>
              <span className="font-semibold tabular-nums">
                {money0(range.actual)}
              </span>{" "}
              <span className="text-muted-foreground">
                of {money0(range.target)} target
              </span>
            </span>
          </div>
          <RangeBar range={range} status={range.status} size="sm" />
        </div>

        <dl className="mt-auto grid grid-cols-3 gap-3 border-t pt-3">
          <Stat
            label="Variance"
            value={range.scoredNights > 0 ? signedMoney(range.variance) : "—"}
          />
          <Stat
            label="Avg / night"
            value={
              range.avgActualPerNight !== null
                ? money0(range.avgActualPerNight)
                : "—"
            }
          />
          <Stat
            label="Nights"
            value={
              summary.pendingNights > 0
                ? `${range.nightsHeld} + ${summary.pendingNights} unbanked`
                : String(range.nightsHeld)
            }
          />
        </dl>
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3 h-8 w-8 text-muted-foreground"
        onClick={onEdit}
        aria-label={`Edit ${summary.location} budget`}
        data-testid={`budget-range-card-edit-${summary.location}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums" title={value}>
        {value}
      </dd>
    </div>
  );
}

// ── One restaurant ───────────────────────────────────────────────────────

export function RangeLocationView({
  data,
  selected,
  tokens,
  onEditBudget,
  onShowYear,
}: {
  data: BudgetTrackingData;
  selected: Selected;
  tokens: ChartTokens;
  onEditBudget: () => void;
  onShowYear: () => void;
}) {
  const range = selected.range;
  if (!range) {
    return (
      <NoBudgetState
        location={selected.location}
        year={data.year}
        onSet={onEditBudget}
      />
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <motion.div variants={staggerItem}>
        <RangeScoreboard
          data={data}
          summary={selected}
          range={range}
          onEditBudget={onEditBudget}
          onShowYear={onShowYear}
        />
      </motion.div>
      <motion.div variants={staggerItem}>
        <NightlyChart
          nights={selected.nights}
          counts={range.statusCounts}
          tokens={tokens}
          emptyMessage={`No service nights banked ${periodPhrase(data.period)}.`}
          span={data.period}
        />
      </motion.div>
      <motion.div variants={staggerItem}>
        <CumulativeChart
          nights={selected.nights}
          tokens={tokens}
          title="Running total vs target"
          description={`Koha banked across ${data.period.label} against the target for the nights held.`}
          span={data.period}
        />
      </motion.div>
      <motion.div variants={staggerItem}>
        <NightsTable nights={selected.nights} />
      </motion.div>
    </motion.div>
  );
}

function RangeScoreboard({
  data,
  summary,
  range,
  onEditBudget,
  onShowYear,
}: {
  data: BudgetTrackingData;
  summary: LocationBudgetSummary;
  range: RangeProgress;
  onEditBudget: () => void;
  onShowYear: () => void;
}) {
  const { period } = data;
  const head = rangeHeadline(period, range);
  const pct = range.ratio !== null ? ratioToPercent(range.ratio) : null;
  const unscored = range.nightsHeld - range.scoredNights;
  const lift =
    range.avgActualPerNight !== null && range.avgTargetPerNight
      ? range.avgActualPerNight / range.avgTargetPerNight - 1
      : null;
  const year = summary.progress;

  return (
    <section
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
      data-testid="budget-range-scoreboard"
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {summary.location} · {period.label}
              </p>
              <StatusPill status={head.status} label={head.label} />
            </div>
            <h2
              className="mt-1.5 font-accent text-2xl font-semibold leading-tight sm:text-3xl"
              data-testid="budget-range-headline"
            >
              {head.title}
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onEditBudget}
            data-testid="budget-edit-button"
          >
            {summary.budget ? (
              <>
                <Pencil className="h-4 w-4" />
                Edit budget
              </>
            ) : (
              <>
                <Target className="h-4 w-4" />
                Set {budgetYearLabel(data.year)} budget
              </>
            )}
          </Button>
        </div>

        {range.nightsHeld > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
              <p>
                <span className="font-accent text-xl font-semibold tabular-nums">
                  {money0(range.actual)}
                </span>{" "}
                <span className="text-muted-foreground">
                  banked against a {money0(range.target)} target
                </span>
              </p>
              {pct !== null && <p className="font-semibold tabular-nums">{pct}%</p>}
            </div>
            <RangeBar range={range} status={head.status} />
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="h-3 w-0.5 rounded-full bg-foreground" />
                Target for the nights held {money0(range.target)}
              </span>
              <span className="tabular-nums">
                {nightsLabel(range.nightsHeld)} held
              </span>
            </div>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-1 divide-y border-t bg-muted/20 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Figure
          icon={TrendingUp}
          label="Koha vs target"
          value={pct !== null ? `${pct}%` : "—"}
          valueStatus={range.status}
          sub={
            range.scoredNights > 0
              ? `${money0(range.scoredActual)} of ${money0(range.target)} (${signedMoney(range.variance)})`
              : "The target grows with each night held"
          }
          testid="budget-range-figure-ratio"
        />
        <Figure
          icon={Gauge}
          label="Average per night"
          value={
            range.avgActualPerNight !== null ? money0(range.avgActualPerNight) : "—"
          }
          sub={
            range.avgTargetPerNight === null
              ? "No nightly target for these nights"
              : `Nightly target ${money0(range.avgTargetPerNight)}${
                  lift !== null && Math.abs(lift) >= 0.005
                    ? ` · ${lift > 0 ? "+" : "−"}${Math.round(Math.abs(lift) * 100)}%`
                    : ""
                }`
          }
          testid="budget-range-figure-average"
        />
        <Figure
          icon={CalendarCheck}
          label="Nights on target"
          value={
            range.scoredNights > 0
              ? `${range.statusCounts.green} of ${range.scoredNights}`
              : "—"
          }
          sub={
            range.scoredNights > 0
              ? `${range.statusCounts.yellow} close · ${range.statusCounts.red} below`
              : "Each night is scored once koha is banked"
          }
          testid="budget-range-figure-nights"
        />
      </dl>

      {summary.pendingNights > 0 && (
        <p className="flex items-center gap-2 border-t bg-amber-400/10 px-5 py-2.5 text-xs text-amber-800 sm:px-6 dark:text-amber-300">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {summary.pendingNights}{" "}
          {summary.pendingNights === 1 ? "night has" : "nights have"} guests
          recorded but no koha yet, so{" "}
          {summary.pendingNights === 1 ? "it's" : "they're"} left out until
          banked.
        </p>
      )}
      {unscored > 0 && (
        <p className="flex items-center gap-2 border-t px-5 py-2.5 text-xs text-muted-foreground sm:px-6">
          <Info className="h-3.5 w-3.5 shrink-0" />
          {nightsLabel(unscored)} {unscored === 1 ? "falls" : "fall"} in a
          financial year with no budget, so {unscored === 1 ? "it's" : "they're"}{" "}
          counted in koha banked but not scored.
        </p>
      )}

      {year && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-5 py-3 sm:px-6">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarRange className="h-4 w-4 shrink-0" />
            <span>
              {budgetYearLabel(data.year)} so far:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {money0(year.ytdActual)}
              </span>{" "}
              of {money0(year.annualTarget)} budget (
              {ratioToPercent(year.annualRatio ?? 0)}%)
            </span>
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowYear}
            data-testid="budget-range-show-year"
          >
            See the full year
          </Button>
        </div>
      )}
    </section>
  );
}
