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
  UtensilsCrossed,
  TrendingUp,
  Calendar,
  Loader2,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
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
import type { RestaurantAnalyticsData } from "@/lib/restaurant-analytics";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Props {
  data: RestaurantAnalyticsData;
  months: string;
  location: string;
  locations: Array<{ value: string; label: string }>;
}

const MONTHS_LABELS: Record<string, string> = {
  "1": "1 month",
  "3": "3 months",
  "6": "6 months",
  "12": "12 months",
};

function ProgressRing({
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

function YoYBadge({
  percent,
  prevValue,
  className = "",
}: {
  percent: number;
  prevValue: number;
  className?: string;
}) {
  if (prevValue === 0) return null;

  if (percent === 0) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground ${className}`}
      >
        <Minus className="h-3 w-3" />
        No change vs last year
      </span>
    );
  }

  const isPositive = percent > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isPositive
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400"
      } ${className}`}
    >
      {isPositive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {isPositive ? "+" : ""}
      {percent}% vs last year
    </span>
  );
}

export function RestaurantAnalyticsClient({
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
  const chartThemeMode = (
    resolvedTheme === "dark" ? "dark" : "light"
  ) as "dark" | "light";

  const handleApplyFilters = () => {
    const params = new URLSearchParams({ months, location });
    startTransition(() => {
      router.push(`/admin/analytics?${params}`);
    });
  };

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
        {/* Hero — Guests Served Overview */}
        <motion.div variants={staggerItem}>
          <Card className="overflow-hidden">
            <div className="flex flex-col md:flex-row">
              {/* Left: progress ring + total */}
              <div className="flex items-center gap-5 p-6">
                <div className="relative">
                  <ProgressRing
                    value={data.summary.totalMeals}
                    max={Math.max(data.summary.totalMeals, data.summary.prevYearTotalMeals) || 1}
                    color={data.summary.totalMeals >= data.summary.prevYearTotalMeals ? "#10b981" : "#f59e0b"}
                    size={72}
                    strokeWidth={6}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <UtensilsCrossed className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <p className="text-sm text-muted-foreground">
                        Total Guests Served
                      </p>
                      <p className="text-3xl font-bold tracking-tight">
                        {data.summary.totalMeals.toLocaleString()}
                      </p>
                      <YoYBadge
                        percent={data.summary.yoyChangePercent}
                        prevValue={data.summary.prevYearTotalMeals}
                        className="mt-0.5"
                      />
                      {data.summary.prevYearTotalMeals === 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Last {MONTHS_LABELS[initialMonths]}
                        </p>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-64">
                    Total meals served across all locations in the last{" "}
                    {MONTHS_LABELS[initialMonths]}.
                    {data.summary.prevYearTotalMeals > 0 && (
                      <>
                        {" "}
                        Previous year same period:{" "}
                        {data.summary.prevYearTotalMeals.toLocaleString()}
                      </>
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Right: secondary metrics */}
              <div className="flex-1 grid grid-cols-3 divide-x">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center justify-center p-5 cursor-help">
                      <Calendar className="h-4 w-4 text-muted-foreground mb-1" />
                      <p className="text-2xl font-bold tracking-tight">
                        {data.summary.prevYearTotalMeals > 0
                          ? data.summary.prevYearTotalMeals.toLocaleString()
                          : "\u2014"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last Year
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-56">
                    {data.summary.prevYearTotalMeals > 0
                      ? `Same ${MONTHS_LABELS[initialMonths]} period last year`
                      : "No data available for the same period last year"}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center justify-center p-5 cursor-help">
                      <UtensilsCrossed className="h-4 w-4 text-muted-foreground mb-1" />
                      <p className="text-2xl font-bold tracking-tight">
                        {data.summary.avgPerDay}
                      </p>
                      <p className="text-xs text-muted-foreground">Avg/Day</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-56">
                    Average meals served per operational day.
                    {data.summary.prevYearAvgPerDay > 0 && (
                      <> Previous year: {data.summary.prevYearAvgPerDay}/day</>
                    )}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center justify-center p-5 cursor-help">
                      <Calendar className="h-4 w-4 text-muted-foreground mb-1" />
                      <p className="text-2xl font-bold tracking-tight">
                        {data.summary.daysWithShifts}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Days Active
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-56">
                    Days with scheduled shifts.{" "}
                    {data.summary.daysWithRecords} of{" "}
                    {data.summary.daysWithShifts} days have recorded meal counts
                    (rest use defaults).
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trend */}
          <motion.div variants={staggerItem}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Monthly Trend
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
                        <DialogTitle>Monthly Meals Trend</DialogTitle>
                        <DialogDescription>
                          How this chart tracks meals served over time
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 text-sm">
                        <p>
                          Shows total meals served per month across all
                          locations. Includes both recorded counts and default
                          estimates for days without records.
                        </p>
                        <p>
                          The{" "}
                          <span className="font-medium">dashed line</span>{" "}
                          overlays the same months from the previous year,
                          making it easy to spot year-over-year growth or
                          seasonal patterns.
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.currentYearTrend.some((v) => v > 0) ? (
                  <Chart
                    options={{
                      chart: {
                        type: "area" as const,
                        toolbar: { show: false },
                        background: "transparent",
                      },
                      xaxis: {
                        categories: data.trendLabels,
                        labels: {
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
                          formatter: (val: number) =>
                            val >= 1000
                              ? `${(val / 1000).toFixed(1)}k`
                              : String(Math.round(val)),
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
                          formatter: (val: number) => {
                            if (val == null) return "";
                            return val.toLocaleString() + " meals";
                          },
                        },
                      },
                      markers: {
                        size: [4, 3],
                        strokeWidth: 2,
                        strokeColors: "#fff",
                        hover: { sizeOffset: 4 },
                      },
                      legend: {
                        show: data.hasPreviousYearData,
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
                        data: data.currentYearTrend,
                      },
                      ...(data.hasPreviousYearData
                        ? [
                            {
                              name: "Previous Year",
                              data: data.previousYearTrend,
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

          {/* Location Comparison */}
          <motion.div variants={staggerItem}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-emerald-500" />
                  Location Comparison
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
                        <DialogTitle>Location Comparison</DialogTitle>
                        <DialogDescription>
                          Year-over-year comparison by location
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 text-sm">
                        <p>
                          Compares total meals served at each location between
                          the current period and the same period last year.
                        </p>
                        <p>
                          The{" "}
                          <span className="font-medium">dot marker</span>{" "}
                          shows the previous year&rsquo;s total for each
                          location, making it easy to see growth or decline.
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.locationBreakdown.length > 0 ? (
                  <Chart
                    options={{
                      chart: {
                        type: "bar" as const,
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
                        categories: data.locationBreakdown.map(
                          (l) => l.location
                        ),
                        labels: {
                          formatter: (val: string) => {
                            const n = Number(val);
                            return n >= 1000
                              ? `${(n / 1000).toFixed(1)}k`
                              : val;
                          },
                          style: {
                            fontFamily:
                              "var(--font-libre-franklin), sans-serif",
                            fontSize: "11px",
                          },
                        },
                        title: {
                          text: "Meals Served",
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
                      colors: ["#10b981"],
                      dataLabels: {
                        enabled: true,
                        formatter: (val: number) =>
                          val > 0 ? val.toLocaleString() : "",
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
                        custom: ({
                          dataPointIndex,
                        }: {
                          dataPointIndex: number;
                        }) => {
                          const loc =
                            data.locationBreakdown[dataPointIndex];
                          if (!loc) return "";
                          const diff =
                            loc.totalMeals - loc.prevYearMeals;
                          const diffLabel =
                            loc.prevYearMeals > 0
                              ? diff > 0
                                ? `<span style="color:#10b981">+${diff.toLocaleString()} vs last year</span>`
                                : diff < 0
                                  ? `<span style="color:#ef4444">${diff.toLocaleString()} vs last year</span>`
                                  : `<span style="color:#64748b">No change</span>`
                              : "";
                          return `<div style="padding:8px 12px;font-size:12px;line-height:1.6">
                            <b>${loc.location}</b><br/>
                            This year: <b>${loc.totalMeals.toLocaleString()}</b><br/>
                            ${loc.prevYearMeals > 0 ? `Last year: ${loc.prevYearMeals.toLocaleString()}<br/>${diffLabel}<br/>` : ""}
                            Avg: ${loc.avgPerDay}/day
                          </div>`;
                        },
                      },
                      legend: { show: false },
                      annotations: data.hasPreviousYearData
                        ? {
                            points: data.locationBreakdown
                              .filter((l) => l.prevYearMeals > 0)
                              .map((l) => ({
                                x: l.prevYearMeals,
                                y: l.location as unknown as number,
                                marker: {
                                  size: 5,
                                  fillColor: "#64748b",
                                  strokeColor: "#fff",
                                  strokeWidth: 2,
                                  shape: "circle" as const,
                                },
                                label: {
                                  text:
                                    "Last yr: " +
                                    l.prevYearMeals.toLocaleString(),
                                  borderWidth: 0,
                                  style: {
                                    fontSize: "9px",
                                    fontFamily:
                                      "var(--font-libre-franklin), sans-serif",
                                    color: "#64748b",
                                    background: "transparent",
                                    padding: {
                                      left: 4,
                                      right: 4,
                                      top: 1,
                                      bottom: 1,
                                    },
                                  },
                                },
                              })),
                          }
                        : undefined,
                      theme: { mode: chartThemeMode },
                    }}
                    series={[
                      {
                        name: "This Year",
                        data: data.locationBreakdown.map(
                          (l) => l.totalMeals
                        ),
                      },
                    ]}
                    type="bar"
                    height={Math.max(
                      280,
                      data.locationBreakdown.length * 80
                    )}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">
                    No location data available
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Year-over-Year Summary */}
        {data.hasPreviousYearData && (
          <motion.div variants={staggerItem}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  Year-over-Year Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                  {[
                    {
                      label: "Total Meals",
                      current: data.summary.totalMeals,
                      previous: data.summary.prevYearTotalMeals,
                      format: (v: number) => v.toLocaleString(),
                    },
                    {
                      label: "Avg per Day",
                      current: data.summary.avgPerDay,
                      previous: data.summary.prevYearAvgPerDay,
                      format: (v: number) => String(v),
                    },
                  ].map((metric) => {
                    const diff = metric.current - metric.previous;
                    const pctChange =
                      metric.previous > 0
                        ? Math.round((diff / metric.previous) * 100)
                        : 0;
                    return (
                      <div
                        key={metric.label}
                        className="text-center space-y-1 py-3"
                      >
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {metric.label}
                        </p>
                        <p className="text-xl font-bold">
                          {metric.format(metric.current)}
                        </p>
                        {metric.previous > 0 ? (
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">
                              was {metric.format(metric.previous)}
                            </p>
                            <p
                              className={`text-xs font-medium ${
                                diff > 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : diff < 0
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {diff > 0 ? "+" : ""}
                              {metric.format(diff)} ({pctChange > 0 ? "+" : ""}
                              {pctChange}%)
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            &nbsp;
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Empty state */}
        {data.locationBreakdown.length === 0 &&
          !data.currentYearTrend.some((v) => v > 0) && (
            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <UtensilsCrossed className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No data available</p>
                  <p className="text-sm mt-1">
                    No meals served data found for the last{" "}
                    {MONTHS_LABELS[initialMonths]}
                    {initialLocation !== "all" &&
                      ` at ${initialLocation}`}
                    .
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
      </motion.div>
    </div>
  );
}
