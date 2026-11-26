"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  CalendarDays,
  Clock,
  Gauge,
  Pencil,
  PiggyBank,
  TableProperties,
  Target,
  TrendingUp,
} from "lucide-react";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { formatInNZT, parseISOInNZT } from "@/lib/timezone";
import { eachDayOfPeriod } from "@/lib/budget-periods";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  budgetStatus,
  budgetYearLabel,
  dailyTargets,
  ratioToPercent,
  type BudgetProgress,
  type BudgetStatus,
} from "@/lib/budget-calculations";
import type {
  BudgetNight,
  BudgetTrackingData,
  LocationBudgetSummary,
} from "@/lib/budget-tracking";
import {
  ApexChart,
  ChartCard,
  ChartEmpty,
  SegmentedControl,
} from "../_components/primitives";
import {
  baseOptions,
  compactMoney,
  money0,
  num,
  type ChartTokens,
} from "../_lib/chart-theme";
import { BudgetProgressBar, STATUS_META, StatusPill } from "@/components/budget-status";

type Selected = NonNullable<BudgetTrackingData["selected"]>;

/** yyyy-MM-dd → epoch ms at UTC midnight, so datetime axes label the NZ day. */
function dayMs(date: string) {
  return Date.parse(`${date}T00:00:00Z`);
}

const HALF_DAY_MS = 12 * 60 * 60 * 1000;

/**
 * Datetime x-axis labelled by NZ day. With a span (a week, month or custom
 * range) the axis covers every day of it, so quiet nights show as gaps and a
 * short range never falls back to hour ticks.
 */
function dayAxis(tokens: ChartTokens, span?: { start: string; end: string }) {
  return {
    type: "datetime" as const,
    ...(span
      ? { min: dayMs(span.start) - HALF_DAY_MS, max: dayMs(span.end) + HALF_DAY_MS }
      : {}),
    labels: {
      style: tokens.axisStyle,
      datetimeUTC: true,
      datetimeFormatter: { year: "yyyy", month: "MMM yyyy", day: "d MMM" },
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  };
}

function fmtDay(date: string, pattern = "EEE d MMM") {
  return formatInNZT(parseISOInNZT(date), pattern);
}

export function LocationBudgetView({
  data,
  selected,
  tokens,
  onEditBudget,
}: {
  data: BudgetTrackingData;
  selected: Selected;
  tokens: ChartTokens;
  onEditBudget: () => void;
}) {
  const progress = selected.progress;

  if (!progress || !selected.budget) {
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
        <Scoreboard
          data={data}
          summary={selected}
          progress={progress}
          onEditBudget={onEditBudget}
        />
      </motion.div>
      <motion.div variants={staggerItem}>
        <NightlyChart
          nights={selected.nights}
          counts={progress.statusCounts}
          tokens={tokens}
          emptyMessage={`No service nights banked in ${budgetYearLabel(data.year)} yet.`}
        />
      </motion.div>
      <motion.div variants={staggerItem}>
        <CumulativeChart nights={selected.nights} tokens={tokens} />
      </motion.div>
      <motion.div variants={staggerItem}>
        <NightsTable nights={selected.nights} />
      </motion.div>
    </motion.div>
  );
}

export function NoBudgetState({
  location,
  year,
  onSet,
}: {
  location: string;
  year: number;
  onSet: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary-text">
        <Target className="h-6 w-6" />
      </span>
      <div>
        <p className="font-accent text-lg font-semibold">
          No {budgetYearLabel(year)} budget for {location} yet
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Enter the annual koha target and how many service nights are
          planned. Every night is then scored against its share of the budget.
        </p>
      </div>
      <Button onClick={onSet} data-testid="budget-set-button">
        <Target className="h-4 w-4" />
        Set {budgetYearLabel(year)} budget
      </Button>
    </div>
  );
}

// ── Scoreboard ───────────────────────────────────────────────────────────

function headline(
  data: BudgetTrackingData,
  progress: BudgetProgress
): { title: string; status: BudgetStatus | null; label: string } {
  if (progress.budgetMet) {
    return { title: "Budget met. Ka pai!", status: "green", label: "Budget met" };
  }
  if (progress.nightsHeld === 0) {
    return {
      title:
        data.timing === "future"
          ? `${budgetYearLabel(data.year)} hasn't started yet`
          : "No service nights banked yet",
      status: null,
      label: "Not started",
    };
  }
  const gap = money0(Math.abs(progress.ytdVariance));
  const status = progress.ytdStatus!;
  if (data.timing === "past") {
    const pct = ratioToPercent(progress.annualRatio ?? 0);
    return {
      title: `Finished at ${pct}% of budget`,
      status: budgetStatus(progress.ytdActual, progress.annualTarget),
      label: "Year closed",
    };
  }
  if (status === "green") {
    return {
      title:
        progress.ytdVariance > 0.5 ? `${gap} ahead of target` : "Right on target",
      status,
      label: "On track",
    };
  }
  return {
    title: `${gap} behind target`,
    status,
    label: status === "yellow" ? "Slightly behind" : "Behind",
  };
}

function Scoreboard({
  data,
  summary,
  progress,
  onEditBudget,
}: {
  data: BudgetTrackingData;
  summary: LocationBudgetSummary;
  progress: BudgetProgress;
  onEditBudget: () => void;
}) {
  const head = headline(data, progress);
  const annualPct = ratioToPercent(progress.annualRatio ?? 0);
  const proRataRatio =
    progress.annualTarget > 0 ? progress.ytdTarget / progress.annualTarget : 0;
  const isPast = data.timing === "past";

  const needed = progress.avgNeededPerRemaining;
  const neededLift =
    needed !== null && progress.nightlyTarget
      ? needed / progress.nightlyTarget - 1
      : null;

  return (
    <section
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
      data-testid="budget-scoreboard"
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {/* Headline */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {summary.location} · {budgetYearLabel(data.year)}{" "}
                {data.timing === "past" ? "full year" : "year to date"}
              </p>
              <StatusPill status={head.status} label={head.label} />
            </div>
            <h2
              className="mt-1.5 font-accent text-2xl font-semibold leading-tight sm:text-3xl"
              data-testid="budget-headline"
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
            <Pencil className="h-4 w-4" />
            Edit budget
          </Button>
        </div>

        {/* Annual progress */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
            <p>
              <span className="font-accent text-xl font-semibold tabular-nums">
                {money0(progress.ytdActual)}
              </span>{" "}
              <span className="text-muted-foreground">
                banked of {money0(progress.annualTarget)} budget
              </span>
            </p>
            <p className="font-semibold tabular-nums">{annualPct}%</p>
          </div>
          <BudgetProgressBar
            annualRatio={progress.annualRatio ?? 0}
            proRataRatio={proRataRatio}
            status={head.status}
          />
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-3 w-0.5 rounded-full bg-foreground" />
              Pro-rata target {money0(progress.ytdTarget)}
            </span>
            <span className="tabular-nums">
              {progress.nightsHeld} of {progress.plannedServiceNights} planned
              nights held
              {data.timing === "current" &&
                ` · ${ratioToPercent(data.yearElapsedRatio)}% of the year gone`}
            </span>
          </div>
        </div>
      </div>

      {/* Key figures */}
      <dl className="grid grid-cols-1 divide-y border-t bg-muted/20 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Figure
          icon={TrendingUp}
          label={isPast ? "Result vs pro-rata" : "Year to date vs pro-rata"}
          value={progress.ytdRatio !== null ? `${ratioToPercent(progress.ytdRatio)}%` : "—"}
          valueStatus={progress.ytdStatus}
          sub={
            progress.nightsHeld > 0
              ? `${money0(progress.ytdActual)} of ${money0(progress.ytdTarget)} (${progress.ytdVariance >= 0 ? "+" : "−"}${money0(Math.abs(progress.ytdVariance))})`
              : "Pro-rata target grows with each night held"
          }
          testid="budget-figure-ytd"
        />
        {isPast ? (
          <Figure
            icon={PiggyBank}
            label="Final result"
            value={money0(progress.ytdActual)}
            sub={
              progress.budgetMet
                ? `${money0(progress.ytdActual - progress.annualTarget)} over budget`
                : `${money0(progress.remainingTarget)} short of budget`
            }
            testid="budget-figure-needed"
          />
        ) : (
          <Figure
            icon={Gauge}
            label="Needed per remaining service"
            value={
              progress.budgetMet
                ? money0(0)
                : needed === null
                  ? "—"
                  : money0(needed)
            }
            sub={
              progress.budgetMet
                ? "Budget already met"
                : needed === null
                  ? `No planned nights left · ${money0(progress.remainingTarget)} short`
                  : `${money0(progress.remainingTarget)} over ${progress.remainingNights} ${progress.remainingNights === 1 ? "night" : "nights"} · ${
                      neededLift !== null && Math.abs(neededLift) >= 0.005
                        ? `${neededLift > 0 ? "+" : "−"}${Math.round(Math.abs(neededLift) * 100)}% vs nightly target`
                        : "same as nightly target"
                    }`
            }
            testid="budget-figure-needed"
          />
        )}
        <Figure
          icon={Target}
          label={isPast ? "Nightly target" : "Projected year end"}
          value={
            isPast
              ? money0(progress.nightlyTarget ?? 0)
              : progress.nightsHeld > 0
                ? money0(progress.projectedYearEnd)
                : "—"
          }
          sub={
            isPast
              ? `${money0(progress.annualTarget)} over ${progress.plannedServiceNights} planned nights`
              : progress.nightsHeld > 0
                ? `${ratioToPercent(progress.projectedYearEnd / progress.annualTarget)}% of budget at ${money0(progress.avgActualPerNight ?? 0)} a night`
                : `Nightly target ${money0(progress.nightlyTarget ?? 0)}`
          }
          testid="budget-figure-projection"
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
    </section>
  );
}

export function Figure({
  icon: Icon,
  label,
  value,
  valueStatus = null,
  sub,
  testid,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueStatus?: BudgetStatus | null;
  sub: string;
  testid: string;
}) {
  const StatusIcon = valueStatus ? STATUS_META[valueStatus].icon : null;
  return (
    <div className="min-w-0 px-5 py-4 sm:px-6" data-testid={testid}>
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-1.5">
        <span className="flex items-center gap-2">
          <span className="font-accent text-3xl font-semibold tabular-nums leading-none">
            {value}
          </span>
          {valueStatus && StatusIcon && (
            <StatusIcon
              className={cn(
                "h-5 w-5",
                valueStatus === "green" && "text-emerald-600 dark:text-emerald-400",
                valueStatus === "yellow" && "text-yellow-600 dark:text-yellow-400",
                valueStatus === "red" && "text-red-600 dark:text-red-400"
              )}
              aria-label={STATUS_META[valueStatus].label}
            />
          )}
        </span>
        <span className="mt-1.5 block text-xs leading-snug text-muted-foreground">
          {sub}
        </span>
      </dd>
    </div>
  );
}

// ── Charts ───────────────────────────────────────────────────────────────

/** The nightly targets in play: one for a single year, more across 1 April. */
function distinctTargets(nights: BudgetNight[]): number[] {
  return Array.from(
    new Set(
      nights.flatMap((n) => (n.target === null ? [] : [Math.round(n.target * 100) / 100]))
    )
  );
}

/** Short ranges get a slot for every day; longer ones plot nights held only. */
const MAX_DAILY_SLOTS = 62;

interface DaySlot {
  date: string;
  /**
   * Category key: "Mon 20 Jul". Not the ISO date, which ApexCharts would
   * parse into a timestamp and hand the label formatter instead.
   */
  key: string;
  night: BudgetNight | null;
  /** The target in force that day, carried across nights off for the step line. */
  target: number | null;
}

/**
 * The x positions of the nightly chart. A week or month gets one evenly
 * spaced slot per day (empty on nights off), which reads far better than a
 * datetime axis: ApexCharts pads datetime bar charts, and with a handful of
 * bars that leaves the target line stopping short of the plot.
 */
function daySlots(
  held: BudgetNight[],
  span?: { start: string; end: string }
): { daily: boolean; points: DaySlot[] } {
  const days = span ? eachDayOfPeriod(span) : [];
  if (days.length === 0 || days.length > MAX_DAILY_SLOTS) {
    return {
      daily: false,
      points: held.map((n) => ({
        date: n.date,
        key: fmtDay(n.date, "EEE d MMM yyyy"),
        night: n,
        target: n.target,
      })),
    };
  }
  const byDate = new Map(held.map((n) => [n.date, n]));
  const targets = dailyTargets(days, held);
  return {
    daily: true,
    points: days.map((date, i) => ({
      date,
      key: fmtDay(date, "EEE d MMM yyyy"),
      night: byDate.get(date) ?? null,
      target: targets[i],
    })),
  };
}

/** Category axis with one slot per day, labelled sparsely enough to read. */
function dailyAxis(tokens: ChartTokens, points: DaySlot[]) {
  const index = new Map(points.map((p, i) => [p.key, i]));
  const every = points.length <= 10 ? 1 : Math.ceil(points.length / 8);
  const pattern = points.length <= 10 ? "EEE d" : "d MMM";
  return {
    type: "category" as const,
    labels: {
      style: tokens.axisStyle,
      rotate: 0,
      hideOverlappingLabels: false,
      formatter: (value: string) => {
        const i = index.get(value);
        return i !== undefined && i % every === 0
          ? fmtDay(points[i].date, pattern)
          : "";
      },
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
    tooltip: { enabled: false },
  };
}

export function NightlyChart({
  nights,
  counts,
  tokens,
  emptyMessage,
  span,
}: {
  nights: BudgetNight[];
  counts: Record<BudgetStatus, number>;
  tokens: ChartTokens;
  emptyMessage: string;
  /** Days the axis covers; omitted, it fits the nights held. */
  span?: { start: string; end: string };
}) {
  const held = useMemo(() => nights.filter((n) => n.actual !== null), [nights]);
  const targets = distinctTargets(held);
  // One target gets a flat dashed line; a range spanning two budget years
  // steps from one year's nightly target to the next.
  const singleTarget = targets.length <= 1 ? (targets[0] ?? null) : null;
  const slots = useMemo(() => daySlots(held, span), [held, span]);
  const base = baseOptions(tokens);

  return (
    <ChartCard
      title="Night by night"
      icon={CalendarDays}
      accent="text-amber-600 dark:text-amber-400"
      info={{
        title: "Night by night",
        description: "Koha banked each service night against its target.",
        body: (
          <>
            <p>
              Each bar is one service night&rsquo;s koha (cash + EFTPOS +
              Stripe). The dashed line is the nightly target: the annual budget
              divided by the planned service nights.
            </p>
            <p>
              <span className="font-medium text-foreground">Green</span> nights
              hit the target, <span className="font-medium text-foreground">yellow</span>{" "}
              nights reach 90&ndash;99% of it, and{" "}
              <span className="font-medium text-foreground">red</span> nights
              fall under 90%.
            </p>
          </>
        ),
      }}
      action={
        <div className="hidden lg:block">
          <NightlyLegend counts={counts} target={singleTarget} />
        </div>
      }
    >
      <div className="px-2 pb-2 lg:hidden">
        <NightlyLegend counts={counts} target={singleTarget} />
      </div>
      {held.length === 0 ? (
        <ChartEmpty height={300} message={emptyMessage} />
      ) : (
        <ApexChart
          // Mixed only when a target line has to step between years: a plain
          // bar chart keeps the flat target annotation full width.
          type={singleTarget === null ? "line" : "bar"}
          height={300}
          options={{
            ...base,
            chart: { ...base.chart, id: "budget-nightly", zoom: { enabled: false } },
            ...(singleTarget === null
              ? {
                  colors: [tokens.palette.neutral, tokens.foreground],
                  stroke: { width: [0, 1.5], dashArray: [0, 5], curve: "stepline" },
                }
              : {}),
            plotOptions: {
              bar: {
                columnWidth:
                  slots.points.length > 60
                    ? "85%"
                    : slots.points.length > 10
                      ? "60%"
                      : "40%",
                borderRadius: 2,
              },
            },
            xaxis: slots.daily ? dailyAxis(tokens, slots.points) : dayAxis(tokens),
            yaxis: {
              min: 0,
              forceNiceScale: true,
              labels: { style: tokens.axisStyle, formatter: compactMoney },
            },
            legend: { show: false },
            annotations: {
              yaxis:
                singleTarget !== null
                  ? [
                      {
                        y: singleTarget,
                        borderColor: tokens.foreground,
                        strokeDashArray: 5,
                        borderWidth: 1.5,
                      },
                    ]
                  : [],
            },
            tooltip: {
              theme: tokens.mode,
              shared: true,
              intersect: false,
              x: {
                formatter: (_v: number, opts?: { dataPointIndex: number }) => {
                  const point = slots.points[opts?.dataPointIndex ?? -1];
                  return point ? fmtDay(point.date, "EEE d MMM yyyy") : "";
                },
              },
              y: {
                formatter: (
                  v: number,
                  opts?: { seriesIndex: number; dataPointIndex: number }
                ) => {
                  if (opts?.seriesIndex === 1) return money0(v);
                  const target =
                    slots.points[opts?.dataPointIndex ?? -1]?.night?.target;
                  return target
                    ? `${money0(v)} · ${ratioToPercent(v / target)}% of target`
                    : money0(v);
                },
              },
            },
          }}
          series={[
            {
              name: "Koha",
              ...(singleTarget === null ? { type: "bar" } : {}),
              data: slots.points.map(({ date, key, night }) => ({
                x: slots.daily ? key : dayMs(date),
                y: night ? Math.round(night.actual as number) : null,
                fillColor: night?.status
                  ? STATUS_META[night.status].hex
                  : tokens.palette.neutral,
              })),
            },
            ...(singleTarget === null
              ? [
                  {
                    name: "Nightly target",
                    type: "line",
                    data: slots.points.map(({ date, key, target }) => ({
                      x: slots.daily ? key : dayMs(date),
                      y: target === null ? null : Math.round(target),
                    })),
                  },
                ]
              : []),
          ]}
        />
      )}
    </ChartCard>
  );
}

function NightlyLegend({
  counts,
  target,
}: {
  counts: Record<BudgetStatus, number>;
  /** Null when the nightly target changes within the range. */
  target: number | null;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      data-testid="budget-status-counts"
    >
      {(["green", "yellow", "red"] as const).map((s) => (
        <StatusPill
          key={s}
          status={s}
          label={`${counts[s]} ${STATUS_META[s].short.toLowerCase()}`}
        />
      ))}
      <span className="ml-1 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <span
          aria-hidden
          className="w-4 border-t-2 border-dashed border-slate-700 dark:border-slate-200"
        />
        {target === null ? "Nightly target" : `Target ${money0(target)}`}
      </span>
    </div>
  );
}

export function CumulativeChart({
  nights,
  tokens,
  title = "Year to date vs pro-rata target",
  description = "Running koha total against where the budget says it should be.",
  span,
}: {
  nights: BudgetNight[];
  tokens: ChartTokens;
  title?: string;
  description?: string;
  span?: { start: string; end: string };
}) {
  const base = baseOptions(tokens);
  const { actual, proRata } = useMemo(() => {
    const actual: Array<[number, number]> = [];
    const proRata: Array<[number, number]> = [];
    let sum = 0;
    let targetSum = 0;
    for (const n of nights) {
      if (n.actual === null) continue;
      sum += n.actual;
      targetSum += n.target ?? 0;
      const x = dayMs(n.date);
      actual.push([x, Math.round(sum)]);
      proRata.push([x, Math.round(targetSum)]);
    }
    return { actual, proRata };
  }, [nights]);

  return (
    <ChartCard
      title={title}
      icon={TrendingUp}
      accent="text-emerald-600 dark:text-emerald-400"
      info={{
        title,
        description,
        body: (
          <p>
            The pro-rata target adds one nightly target for every service night
            held, so it shows where the venue should be for the nights it has
            actually opened. A gap below the dashed line is the amount behind
            budget.
          </p>
        ),
      }}
    >
      {actual.length === 0 ? (
        <ChartEmpty height={280} message="The running total starts with the first banked night." />
      ) : (
        <ApexChart
          type="area"
          height={280}
          options={{
            ...base,
            chart: { ...base.chart, id: "budget-cumulative", zoom: { enabled: false } },
            colors: [tokens.palette.koha, tokens.palette.target],
            stroke: { curve: "straight", width: [2.5, 2], dashArray: [0, 6] },
            fill: {
              type: ["gradient", "solid"],
              opacity: [1, 0],
              gradient: { opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 100] },
            },
            xaxis: dayAxis(tokens, span),
            yaxis: {
              min: 0,
              forceNiceScale: true,
              labels: { style: tokens.axisStyle, formatter: compactMoney },
            },
            tooltip: {
              theme: tokens.mode,
              shared: true,
              x: { format: "ddd d MMM yyyy" },
              y: { formatter: (v: number) => money0(v) },
            },
          }}
          series={[
            { name: "Koha banked", data: actual },
            { name: "Pro-rata target", data: proRata },
          ]}
        />
      )}
    </ChartCard>
  );
}

// ── Nights table ─────────────────────────────────────────────────────────

type NightFilter = "all" | BudgetStatus | "pending";
const PAGE = 15;

export function NightsTable({ nights }: { nights: BudgetNight[] }) {
  const [filter, setFilter] = useState<NightFilter>("all");
  const [showAll, setShowAll] = useState(false);

  const newestFirst = useMemo(() => [...nights].reverse(), [nights]);
  const pendingCount = nights.filter((n) => n.actual === null).length;
  const filtered = newestFirst.filter((n) =>
    filter === "all"
      ? true
      : filter === "pending"
        ? n.actual === null
        : n.status === filter
  );
  const rows = showAll ? filtered : filtered.slice(0, PAGE);

  const options: { value: NightFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "red", label: "Below" },
    { value: "yellow", label: "Close" },
    { value: "green", label: "On target" },
    ...(pendingCount > 0
      ? [{ value: "pending" as const, label: "Not banked" }]
      : []),
  ];

  return (
    <ChartCard
      title="Service nights"
      icon={TableProperties}
      accent="text-blue-600 dark:text-blue-400"
      action={
        <div className="hidden sm:block">
          <SegmentedControl
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setShowAll(false);
            }}
            options={options}
          />
        </div>
      }
      bodyClassName="px-0 pb-0"
    >
      <div className="overflow-x-auto px-4 pb-3 sm:hidden">
        <SegmentedControl
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setShowAll(false);
          }}
          options={options}
        />
      </div>
      {filtered.length === 0 ? (
        <ChartEmpty height={120} message="No nights match this filter." />
      ) : (
        <>
          <Table data-testid="budget-nights-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Night</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Guests</TableHead>
                <TableHead className="text-right">Koha</TableHead>
                <TableHead className="hidden text-right md:table-cell">Target</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Of target</TableHead>
                <TableHead className="pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((n) => (
                <TableRow key={n.date}>
                  <TableCell className="pl-4 font-medium whitespace-nowrap">
                    {fmtDay(n.date)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {n.guests === null ? "—" : num(n.guests)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {n.actual === null ? "—" : money0(n.actual)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                    {n.target === null ? "—" : money0(n.target)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {n.actual !== null && n.target
                      ? `${ratioToPercent(n.actual / n.target)}%`
                      : "—"}
                  </TableCell>
                  <TableCell className="pr-4">
                    <StatusPill
                      status={n.status}
                      label={n.status ? STATUS_META[n.status].short : undefined}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > PAGE && (
            <div className="border-t px-4 py-2.5 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll((v) => !v)}
                data-testid="budget-nights-toggle"
              >
                {showAll
                  ? "Show fewer nights"
                  : `Show all ${filtered.length} nights`}
              </Button>
            </div>
          )}
        </>
      )}
    </ChartCard>
  );
}
