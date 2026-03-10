"use client";

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
  Zap,
  UserCheck,
  UserMinus,
  UserX,
  RefreshCw,
  UserPlus,
  Activity,
  Loader2,
  CalendarDays,
  Info,
} from "lucide-react";
import dynamic from "next/dynamic";
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
import { EngagementVolunteerTable } from "./engagement-volunteer-table";
import type {
  EngagementSummaryData,
  EngagementVolunteersResult,
  RetentionHeatmapData,
  ShiftTypeEngagement,
} from "@/lib/engagement";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Props {
  data: EngagementSummaryData;
  shiftTypeData: ShiftTypeEngagement[];
  retentionData: RetentionHeatmapData;
  months: string;
  location: string;
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
  const [trendView, setTrendView] = useState<"monthly" | "weekly">("monthly");
  const [breakdownView, setBreakdownView] = useState<"overall" | "shiftType">("overall");
  const chartThemeMode = (resolvedTheme === "dark" ? "dark" : "light") as "dark" | "light";

  const handleApplyFilters = () => {
    const params = new URLSearchParams({ months, location });
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
    const monthMap = new Map<string, Set<string>>();
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
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="months">Time Period</Label>
                <Select value={months} onValueChange={setMonths}>
                  <SelectTrigger id="months">
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
                  <SelectTrigger id="location">
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
                    color="#10b981"
                    size={72}
                    strokeWidth={6}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
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
              <div className="flex-1 grid grid-cols-3 divide-x">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center justify-center p-5 cursor-help">
                      <Users className="h-4 w-4 text-muted-foreground mb-1" />
                      <p className="text-2xl font-bold tracking-tight">
                        {data.summary.totalVolunteers}
                      </p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-56">
                    All registered volunteers (excludes admins)
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center justify-center p-5 cursor-help">
                      <RefreshCw className="h-4 w-4 text-muted-foreground mb-1" />
                      <p className="text-2xl font-bold tracking-tight">
                        {data.summary.retentionRate}%
                      </p>
                      <p className="text-xs text-muted-foreground">Retention</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-56">
                    Of volunteers active in the prior period, the percentage who
                    also volunteered in the current period
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center justify-center p-5 cursor-help">
                      <UserPlus className="h-4 w-4 text-muted-foreground mb-1" />
                      <p className="text-2xl font-bold tracking-tight">
                        {data.summary.newInPeriodCount}
                      </p>
                      <p className="text-xs text-muted-foreground">New</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-56">
                    Volunteers who completed their first ever shift during the
                    selected period
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
              value: data.summary.highlyActiveCount,
              desc: "2+ shifts/month avg",
              tooltip:
                "Volunteers averaging 2 or more completed shifts per month during the selected period",
              bg: "bg-emerald-50 dark:bg-emerald-950/20",
              ring: "#10b981",
            },
            {
              label: "Active",
              value: data.summary.activeCount,
              desc: "1+ shift in period",
              tooltip:
                "Volunteers with at least 1 completed shift in the selected period (but fewer than 2/month avg)",
              bg: "bg-blue-50 dark:bg-blue-950/20",
              ring: "#3b82f6",
            },
            {
              label: "Inactive",
              value: data.summary.inactiveCount,
              desc: "No shifts in period",
              tooltip:
                "Volunteers who have completed shifts before but none during the selected period",
              bg: "bg-amber-50 dark:bg-amber-950/20",
              ring: "#f59e0b",
            },
            {
              label: "Never Volunteered",
              value: data.summary.neverVolunteeredCount,
              desc: "0 completed shifts",
              tooltip:
                "Registered volunteers who have never completed a shift",
              bg: "bg-red-50 dark:bg-red-950/20",
              ring: "#ef4444",
            },
          ].map((stat) => (
            <motion.div key={stat.label} variants={staggerItem}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className={`${stat.bg} border-0 cursor-help`}>
                    <CardContent className="flex items-center gap-4 py-5">
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
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    Engagement Breakdown
                    <Dialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DialogTrigger asChild>
                            <button className="text-muted-foreground hover:text-foreground transition-colors">
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
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            <p><span className="font-medium">Highly Active</span> &mdash; Averaging 2 or more completed shifts per month during the selected period.</p>
                          </div>
                          <div className="flex gap-3">
                            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                            <p><span className="font-medium">Active</span> &mdash; At least 1 completed shift in the period, but fewer than 2 per month on average.</p>
                          </div>
                          <div className="flex gap-3">
                            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                            <p><span className="font-medium">Inactive</span> &mdash; Has completed shifts before but none during the selected period.</p>
                          </div>
                          <div className="flex gap-3">
                            <span className="inline-block w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                            <p><span className="font-medium">Never Volunteered</span> &mdash; Registered but has never completed a shift.</p>
                          </div>
                          <p className="text-muted-foreground pt-1">
                            Switch to &ldquo;By Shift Type&rdquo; to see which roles retain the most volunteers. The dot marker shows the prior period total for comparison.
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardTitle>
                  <div className="flex items-center rounded-md border text-sm">
                    <button
                      onClick={() => setBreakdownView("overall")}
                      className={`px-3 py-1 rounded-l-md transition-colors ${
                        breakdownView === "overall"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      Overall
                    </button>
                    <button
                      onClick={() => setBreakdownView("shiftType")}
                      className={`px-3 py-1 rounded-r-md transition-colors ${
                        breakdownView === "shiftType"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      By Shift Type
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {breakdownView === "overall" ? (
                  data.breakdown.some((b) => b.value > 0) ? (
                    <div>
                      <Chart
                        options={{
                          chart: {
                            type: "donut" as const,
                            background: "transparent",
                          },
                          labels: data.breakdown.map((b) => b.label),
                          colors: data.breakdown.map((b) => b.color),
                          legend: {
                            position: "bottom" as const,
                            fontFamily: "var(--font-libre-franklin), sans-serif",
                            fontSize: "12px",
                            markers: { size: 6, offsetX: -2 },
                            itemMargin: { horizontal: 8, vertical: 4 },
                          },
                          dataLabels: {
                            enabled: true,
                            formatter: function (val: number) {
                              return Math.round(val) + "%";
                            },
                            style: {
                              fontSize: "11px",
                              fontFamily:
                                "var(--font-libre-franklin), sans-serif",
                              fontWeight: 600,
                            },
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
                                    fontFamily:
                                      "var(--font-libre-franklin), sans-serif",
                                    fontWeight: 500,
                                    offsetY: -4,
                                  },
                                  value: {
                                    fontSize: "22px",
                                    fontFamily:
                                      "var(--font-libre-franklin), sans-serif",
                                    fontWeight: 700,
                                    offsetY: 4,
                                  },
                                  total: {
                                    show: true,
                                    label: "Total",
                                    fontFamily:
                                      "var(--font-libre-franklin), sans-serif",
                                    fontSize: "13px",
                                    fontWeight: 500,
                                  },
                                },
                              },
                            },
                          },
                          stroke: { width: 2, colors: ["var(--card)"] },
                          theme: { mode: chartThemeMode },
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
                                          ? "text-red-500"
                                          : diff < 0
                                            ? "text-emerald-500"
                                            : "text-muted-foreground"
                                        : diff > 0
                                          ? "text-emerald-500"
                                          : diff < 0
                                            ? "text-red-500"
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
                    <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">
                      No data available
                    </div>
                  )
                ) : shiftTypeData.length > 0 ? (
                  <Chart
                    options={{
                      chart: {
                        type: "bar" as const,
                        stacked: true,
                        toolbar: { show: false },
                        background: "transparent",
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
                        categories: shiftTypeData.map((s) => s.shiftTypeName),
                        labels: {
                          style: {
                            fontFamily:
                              "var(--font-libre-franklin), sans-serif",
                            fontSize: "11px",
                          },
                        },
                        title: {
                          text: "Volunteers",
                          style: {
                            fontFamily:
                              "var(--font-libre-franklin), sans-serif",
                            fontSize: "11px",
                            fontWeight: 400,
                          },
                        },
                      },
                      yaxis: {
                        labels: {
                          style: {
                            fontFamily:
                              "var(--font-libre-franklin), sans-serif",
                            fontSize: "12px",
                          },
                        },
                      },
                      colors: ["#10b981", "#3b82f6"],
                      dataLabels: {
                        enabled: true,
                        formatter: function (val: number) {
                          return val > 0 ? String(val) : "";
                        },
                        style: {
                          fontFamily:
                            "var(--font-libre-franklin), sans-serif",
                          fontSize: "11px",
                          fontWeight: 600,
                        },
                      },
                      grid: {
                        borderColor: "#e5e7eb",
                        strokeDashArray: 4,
                        yaxis: { lines: { show: false } },
                      },
                      tooltip: {
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
                          const diff = currTotal - st.prevTotal;
                          const diffLabel =
                            st.prevTotal > 0
                              ? diff > 0
                                ? `<span style="color:#10b981">+${diff} vs prior</span>`
                                : diff < 0
                                  ? `<span style="color:#ef4444">${diff} vs prior</span>`
                                  : `<span style="color:#64748b">no change</span>`
                              : "";
                          return `<div style="padding:8px 12px;font-size:12px;line-height:1.6">
                            <b>${st.shiftTypeName}</b><br/>
                            <span style="color:#10b981">\u25CF</span> Highly Active: ${st.highlyActive}<br/>
                            <span style="color:#3b82f6">\u25CF</span> Active: ${st.active}<br/>
                            <b>Total: ${currTotal}</b>
                            ${st.prevTotal > 0 ? `<br/>Prior period: ${st.prevTotal} ${diffLabel}` : ""}
                          </div>`;
                        },
                      },
                      legend: {
                        position: "top" as const,
                        fontSize: "12px",
                        fontFamily:
                          "var(--font-libre-franklin), sans-serif",
                        markers: { size: 6, offsetX: -2 },
                      },
                      annotations: {
                        points: shiftTypeData
                          .filter((s) => s.prevTotal > 0)
                          .map((s) => ({
                            x: s.prevTotal,
                            y: s.shiftTypeName as unknown as number,
                            marker: {
                              size: 5,
                              fillColor: "#64748b",
                              strokeColor: "#fff",
                              strokeWidth: 2,
                              shape: "circle" as const,
                            },
                            label: {
                              text: "Prior: " + s.prevTotal,
                              borderWidth: 0,
                              style: {
                                fontSize: "9px",
                                fontFamily:
                                  "var(--font-libre-franklin), sans-serif",
                                color: "#64748b",
                                background: "transparent",
                                padding: { left: 4, right: 4, top: 1, bottom: 1 },
                              },
                            },
                          })),
                      },
                      theme: { mode: chartThemeMode },
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
                  <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">
                    No shift type data available
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Active Volunteers Trend */}
          <motion.div variants={staggerItem}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    Active Volunteers
                    <Dialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DialogTrigger asChild>
                            <button className="text-muted-foreground hover:text-foreground transition-colors">
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
                  <div className="flex items-center rounded-md border text-sm">
                    <button
                      onClick={() => setTrendView("monthly")}
                      className={`px-3 py-1 rounded-l-md transition-colors ${
                        trendView === "monthly"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setTrendView("weekly")}
                      className={`px-3 py-1 rounded-r-md transition-colors ${
                        trendView === "weekly"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      Weekly
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {currTrendData.length > 0 ? (
                  <Chart
                    options={{
                      chart: {
                        type: "area" as const,
                        toolbar: { show: false },
                        background: "transparent",
                      },
                      xaxis: {
                        categories: trendCategories,
                        tickAmount: 12,
                        labels: {
                          hideOverlappingLabels: true,
                          style: {
                            fontFamily:
                              "var(--font-libre-franklin), sans-serif",
                            fontSize: "11px",
                          },
                        },
                        axisBorder: { show: false },
                        axisTicks: { show: false },
                      },
                      yaxis: {
                        labels: {
                          style: {
                            fontFamily:
                              "var(--font-libre-franklin), sans-serif",
                            fontSize: "11px",
                          },
                        },
                        min: 0,
                      },
                      colors: ["#3b82f6", "#64748b"],
                      stroke: {
                        curve: "smooth" as const,
                        width: [2.5, 2],
                        dashArray: [0, 5],
                      },
                      fill: {
                        type: "gradient",
                        gradient: {
                          shadeIntensity: 1,
                          opacityFrom: 0.35,
                          opacityTo: 0.02,
                          stops: [0, 90, 100],
                        },
                      },
                      dataLabels: { enabled: false },
                      grid: {
                        borderColor: "#e5e7eb",
                        strokeDashArray: 4,
                        xaxis: { lines: { show: false } },
                      },
                      tooltip: {
                        shared: true,
                        y: {
                          formatter: function (val: number) {
                            if (val == null) return "";
                            return val + " volunteers";
                          },
                        },
                      },
                      markers: {
                        size: isWeekly ? 0 : [4, 3],
                        strokeWidth: 2,
                        strokeColors: "#fff",
                        hover: { sizeOffset: 4 },
                      },
                      legend: {
                        show: hasPrevYearData,
                        position: "top" as const,
                        fontSize: "12px",
                        fontFamily:
                          "var(--font-libre-franklin), sans-serif",
                        markers: { size: 6, offsetX: -2 },
                      },
                      theme: { mode: chartThemeMode },
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
                  <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">
                    No trend data available
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Retention Heatmap */}
        {retentionData.cohorts.length > 0 && (
          <motion.div variants={staggerItem}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-emerald-500" />
                    Monthly Retention
                    <Dialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DialogTrigger asChild>
                            <button className="text-muted-foreground hover:text-foreground transition-colors">
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
                            <span className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded bg-emerald-500" /> 81–100%</span>
                            <span className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded bg-green-500" /> 61–80%</span>
                            <span className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded bg-yellow-500" /> 41–60%</span>
                            <span className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded bg-orange-500" /> 21–40%</span>
                            <span className="flex items-center gap-1.5 text-xs"><span className="w-3 h-3 rounded bg-red-500" /> 1–20%</span>
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
                <Chart
                  options={{
                    chart: {
                      type: "heatmap" as const,
                      toolbar: { show: false },
                      background: "transparent",
                    },
                    plotOptions: {
                      heatmap: {
                        radius: 4,
                        enableShades: false,
                        colorScale: {
                          ranges: [
                            {
                              from: -1,
                              to: -1,
                              color: resolvedTheme === "dark" ? "#1e293b" : "#f1f5f9",
                              name: "N/A",
                            },
                            {
                              from: 0,
                              to: 0,
                              color: resolvedTheme === "dark" ? "#1e293b" : "#f1f5f9",
                              name: "0%",
                            },
                            {
                              from: 1,
                              to: 20,
                              color: "#ef4444",
                              name: "1–20%",
                            },
                            {
                              from: 21,
                              to: 40,
                              color: "#f97316",
                              name: "21–40%",
                            },
                            {
                              from: 41,
                              to: 60,
                              color: "#eab308",
                              name: "41–60%",
                            },
                            {
                              from: 61,
                              to: 80,
                              color: "#22c55e",
                              name: "61–80%",
                            },
                            {
                              from: 81,
                              to: 100,
                              color: "#10b981",
                              name: "81–100%",
                            },
                          ],
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
                        fontSize: "11px",
                        fontFamily: "var(--font-libre-franklin), sans-serif",
                        fontWeight: 500,
                        colors: [resolvedTheme === "dark" ? "#e2e8f0" : "#1e293b"],
                      },
                    },
                    xaxis: {
                      position: "top" as const,
                      labels: {
                        style: {
                          fontFamily: "var(--font-libre-franklin), sans-serif",
                          fontSize: "11px",
                        },
                      },
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                      tooltip: { enabled: false },
                    },
                    yaxis: {
                      labels: {
                        style: {
                          fontFamily: "var(--font-libre-franklin), sans-serif",
                          fontSize: "11px",
                        },
                      },
                    },
                    grid: { show: false },
                    stroke: {
                      width: 2,
                      colors: [resolvedTheme === "dark" ? "#0f172a" : "#ffffff"],
                    },
                    tooltip: {
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
                    legend: { show: false },
                    theme: { mode: chartThemeMode },
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
                  height={Math.max(280, retentionData.cohorts.length * 36)}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Volunteer Table */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
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
    </div>
  );
}
