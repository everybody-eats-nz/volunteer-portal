"use client";

import {
  ApexChart,
  ChartEmpty,
  ChartIcon,
} from "@/app/admin/analytics/_components/primitives";
import {
  barGap,
  baseOptions,
  chartModeFrom,
  chartTokens,
  colorForLocation,
  ordinalScale,
  plural,
  type ChartTokens,
} from "@/app/admin/analytics/_lib/chart-theme";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/motion";
import {
  Trophy,
  TrendingUp,
  Users,
  Loader2,
  Info,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatInNZT } from "@/lib/timezone";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import Link from "next/link";
import type { MilestoneData } from "@/lib/milestone-analytics";
import { UNSPECIFIED_LOCATION } from "@/lib/recruitment-types";
import {
  MILESTONE_DISTRIBUTION_BANDS,
  type MilestoneSegment,
} from "@/lib/milestone-segment-types";
import { MilestoneUsersDialog } from "./milestone-users-dialog";


interface Props {
  data: MilestoneData;
  months: string;
  location: string;
  locations: Array<{ value: string; label: string }>;
}

const MONTHS_LABELS: Record<string, string> = {
  "1": "1 month",
  "3": "3 months",
  "6": "6 months",
  "12": "12 months",
  "24": "24 months",
};

/**
 * Milestone tiers are ordered (10 → 500 shifts), so they share one forest ramp:
 * the bigger the milestone, the stronger the colour.
 */
function milestoneColors(
  thresholds: number[],
  tokens: ChartTokens
): Map<number, string> {
  const sorted = [...thresholds].sort((a, b) => a - b);
  const ramp = ordinalScale(sorted.length, tokens);
  return new Map(sorted.map((t, i) => [t, ramp[i]]));
}

function MilestoneBadge({ threshold, color }: { threshold: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {threshold} shifts
    </span>
  );
}

function MilestoneCard({
  threshold,
  color,
  hitInPeriod,
  allTimeTotal,
  periodLabel,
}: {
  threshold: number;
  color: string;
  hitInPeriod: number;
  allTimeTotal: number;
  periodLabel: string;
}) {
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="rounded-lg bg-muted/60 p-2">
            <Trophy className="h-4 w-4" style={{ color }} aria-hidden />
          </div>
          <MilestoneBadge threshold={threshold} color={color} />
        </div>
        <p className="text-3xl font-bold tracking-tight">{hitInPeriod}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          hit in last {periodLabel}
        </p>
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <span className="text-xs text-muted-foreground">All-time total</span>
          <span className="text-sm font-semibold">{allTimeTotal}</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface ActiveMilestoneSegment {
  segment: MilestoneSegment;
  title: string;
  subtitle?: string;
}

export function MilestoneAnalyticsClient({
  data,
  months: initialMonths,
  location: initialLocation,
  locations,
}: Props) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [isPending, startTransition] = useTransition();
  const [months, setMonths] = useState(initialMonths);
  const [location, setLocation] = useState(initialLocation);
  const [selectedMilestone, setSelectedMilestone] = useState<number>(100);
  const [recentThresholdFilter, setRecentThresholdFilter] =
    useState<string>("all");
  const [activeSegment, setActiveSegment] =
    useState<ActiveMilestoneSegment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const tokens = chartTokens(chartModeFrom(resolvedTheme));
  const base = baseOptions(tokens);

  const openSegment = (s: ActiveMilestoneSegment) => {
    setActiveSegment(s);
    setDialogOpen(true);
  };

  const handleApplyFilters = () => {
    const params = new URLSearchParams({ months, location });
    startTransition(() => {
      router.push(`/admin/analytics/milestones?${params}`);
    });
  };

  const periodLabel = MONTHS_LABELS[initialMonths] ?? `${initialMonths} months`;

  // Projection for selected milestone
  const selectedProjection = data.projections.find(
    (p) => p.threshold === selectedMilestone
  );

  const restaurantList = data.locations;
  const locationColors = restaurantList.map((loc) =>
    colorForLocation(loc, tokens)
  );
  const tierColors = milestoneColors(
    data.milestoneHits.map((m) => m.threshold),
    tokens
  );
  const tierColor = (threshold: number) =>
    tierColors.get(threshold) ?? tokens.palette.neutral;
  // Every bar chart below stacks by restaurant and shares this frame.
  const stackedBarBase = {
    ...base,
    stroke: barGap(tokens),
    legend: { ...base.legend, show: true, showForSingleSeries: true },
    tooltip: {
      ...base.tooltip,
      shared: true,
      intersect: false,
      y: { formatter: (val: number) => plural(val, "volunteer") },
    },
  };

  // Distribution chart — horizontal bars, stacked by restaurant
  const distCategories = data.distribution.map((b) => b.label);
  const distCounts = data.distribution.map((b) => b.count);
  const distSeriesByLocation = restaurantList.map((loc) => ({
    name: loc,
    data: data.distribution.map((b) => b.byLocation[loc] ?? 0),
  }));

  // Milestone hits chart — vertical bars showing "hit in period", stacked by
  // restaurant. All-time totals remain visible on the summary cards above.
  const hitsCategories = data.milestoneHits.map((m) => `${m.threshold}`);
  const hitsSeriesByLocation = restaurantList.map((loc) => ({
    name: loc,
    data: data.milestoneHits.map((m) => m.byLocation[loc]?.hitInPeriod ?? 0),
  }));
  const hitsAnyValue = data.milestoneHits.some((m) => m.hitInPeriod > 0);

  // Projection chart — bars per threshold showing "projected in next 12
  // months", stacked by primary restaurant. All-time totals per threshold are
  // already visible on the summary cards at the top of the page.
  const projCategories = data.projections.map((p) => `${p.threshold} shifts`);
  const projProjectedSeries = restaurantList.map((loc) => ({
    name: loc,
    data: data.projections.map(
      (p) => p.byLocation[loc]?.projectedAdditional ?? 0
    ),
  }));
  const projHasAdditional = data.projections.some(
    (p) => p.projectedAdditional > 0
  );

  // Recent achievements (filtered by threshold)
  const filteredRecentAchievements =
    recentThresholdFilter === "all"
      ? data.recentAchievements
      : data.recentAchievements.filter(
          (a) => String(a.threshold) === recentThresholdFilter
        );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="py-4">
        <CardContent className="px-4">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="months">Time Period</Label>
                <Select value={months} onValueChange={setMonths}>
                  <SelectTrigger id="months" size="md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Last 1 month</SelectItem>
                    <SelectItem value="3">Last 3 months</SelectItem>
                    <SelectItem value="6">Last 6 months</SelectItem>
                    <SelectItem value="12">Last 12 months</SelectItem>
                    <SelectItem value="24">Last 24 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger id="location" size="md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.value} value={loc.value}>
                        {loc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleApplyFilters}
              className="sm:w-auto w-full"
              disabled={isPending}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className={`space-y-6 transition-opacity ${
          isPending ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        {/* Milestone Summary Cards */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {data.milestoneHits.map((m) => (
            <motion.div key={m.threshold} variants={staggerItem}>
              <MilestoneCard
                threshold={m.threshold}
                color={tierColor(m.threshold)}
                hitInPeriod={m.hitInPeriod}
                allTimeTotal={m.allTimeTotal}
                periodLabel={periodLabel}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Charts Row: Hits in period + Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Milestone Hits in Period */}
          <motion.div variants={staggerItem}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                  <ChartIcon icon={Trophy} accent="text-amber-500" />
                  Milestones Hit
                  <Dialog>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <button
                          type="button"
                          aria-label="More info"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="top">More info</TooltipContent>
                    </Tooltip>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Milestones Hit</DialogTitle>
                        <DialogDescription>
                          How milestone crossings are counted
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 text-sm">
                        <p>
                          A volunteer &ldquo;hits&rdquo; a milestone when their
                          Nth completed shift (e.g. their 100th) falls within
                          the selected time period. Each volunteer is counted at
                          most once per milestone — this tracks the moment they
                          crossed the threshold for the first time.
                        </p>
                        <p>
                          Each bar shows milestone crossings in the selected
                          period, split by the volunteer&rsquo;s primary
                          restaurant (their default location). Volunteers
                          without a primary restaurant set are grouped as
                          &ldquo;{UNSPECIFIED_LOCATION}&rdquo;. All-time totals
                          remain visible on the summary cards above.
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hitsAnyValue ? (
                  <ApexChart
                    options={{
                      ...stackedBarBase,
                      chart: {
                        ...base.chart,
                        type: "bar" as const,
                        stacked: true,
                        events: {
                          dataPointSelection: (_e, _ctx, config) => {
                            if (!config) return;
                            const m = data.milestoneHits[config.dataPointIndex];
                            if (!m) return;
                            const segLoc =
                              restaurantList[config.seriesIndex] ??
                              UNSPECIFIED_LOCATION;
                            openSegment({
                              segment: {
                                chart: "milestoneHits",
                                threshold: m.threshold,
                                location: segLoc,
                              },
                              title: `${m.threshold}-shift milestone hits · ${segLoc}`,
                              subtitle: `Volunteers whose ${m.threshold}th confirmed shift fell within the last ${periodLabel}`,
                            });
                          },
                        },
                      },
                      plotOptions: {
                        bar: {
                          borderRadius: 4,
                          columnWidth: "55%",
                          borderRadiusApplication: "end" as const,
                        },
                      },
                      xaxis: {
                        categories: hitsCategories.map((c) => `${c} shifts`),
                        labels: { style: tokens.axisStyle },
                        axisBorder: { show: false },
                        axisTicks: { show: false },
                      },
                      yaxis: {
                        forceNiceScale: true,
                        labels: {
                          style: tokens.axisStyle,
                          formatter: (v: number) => String(Math.round(v)),
                        },
                      },
                      colors: locationColors.length
                        ? locationColors
                        : [tokens.series[0]],
                    }}
                    series={
                      hitsSeriesByLocation.length > 0
                        ? hitsSeriesByLocation
                        : [
                            {
                              name: `Hit in last ${periodLabel}`,
                              data: data.milestoneHits.map(
                                (m) => m.hitInPeriod
                              ),
                            },
                          ]
                    }
                    type="bar"
                    height={300}
                  />
                ) : (
                  <ChartEmpty
                    message={`No milestones crossed in the last ${periodLabel}`}
                    hint="Try a longer time period or another location."
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Volunteer Distribution */}
          <motion.div variants={staggerItem}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                  <ChartIcon icon={Users} accent="text-blue-500" />
                  Volunteer Distribution
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                          type="button"
                          aria-label="More info"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="w-auto max-w-56">
                      How many volunteers currently sit in each shift-count band
                      (all-time completed shifts), stacked by primary restaurant
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {distCounts.some((v) => v > 0) ? (
                  <ApexChart
                    options={{
                      ...stackedBarBase,
                      chart: {
                        ...base.chart,
                        type: "bar" as const,
                        stacked: true,
                        events: {
                          dataPointSelection: (_e, _ctx, config) => {
                            if (!config) return;
                            const bucket =
                              data.distribution[config.dataPointIndex];
                            const band =
                              MILESTONE_DISTRIBUTION_BANDS[
                                config.dataPointIndex
                              ];
                            if (!bucket || !band) return;
                            const segLoc =
                              restaurantList[config.seriesIndex] ??
                              UNSPECIFIED_LOCATION;
                            openSegment({
                              segment: {
                                chart: "milestoneDistribution",
                                band,
                                location: segLoc,
                              },
                              title: `${bucket.label} shifts · ${segLoc}`,
                              subtitle: `Volunteers currently in the ${bucket.label}-shift band`,
                            });
                          },
                        },
                      },
                      plotOptions: {
                        bar: {
                          horizontal: true,
                          borderRadius: 4,
                          borderRadiusApplication: "end" as const,
                          barHeight: "60%",
                        },
                      },
                      xaxis: {
                        categories: distCategories,
                        title: {
                          text: "Volunteers",
                          style: {
                            fontFamily: tokens.axisStyle.fontFamily,
                            fontSize: "12px",
                            fontWeight: 400,
                            color: tokens.label,
                          },
                        },
                        labels: {
                          style: tokens.axisStyle,
                          formatter: (v: string) =>
                            String(Math.round(Number(v))),
                        },
                        axisBorder: { show: false },
                        axisTicks: { show: false },
                      },
                      yaxis: { labels: { style: tokens.catStyle } },
                      colors: locationColors.length
                        ? locationColors
                        : [tokens.series[0]],
                      grid: {
                        ...base.grid,
                        xaxis: { lines: { show: true } },
                        yaxis: { lines: { show: false } },
                      },
                    }}
                    series={
                      distSeriesByLocation.length > 0
                        ? distSeriesByLocation
                        : [{ name: "Volunteers", data: distCounts }]
                    }
                    type="bar"
                    height={300}
                  />
                ) : (
                  <ChartEmpty
                    message="No volunteers have completed a shift yet"
                    hint="Bands fill in as volunteers complete shifts."
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* 12-Month Projections */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <ChartIcon icon={TrendingUp} accent="text-emerald-500" />
                12-Month Milestone Projections
                <Dialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          aria-label="More info"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top">More info</TooltipContent>
                  </Tooltip>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>12-Month Milestone Projections</DialogTitle>
                      <DialogDescription>
                        How projections are calculated
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                      <p>
                        For each volunteer who hasn&rsquo;t yet hit a milestone,
                        we calculate their average shift rate over the last 6
                        months. If their projected rate means they&rsquo;ll
                        reach the threshold within 12 months, they&rsquo;re
                        counted in the &ldquo;Projected&rdquo; total.
                      </p>
                      <p>
                        Each bar is stacked by the volunteer&rsquo;s primary
                        restaurant, so you can see which locations are
                        trending toward each level of recognition. All-time
                        totals (who has already crossed each threshold) live
                        on the summary cards at the top of the page.
                      </p>
                      <p>
                        Volunteers with no shifts in the past 6 months are not
                        projected — they&rsquo;re considered inactive. Use the
                        approaching volunteers list below to view everyone
                        close to a milestone regardless of recent activity.
                      </p>
                      <p>
                        These projections are useful for planning recognition
                        budgets — for example, estimating how many volunteers
                        will hit 100 shifts in the next year.
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projHasAdditional ? (
                <ApexChart
                  options={{
                    ...stackedBarBase,
                    chart: {
                      ...base.chart,
                      type: "bar" as const,
                      stacked: true,
                      events: {
                        dataPointSelection: (_e, _ctx, config) => {
                          if (!config) return;
                          const p = data.projections[config.dataPointIndex];
                          if (!p) return;
                          const segLoc =
                            restaurantList[config.seriesIndex] ??
                            UNSPECIFIED_LOCATION;
                          openSegment({
                            segment: {
                              chart: "milestoneProjections",
                              threshold: p.threshold,
                              location: segLoc,
                            },
                            title: `Projected to hit ${p.threshold} shifts · ${segLoc}`,
                            subtitle: `Volunteers on track to cross ${p.threshold} shifts in the next 12 months at their current rate`,
                          });
                        },
                      },
                    },
                    plotOptions: {
                      bar: {
                        horizontal: false,
                        borderRadius: 4,
                        borderRadiusApplication: "end" as const,
                        columnWidth: "50%",
                      },
                    },
                    xaxis: {
                      categories: projCategories,
                      labels: { style: tokens.axisStyle },
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                    },
                    yaxis: {
                      forceNiceScale: true,
                      title: {
                        text: "Volunteers projected",
                        style: {
                          fontFamily: tokens.axisStyle.fontFamily,
                          fontSize: "12px",
                          fontWeight: 400,
                          color: tokens.label,
                        },
                      },
                      labels: {
                        style: tokens.axisStyle,
                        formatter: (v: number) => String(Math.round(v)),
                      },
                    },
                    colors: locationColors.length
                      ? locationColors
                      : [tokens.series[0]],
                  }}
                  series={
                    projProjectedSeries.length > 0
                      ? projProjectedSeries
                      : [
                          {
                            name: "Projected in next 12 months",
                            data: data.projections.map(
                              (p) => p.projectedAdditional
                            ),
                          },
                        ]
                  }
                  type="bar"
                  height={300}
                />
              ) : (
                <ChartEmpty
                  message="No volunteers are projected to cross a milestone in the next 12 months"
                  hint="Projections use each volunteer's shift rate over the last 6 months."
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Approaching Volunteers */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                  <ChartIcon icon={Trophy} accent="text-muted-foreground" />
                  Approaching Volunteers
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                          type="button"
                          aria-label="More info"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="w-auto max-w-64">
                      Volunteers within 20% of the selected milestone threshold.
                      Projected months is based on their average shift rate over
                      the last 6 months.
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="milestone-select"
                    className="text-sm shrink-0"
                  >
                    Milestone:
                  </Label>
                  <Select
                    value={String(selectedMilestone)}
                    onValueChange={(v) => setSelectedMilestone(Number(v))}
                  >
                    <SelectTrigger id="milestone-select" size="md" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {data.projections.map((p) => (
                        <SelectItem
                          key={p.threshold}
                          value={String(p.threshold)}
                        >
                          {p.threshold} shifts
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedProjection &&
              selectedProjection.approaching.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 sm:gap-4 text-xs text-muted-foreground pb-1">
                    <span className="flex-1">Volunteer</span>
                    <span className="w-14 sm:w-24 text-right">Shifts</span>
                    <span className="hidden sm:block w-24 text-right">Still needed</span>
                    <span className="hidden sm:block w-28 text-right">Rate / month</span>
                    <span className="w-20 sm:w-28 text-right">Est. arrival</span>
                    <span className="w-8" />
                  </div>
                  {selectedProjection.approaching.map((v) => {
                    const color = tierColor(selectedMilestone);
                    const pctDone = (v.totalShifts / selectedMilestone) * 100;
                    return (
                      <div
                        key={v.userId}
                        className="flex items-center gap-3 sm:gap-4 py-2 border-b last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {v.name}
                            </p>
                            <span className="text-xs text-muted-foreground truncate">
                              · {v.location}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pctDone}%`,
                                backgroundColor: color,
                              }}
                            />
                          </div>
                        </div>
                        <span className="w-14 sm:w-24 text-right text-sm tabular-nums font-medium">
                          {v.totalShifts}
                        </span>
                        <span className="hidden sm:block w-24 text-right text-sm tabular-nums text-muted-foreground">
                          {v.shiftsNeeded}
                        </span>
                        <span className="hidden sm:block w-28 text-right text-sm tabular-nums text-muted-foreground">
                          {v.monthlyRate > 0 ? `${v.monthlyRate}/mo` : "—"}
                        </span>
                        <span className="w-20 sm:w-28 text-right text-sm">
                          {v.projectedMonths != null ? (
                            <Badge
                              variant={
                                v.projectedMonths <= 3
                                  ? "default"
                                  : v.projectedMonths <= 6
                                  ? "secondary"
                                  : "outline"
                              }
                              className="text-xs"
                            >
                              ~{v.projectedMonths} mo
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              inactive
                            </span>
                          )}
                        </span>
                        <Link
                          href={`/admin/volunteers/${v.userId}`}
                          className="w-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                  {selectedProjection
                    ? `No volunteers are currently approaching the ${selectedMilestone}-shift milestone`
                    : "Select a milestone to view approaching volunteers"}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Milestone Achievements */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                  <ChartIcon icon={Sparkles} accent="text-muted-foreground" />
                  Recent Milestone Achievements
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                          type="button"
                          aria-label="More info"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="w-auto max-w-64">
                      Volunteers whose Nth completed shift landed inside the
                      selected time period. Newest achievements first. Useful
                      for recognition — reach out while it&rsquo;s still fresh.
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="recent-threshold-select"
                    className="text-sm shrink-0"
                  >
                    Milestone:
                  </Label>
                  <Select
                    value={recentThresholdFilter}
                    onValueChange={setRecentThresholdFilter}
                  >
                    <SelectTrigger
                      id="recent-threshold-select"
                      size="md"
                      className="w-36"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All milestones</SelectItem>
                      {data.projections.map((p) => (
                        <SelectItem
                          key={p.threshold}
                          value={String(p.threshold)}
                        >
                          {p.threshold} shifts
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredRecentAchievements.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 sm:gap-4 text-xs text-muted-foreground pb-1">
                    <span className="flex-1">Volunteer</span>
                    <span className="w-28">Milestone</span>
                    <span className="hidden sm:block w-20 text-right">Total</span>
                    <span className="w-24 sm:w-32 text-right">Achieved</span>
                    <span className="w-8" />
                  </div>
                  {filteredRecentAchievements.map((a) => {
                    const color = tierColor(a.threshold);
                    const absoluteDate = formatInNZT(
                      a.achievedAt,
                      "d MMM yyyy"
                    );
                    const relative = formatDistanceToNow(
                      new Date(a.achievedAt),
                      { addSuffix: true }
                    );
                    return (
                      <div
                        key={`${a.userId}-${a.threshold}`}
                        className="flex items-center gap-3 sm:gap-4 py-2 border-b last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {a.name}
                            </p>
                            <span className="text-xs text-muted-foreground truncate">
                              · {a.location}
                            </span>
                          </div>
                        </div>
                        <span className="w-28">
                          <MilestoneBadge threshold={a.threshold} color={color} />
                        </span>
                        <span className="hidden sm:block w-20 text-right text-sm tabular-nums font-medium">
                          {a.totalShifts}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="w-24 sm:w-32 text-right text-sm text-muted-foreground tabular-nums cursor-default">
                              {relative}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {absoluteDate}
                          </TooltipContent>
                        </Tooltip>
                        <Link
                          href={`/admin/volunteers/${a.userId}`}
                          className="w-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                  {data.recentAchievements.length === 0
                    ? `No volunteers crossed a milestone in the last ${periodLabel}`
                    : `No ${recentThresholdFilter}-shift milestones were crossed in the last ${periodLabel}`}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <MilestoneUsersDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        segment={activeSegment?.segment ?? null}
        title={activeSegment?.title ?? ""}
        subtitle={activeSegment?.subtitle}
        months={initialMonths}
        locationFilter={initialLocation}
      />
    </div>
  );
}
