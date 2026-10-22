"use client";

import {
  ApexChart,
  ChartEmpty,
  ChartIcon,
  SegmentedControl,
} from "@/app/admin/analytics/_components/primitives";
import {
  barGap,
  baseOptions,
  chartModeFrom,
  chartTokens,
  deltaHtml,
  insideLabelStyle,
  ordinalScale,
  plural,
  readableInk,
  segmentLabel,
  sequentialBins,
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
import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/motion";
import {
  Users,
  TrendingUp,
  UserCheck,
  RefreshCw,
  UserPlus,
  Activity,
  Loader2,
  CalendarDays,
  Info,
} from "lucide-react";
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
import { DayOfWeekFilter } from "@/components/day-of-week-filter";
import { EngagementVolunteerTable } from "./engagement-volunteer-table";
import { EngagementSegmentDialog } from "./engagement-segment-dialog";
import type { EngagementSegment } from "@/lib/engagement";
import type {
  EngagementSummaryData,
  EngagementVolunteersResult,
  RetentionHeatmapData,
  ShiftTypeEngagement,
} from "@/lib/engagement";


interface Props {
  data: EngagementSummaryData;
  shiftTypeData: ShiftTypeEngagement[];
  retentionData: RetentionHeatmapData;
  months: string;
  location: string;
  days: string;
  locations: Array<{ value: string; label: string }>;
  volunteersData: EngagementVolunteersResult;
  tableSearch: string;
  tableStatus: string;
  tableSortBy: string;
  tableSortOrder: "asc" | "desc";
}

const MONTHS_LABELS: Record<string, string> = {
  "1": "1 month",
  "3": "3 months",
  "6": "6 months",
  "12": "12 months",
};

// Shared styling for the clickable hero metric tiles (Total/Retention/New/Reactivated).
const metricButtonClass =
  "flex flex-col items-center justify-center p-5 w-full h-full transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset cursor-pointer";
const metricNumberClass =
  "text-2xl font-bold tracking-tight tabular-nums underline decoration-dotted decoration-muted-foreground/40 underline-offset-4";

function EngagementRing({
  value,
  max,
  color,
  size = 52,
  strokeWidth = 5,
}: {
  value: number;
  max: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference * (1 - pct);

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/20"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={circumference}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EngagementAnalyticsClient({
  data,
  shiftTypeData,
  retentionData,
  months: initialMonths,
  location: initialLocation,
  days: initialDays,
  locations,
  volunteersData,
  tableSearch,
  tableStatus,
  tableSortBy,
  tableSortOrder,
}: Props) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [isPending, startTransition] = useTransition();
  const [months, setMonths] = useState(initialMonths);
  const [location, setLocation] = useState(initialLocation);
  const [days, setDays] = useState(initialDays);
  const [trendView, setTrendView] = useState<"monthly" | "weekly">("monthly");
  const [breakdownView, setBreakdownView] = useState<"overall" | "shiftType">("overall");
  const [activeSegment, setActiveSegment] = useState<EngagementSegment | null>(
    null
  );
  const tokens = chartTokens(chartModeFrom(resolvedTheme));
  const base = baseOptions(tokens);
  // Activity levels are ordered (never → highly active), so they share one
  // forest ramp: the more active, the stronger the colour.
  const [neverColor, inactiveColor, activeColor, highlyActiveColor] =
    ordinalScale(4, tokens);
  const activityColor: Record<string, string> = {
    "Highly Active": highlyActiveColor,
    Active: activeColor,
    Inactive: inactiveColor,
    "Never Volunteered": neverColor,
  };
  const heatBins = sequentialBins(tokens);
  const breakdownColors = data.breakdown.map(
    (b) => activityColor[b.label] ?? tokens.palette.neutral
  );

  const handleApplyFilters = () => {
    const params = new URLSearchParams({ months, location });
    if (days) params.set("days", days);
    startTransition(() => {
      router.push(`/admin/analytics/engagement?${params}`);
    });
  };

  const volunteersWithShifts =
    data.summary.totalVolunteers - data.summary.neverVolunteeredCount;
  const engagementRate = Math.round(
    ((data.summary.activeCount + data.summary.highlyActiveCount) /
      Math.max(volunteersWithShifts, 1)) *
      100
  );

  // Weekly view: split 104 weeks into current (last 52) and previous (first 52)
  const prevWeekData = data.monthlyTrend.slice(0, 52);
  const currWeekData = data.monthlyTrend.slice(52);

  // Monthly view: roll up weekly data into months
  function rollUpToMonthly(
    weekData: typeof data.monthlyTrend
  ): Array<{ month: string; activeVolunteers: number }> {
    // We need to track unique volunteer IDs per month, but we only have counts.
    // Use max-per-week as a reasonable rollup (distinct volunteers active in any week).
    const monthMaxMap = new Map<string, number>();
    for (const w of weekData) {
      const d = new Date(w.month + "T00:00:00");
      const key = d.toLocaleDateString("en-NZ", {
        month: "short",
        year: "2-digit",
      });
      monthMaxMap.set(
        key,
        Math.max(monthMaxMap.get(key) || 0, w.activeVolunteers)
      );
    }
    return Array.from(monthMaxMap.entries()).map(([month, val]) => ({
      month,
      activeVolunteers: val,
    }));
  }

  const currMonthData = rollUpToMonthly(currWeekData);
  const prevMonthData = rollUpToMonthly(prevWeekData);

  // Pick data based on toggle
  const isWeekly = trendView === "weekly";
  const currTrendData = isWeekly ? currWeekData : currMonthData;
  const prevTrendData = isWeekly ? prevWeekData : prevMonthData;
  const trendCategories = isWeekly
    ? currWeekData.map((t) => {
        const d = new Date(t.month + "T00:00:00");
        return d.toLocaleDateString("en-NZ", {
          day: "numeric",
          month: "short",
        });
      })
    : currMonthData.map((t) => t.month);
  const hasPrevYearData = prevTrendData.some((t) => t.activeVolunteers > 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="py-4">
        <CardContent className="px-4">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto]">
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
              <DayOfWeekFilter value={days} onChange={setDays} />
            </div>
            <Button
              onClick={handleApplyFilters}
              className="sm:w-auto w-full"
              disabled={isPending}
            >
              {isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
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
        className={`space-y-6 transition-opacity ${isPending ? "opacity-50 pointer-events-none" : ""}`}
      >
        {/* Hero — Engagement Health */}
        <motion.div variants={staggerItem}>
          <Card className="overflow-hidden">
            <div className="flex flex-col md:flex-row">
              {/* Left: engagement ring + rate */}
              <div className="flex items-center gap-5 p-6">
                <div className="relative">
                  <EngagementRing
                    value={
                      data.summary.activeCount + data.summary.highlyActiveCount
                    }
                    max={volunteersWithShifts}
                    color={highlyActiveColor}
                    size={72}
                    strokeWidth={6}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-[var(--ee-primary-text)]" />
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help pl-6">
                      <p className="text-sm text-muted-foreground">
                        Engagement Rate
                      </p>
                      <p className="text-3xl font-bold tracking-tight">
                        {engagementRate}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Last {MONTHS_LABELS[initialMonths]}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-56">
                    (Highly Active + Active) / Volunteers with shifts ={" "}
                    {data.summary.highlyActiveCount + data.summary.activeCount} /{" "}
                    {volunteersWithShifts}
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Right: secondary metrics */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 divide-x">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setActiveSegment("total")}
                      className={metricButtonClass}
                      data-testid="engagement-kpi-total"
                      aria-label="View all volunteers"
                    >
                      <Users className="h-4 w-4 text-muted-foreground mb-1" />
                      <p className={metricNumberClass}>
                        {data.summary.totalVolunteers}
                      </p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-56">
                    All registered volunteers (excludes admins). Click to see who.
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setActiveSegment("retention")}
                      className={metricButtonClass}
                      data-testid="engagement-kpi-retention"
                      aria-label="View retained volunteers"
                    >
                      <RefreshCw className="h-4 w-4 text-muted-foreground mb-1" />
                      <p className={metricNumberClass}>
                        {data.summary.retentionRate}%
                      </p>
                      <p className="text-xs text-muted-foreground">Retention</p>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-56">
                    Of volunteers active in the prior period, the percentage who
                    also volunteered in the current period. Click to see who was
                    retained.
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setActiveSegment("new")}
                      className={metricButtonClass}
                      data-testid="engagement-kpi-new"
                      aria-label="View new volunteers"
                    >
                      <UserPlus className="h-4 w-4 text-muted-foreground mb-1" />
                      <p className={metricNumberClass}>
                        {data.summary.newInPeriodCount}
                      </p>
                      <p className="text-xs text-muted-foreground">New</p>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-56">
                    Volunteers who completed their first ever shift during the
                    selected period. Click to see who.
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setActiveSegment("reactivated")}
                      className={metricButtonClass}
                      data-testid="engagement-kpi-reactivated"
                      aria-label="View reactivated volunteers"
                    >
                      <UserCheck className="h-4 w-4 text-muted-foreground mb-1" />
                      <p className={metricNumberClass}>
                        {data.summary.reactivatedCount}
                      </p>
                      <p className="text-xs text-muted-foreground">Reactivated</p>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-56">
                    Returning volunteers — completed a shift in the period after
                    6+ months of inactivity (excludes first-timers). Click to see
                    who.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Category Stat Cards */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {[
            {
              label: "Highly Active",
              segment: "highly_active" as const,
              value: data.summary.highlyActiveCount,
              desc: "2+ shifts/month avg",
              tooltip:
                "Volunteers averaging 2 or more completed shifts per month during the selected period. Click to see who.",
              ring: highlyActiveColor,
            },
            {
              label: "Active",
              segment: "active" as const,
              value: data.summary.activeCount,
              desc: "1+ shift in period",
              tooltip:
                "Volunteers with at least 1 completed shift in the selected period (but fewer than 2/month avg). Click to see who.",
              ring: activeColor,
            },
            {
              label: "Inactive",
              segment: "inactive" as const,
              value: data.summary.inactiveCount,
              desc: "No shifts in period",
              tooltip:
                "Volunteers who have completed shifts before but none during the selected period. Click to see who.",
              ring: inactiveColor,
            },
            {
              label: "Never Volunteered",
              segment: "never" as const,
              value: data.summary.neverVolunteeredCount,
              desc: "0 completed shifts",
              tooltip:
                "Registered volunteers who have never completed a shift. Click to see who.",
              ring: neverColor,
            },
          ].map((stat) => (
            <motion.div key={stat.label} variants={staggerItem}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setActiveSegment(stat.segment)}
                    className="w-full text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid={`engagement-card-${stat.segment}`}
                    aria-label={`View ${stat.label} volunteers`}
                  >
                    <Card className="py-5 cursor-pointer transition-colors hover:bg-muted/40">
                      <CardContent className="flex items-center gap-4">
                        <EngagementRing
                          value={stat.value}
                          max={data.summary.totalVolunteers}
                          color={stat.ring}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {stat.label}
                          </p>
                          <p className="text-2xl font-bold tracking-tight">
                            {stat.value}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {stat.desc}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="w-auto max-w-56">
                  {stat.tooltip}
                </TooltipContent>
              </Tooltip>
            </motion.div>
          ))}
        </motion.div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Engagement Breakdown */}
          <motion.div variants={staggerItem}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                    Engagement Breakdown
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
                          <DialogTitle>Engagement Breakdown</DialogTitle>
                          <DialogDescription>
                            How volunteer activity levels are calculated
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 text-sm">
                          <div className="flex gap-3">
                            <span className="inline-block w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: highlyActiveColor }} />
                            <p><span className="font-medium">Highly Active</span> &mdash; Averaging 2 or more completed shifts per month during the selected period.</p>
                          </div>
                          <div className="flex gap-3">
                            <span className="inline-block w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: activeColor }} />
                            <p><span className="font-medium">Active</span> &mdash; At least 1 completed shift in the period, but fewer than 2 per month on average.</p>
                          </div>
                          <div className="flex gap-3">
                            <span className="inline-block w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: inactiveColor }} />
                            <p><span className="font-medium">Inactive</span> &mdash; Has completed shifts before but none during the selected period.</p>
                          </div>
                          <div className="flex gap-3">
                            <span className="inline-block w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: neverColor }} />
                            <p><span className="font-medium">Never Volunteered</span> &mdash; Registered but has never completed a shift.</p>
                          </div>
                          <p className="text-muted-foreground pt-1">
                            Switch to &ldquo;By Shift Type&rdquo; to see which roles retain the most volunteers. The dot marker shows the prior period total for comparison.
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardTitle>
                  <SegmentedControl
                    value={breakdownView}
                    onChange={setBreakdownView}
                    options={[
                      { value: "overall", label: "Overall" },
                      { value: "shiftType", label: "By Shift Type" },
                    ]}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {breakdownView === "overall" ? (
                  data.breakdown.some((b) => b.value > 0) ? (
                    <div>
                      <ApexChart
                        options={{
                          ...base,
                          chart: { ...base.chart, type: "donut" as const },
                          labels: data.breakdown.map((b) => b.label),
                          colors: breakdownColors,
                          legend: {
                            ...base.legend,
                            position: "bottom" as const,
                            horizontalAlign: "center" as const,
                          },
                          dataLabels: {
                            enabled: true,
                            formatter: function (val: number) {
                              return Math.round(val) + "%";
                            },
                            style: insideLabelStyle(breakdownColors),
                            dropShadow: { enabled: false },
                          },
                          plotOptions: {
                            pie: {
                              donut: {
                                size: "68%",
                                labels: {
                                  show: true,
                                  name: {
                                    fontSize: "13px",
                                    fontFamily: tokens.axisStyle.fontFamily,
                                    fontWeight: 500,
                                    color: tokens.label,
                                    offsetY: -4,
                                  },
                                  value: {
                                    fontSize: "22px",
                                    fontFamily: tokens.axisStyle.fontFamily,
                                    fontWeight: 700,
                                    color: tokens.foreground,
                                    offsetY: 4,
                                    formatter: (val: string) =>
                                      Number(val).toLocaleString("en-NZ"),
                                  },
                                  total: {
                                    show: true,
                                    label: "Total",
                                    fontFamily: tokens.axisStyle.fontFamily,
                                    fontSize: "13px",
                                    fontWeight: 500,
                                    color: tokens.label,
                                    formatter: () =>
                                      data.breakdown
                                        .reduce((sum, b) => sum + b.value, 0)
                                        .toLocaleString("en-NZ"),
                                  },
                                },
                              },
                            },
                          },
                          stroke: { width: 2, colors: [tokens.surface] },
                          tooltip: {
                            ...base.tooltip,
                            y: {
                              formatter: (val: number) =>
                                plural(val, "volunteer"),
                            },
                          },
                        }}
                        series={data.breakdown.map((b) => b.value)}
                        type="donut"
                        height={280}
                      />
                      {data.breakdown.some((b) => b.prevValue > 0) && (
                        <div className="grid grid-cols-4 gap-2 mt-2 pt-3 border-t text-center">
                          {data.breakdown.map((b) => {
                            const diff = b.value - b.prevValue;
                            return (
                              <div key={b.label} className="text-xs">
                                <p className="text-muted-foreground truncate">
                                  {b.label}
                                </p>
                                <p className="font-semibold">{b.value}</p>
                                {b.prevValue > 0 && (
                                  <p
                                    className={
                                      b.label === "Inactive" || b.label === "Never Volunteered"
                                        ? diff > 0
                                          ? "text-red-700 dark:text-red-400"
                                          : diff < 0
                                            ? "text-emerald-700 dark:text-emerald-400"
                                            : "text-muted-foreground"
                                        : diff > 0
                                          ? "text-emerald-700 dark:text-emerald-400"
                                          : diff < 0
                                            ? "text-red-700 dark:text-red-400"
                                            : "text-muted-foreground"
                                    }
                                  >
                                    {diff > 0 ? "+" : ""}
                                    {diff} vs prior
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <ChartEmpty
                      height={320}
                      message="No volunteers registered yet"
                    />
                  )
                ) : shiftTypeData.length > 0 ? (
                  <ApexChart
                    options={{
                      ...base,
                      chart: {
                        ...base.chart,
                        type: "bar" as const,
                        stacked: true,
                      },
                      plotOptions: {
                        bar: {
                          horizontal: true,
                          borderRadius: 4,
                          borderRadiusApplication: "end" as const,
                          barHeight: "60%",
                        },
                      },
                      stroke: barGap(tokens),
                      xaxis: {
                        categories: shiftTypeData.map((s) => s.shiftTypeName),
                        labels: {
                          style: tokens.axisStyle,
                          formatter: (v: string) =>
                            String(Math.round(Number(v))),
                        },
                        title: {
                          text: "Volunteers",
                          style: {
                            fontFamily: tokens.axisStyle.fontFamily,
                            fontSize: "12px",
                            fontWeight: 400,
                            color: tokens.label,
                          },
                        },
                      },
                      yaxis: { labels: { style: tokens.catStyle } },
                      colors: [highlyActiveColor, activeColor],
                      dataLabels: {
                        enabled: true,
                        formatter: segmentLabel(
                          shiftTypeData.map((s) => s.highlyActive + s.active)
                        ),
                        style: insideLabelStyle([
                          highlyActiveColor,
                          activeColor,
                        ]),
                      },
                      grid: {
                        ...base.grid,
                        xaxis: { lines: { show: true } },
                        yaxis: { lines: { show: false } },
                      },
                      legend: { ...base.legend, show: true },
                      tooltip: {
                        ...base.tooltip,
                        shared: true,
                        intersect: false,
                        custom: function ({
                          dataPointIndex,
                        }: {
                          dataPointIndex: number;
                        }) {
                          const st = shiftTypeData[dataPointIndex];
                          if (!st) return "";
                          const currTotal = st.highlyActive + st.active;
                          const diffLabel =
                            st.prevTotal > 0
                              ? deltaHtml(
                                  currTotal - st.prevTotal,
                                  "vs prior",
                                  tokens
                                )
                              : "";
                          return `<div style="padding:8px 12px;font-size:12px;line-height:1.6">
                            <b>${st.shiftTypeName}</b><br/>
                            <span style="color:${highlyActiveColor}">\u25CF</span> Highly Active: ${st.highlyActive}<br/>
                            <span style="color:${activeColor}">\u25CF</span> Active: ${st.active}<br/>
                            <b>Total: ${currTotal}</b>
                            ${st.prevTotal > 0 ? `<br/>Prior period: ${st.prevTotal} ${diffLabel}` : ""}
                          </div>`;
                        },
                      },
                      annotations: {
                        points: shiftTypeData
                          .filter((s) => s.prevTotal > 0)
                          .map((s) => ({
                            x: s.prevTotal,
                            y: s.shiftTypeName as unknown as number,
                            marker: {
                              size: 5,
                              fillColor: tokens.palette.target,
                              strokeColor: tokens.surface,
                              strokeWidth: 2,
                              shape: "circle" as const,
                            },
                            label: {
                              text: "Prior: " + s.prevTotal,
                              borderWidth: 0,
                              style: {
                                fontSize: "12px",
                                fontFamily: tokens.axisStyle.fontFamily,
                                color: tokens.label,
                                background: "transparent",
                                padding: { left: 4, right: 4, top: 1, bottom: 1 },
                              },
                            },
                          })),
                      },
                    }}
                    series={[
                      {
                        name: "Highly Active",
                        data: shiftTypeData.map((s) => s.highlyActive),
                      },
                      {
                        name: "Active",
                        data: shiftTypeData.map((s) => s.active),
                      },
                    ]}
                    type="bar"
                    height={Math.max(320, shiftTypeData.length * 60)}
                  />
                ) : (
                  <ChartEmpty
                    height={320}
                    message="No completed shifts in this period"
                    hint="Try a longer time period or another location."
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Active Volunteers Trend */}
          <motion.div variants={staggerItem}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                    <ChartIcon icon={TrendingUp} accent="text-blue-500" />
                    Active Volunteers
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
                          <DialogTitle>Active Volunteers Trend</DialogTitle>
                          <DialogDescription>
                            How this chart tracks volunteer activity over time
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 text-sm">
                          <p>Shows the number of unique volunteers who completed at least one shift in each time period over the last 12 months.</p>
                          <p><span className="font-medium">Monthly view</span> shows the peak weekly count per calendar month. <span className="font-medium">Weekly view</span> shows the exact count per week for more granular detail.</p>
                          <p>The <span className="font-medium">dashed line</span> overlays the same period from the previous year, making it easy to spot year-over-year growth or decline.</p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardTitle>
                  <SegmentedControl
                    value={trendView}
                    onChange={setTrendView}
                    options={[
                      { value: "monthly", label: "Monthly" },
                      { value: "weekly", label: "Weekly" },
                    ]}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {currTrendData.some((t) => t.activeVolunteers > 0) ? (
                  <ApexChart
                    options={{
                      ...base,
                      chart: { ...base.chart, type: "area" as const },
                      xaxis: {
                        categories: trendCategories,
                        tickAmount: 12,
                        labels: {
                          hideOverlappingLabels: true,
                          style: tokens.axisStyle,
                        },
                        axisBorder: { show: false },
                        axisTicks: { show: false },
                      },
                      yaxis: {
                        labels: {
                          style: tokens.axisStyle,
                          formatter: (v: number) => String(Math.round(v)),
                        },
                        min: 0,
                        forceNiceScale: true,
                      },
                      colors: [tokens.palette.volunteers, tokens.palette.target],
                      stroke: {
                        curve: "smooth" as const,
                        width: [2.5, 2],
                        dashArray: [0, 5],
                      },
                      fill: {
                        type: ["gradient", "solid"],
                        opacity: [1, 0],
                        gradient: {
                          shadeIntensity: 1,
                          opacityFrom: 0.32,
                          opacityTo: 0.02,
                          stops: [0, 90, 100],
                        },
                      },
                      tooltip: {
                        ...base.tooltip,
                        shared: true,
                        y: {
                          formatter: function (val: number) {
                            if (val == null) return "";
                            return plural(val, "volunteer");
                          },
                        },
                      },
                      markers: {
                        size: isWeekly ? 0 : [4, 0],
                        strokeWidth: 2,
                        strokeColors: tokens.surface,
                        hover: { sizeOffset: 3 },
                      },
                      legend: {
                        ...base.legend,
                        show: true,
                        showForSingleSeries: true,
                      },
                    }}
                    series={[
                      {
                        name: "This Year",
                        data: currTrendData.map(
                          (t) => t.activeVolunteers
                        ),
                      },
                      ...(hasPrevYearData
                        ? [
                            {
                              name: "Previous Year",
                              data: prevTrendData.map(
                                (t) => t.activeVolunteers
                              ),
                            },
                          ]
                        : []),
                    ]}
                    type="area"
                    height={320}
                  />
                ) : (
                  <ChartEmpty
                    height={320}
                    message="No completed shifts in the last 12 months"
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Retention Heatmap */}
        <motion.div variants={staggerItem}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                    <ChartIcon icon={CalendarDays} accent="text-emerald-500" />
                    Monthly Retention
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
                          <DialogTitle>Monthly Retention Heatmap</DialogTitle>
                          <DialogDescription>
                            How cohort retention is measured
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 text-sm">
                          <p>Each row represents a <span className="font-medium">cohort</span> of volunteers grouped by the month they completed their first ever shift. The number in brackets is the cohort size.</p>
                          <p><span className="font-medium">&ldquo;Start&rdquo;</span> is always 100% &mdash; it&rsquo;s the month they joined. Each subsequent column (Month 1, Month 2, etc.) shows what percentage of that cohort completed at least one shift in that month.</p>
                          <p>Volunteers can skip months and return later, so a later month can sometimes be higher than an earlier one. This highlights re-engagement patterns.</p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <span className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded" style={{ backgroundColor: heatBins[4] }} /> 81–100%</span>
                            <span className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded" style={{ backgroundColor: heatBins[3] }} /> 61–80%</span>
                            <span className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded" style={{ backgroundColor: heatBins[2] }} /> 41–60%</span>
                            <span className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded" style={{ backgroundColor: heatBins[1] }} /> 21–40%</span>
                            <span className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded" style={{ backgroundColor: heatBins[0] }} /> 1–20%</span>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Grouped by first shift month
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                {retentionData.cohorts.length > 0 ? (
                <ApexChart
                  options={{
                    ...base,
                    chart: { ...base.chart, type: "heatmap" as const },
                    plotOptions: {
                      heatmap: {
                        radius: 4,
                        enableShades: false,
                        colorScale: {
                          ranges: [
                            { from: -1, to: -1, name: "No data yet" },
                            { from: 0, to: 0, name: "0%" },
                          ]
                            .map((r) => ({
                              ...r,
                              color: tokens.empty,
                              foreColor: tokens.label,
                            }))
                            .concat(
                              [
                                [1, 20],
                                [21, 40],
                                [41, 60],
                                [61, 80],
                                [81, 100],
                              ].map(([from, to], i) => ({
                                from,
                                to,
                                name: `${from}–${to}%`,
                                color: heatBins[i],
                                foreColor: readableInk(heatBins[i]),
                              }))
                            ),
                        },
                      },
                    },
                    dataLabels: {
                      enabled: true,
                      formatter: function (val: number) {
                        if (val < 0) return "";
                        return val + "%";
                      },
                      style: {
                        fontSize: "12px",
                        fontFamily: tokens.axisStyle.fontFamily,
                        fontWeight: 500,
                      },
                    },
                    xaxis: {
                      position: "top" as const,
                      labels: { style: tokens.axisStyle },
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                      tooltip: { enabled: false },
                    },
                    yaxis: { labels: { style: tokens.axisStyle } },
                    grid: { show: false },
                    stroke: { width: 2, colors: [tokens.surface] },
                    tooltip: {
                      ...base.tooltip,
                      custom: function ({
                        seriesIndex,
                        dataPointIndex,
                      }: {
                        seriesIndex: number;
                        dataPointIndex: number;
                      }) {
                        const cohort =
                          retentionData.cohorts[
                            retentionData.cohorts.length - 1 - seriesIndex
                          ];
                        if (!cohort) return "";
                        const val = cohort.retention[dataPointIndex];
                        if (val == null || val < 0) {
                          return `<div style="padding:8px 12px;font-size:12px">
                            <b>${cohort.label}</b> cohort (${cohort.size} volunteers)<br/>
                            Month ${dataPointIndex}: No data yet
                          </div>`;
                        }
                        const count = Math.round((val / 100) * cohort.size);
                        return `<div style="padding:8px 12px;font-size:12px;line-height:1.6">
                          <b>${cohort.label}</b> cohort (${cohort.size} volunteers)<br/>
                          Month ${dataPointIndex}: <b>${val}%</b> retained (${count} volunteers)
                        </div>`;
                      },
                      x: { show: false },
                    },
                    legend: {
                      ...base.legend,
                      show: true,
                      position: "bottom" as const,
                      horizontalAlign: "center" as const,
                    },
                  }}
                  series={retentionData.cohorts
                    .slice()
                    .reverse()
                    .map((cohort) => ({
                      name: `${cohort.label} (${cohort.size})`,
                      data: Array.from({ length: 12 }, (_, i) => ({
                        x: i === 0 ? "Start" : `Month ${i}`,
                        y:
                          cohort.retention[i] != null
                            ? cohort.retention[i]!
                            : -1,
                      })),
                    }))}
                  type="heatmap"
                  height={Math.max(300, retentionData.cohorts.length * 36 + 40)}
                />
                ) : (
                  <ChartEmpty
                    height={280}
                    message="No first shifts in the last 12 months"
                    hint="Cohorts appear once volunteers complete their first shift."
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>

        {/* Volunteer Table */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <ChartIcon icon={Users} accent="text-muted-foreground" />
                Volunteers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EngagementVolunteerTable
                data={volunteersData}
                months={initialMonths}
                location={initialLocation}
                initialSearch={tableSearch}
                initialStatus={tableStatus}
                sortBy={tableSortBy}
                sortOrder={tableSortOrder}
              />
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <EngagementSegmentDialog
        segment={activeSegment}
        open={activeSegment !== null}
        onOpenChange={(open) => {
          if (!open) setActiveSegment(null);
        }}
        months={initialMonths}
        location={initialLocation}
        days={initialDays}
      />
    </div>
  );
}
