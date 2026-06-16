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
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
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
  HandCoins,
  Wallet,
  UserPlus,
  Percent,
  ShoppingBag,
  Salad,
  Beef,
  CloudSun,
  Download,
} from "lucide-react";
import { toast } from "sonner";
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
import { DayOfWeekFilter } from "@/components/day-of-week-filter";
import { StackModeToggle, type StackMode } from "@/components/stack-mode-toggle";
import { ServiceNightsTable } from "@/components/service-nights-table";
import { RestaurantReports } from "@/components/restaurant-reports";
import type { RestaurantAnalyticsData } from "@/lib/restaurant-analytics";
import type { RestaurantReports as RestaurantReportsData } from "@/lib/restaurant-reports";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const FONT = "var(--font-libre-franklin), sans-serif";

interface Props {
  data: RestaurantAnalyticsData;
  reports: RestaurantReportsData;
  months: string;
  location: string;
  days: string;
  from: string;
  to: string;
  locations: Array<{ value: string; label: string }>;
}

const MONTHS_LABELS: Record<string, string> = {
  "1": "1 month",
  "3": "3 months",
  "6": "6 months",
  "12": "12 months",
  all: "all time",
};

const nzd = (n: number, decimals = 0) =>
  new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);

const num = (n: number) => n.toLocaleString("en-NZ");

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

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  footer,
  tooltip,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
  footer?: React.ReactNode;
  tooltip?: string;
}) {
  const body = (
    <Card className="h-full gap-0 py-3">
      <CardContent className="px-4">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className={`h-4 w-4 ${accent}`} />
          <span className="text-[11px] font-medium uppercase tracking-wide">
            {label}
          </span>
        </div>
        <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">
          {value}
        </p>
        {footer && <div className="mt-1 min-h-4">{footer}</div>}
      </CardContent>
    </Card>
  );

  if (!tooltip) return body;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help h-full">{body}</div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-60">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function InfoDialog({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <button
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={`About ${title}`}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">More info</TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
      {message}
    </div>
  );
}

export function RestaurantAnalyticsClient({
  data,
  reports,
  months: initialMonths,
  location: initialLocation,
  days: initialDays,
  from: initialFrom,
  to: initialTo,
  locations,
}: Props) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [isPending, startTransition] = useTransition();
  const [months, setMonths] = useState(initialMonths);
  const [location, setLocation] = useState(initialLocation);
  const [days, setDays] = useState(initialDays);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [trendView, setTrendView] = useState<"monthly" | "weekly">("monthly");
  const [kohaStack, setKohaStack] = useState<StackMode>("stacked");
  const [exporting, setExporting] = useState(false);
  const chartThemeMode = (resolvedTheme === "dark" ? "dark" : "light") as
    | "dark"
    | "light";

  const hasCustomRange = from !== "" && to !== "" && from <= to;
  // One end filled but not a valid pair → block apply with a hint.
  const rangeError = (from !== "" || to !== "") && !hasCustomRange;
  const fromDate = from ? new Date(`${from}T00:00:00`) : undefined;
  const toDate = to ? new Date(`${to}T00:00:00`) : undefined;

  const s = data.serviceStats;
  const filterKey = `${initialMonths}-${initialLocation}-${initialDays}-${initialFrom}-${initialTo}`;
  const rangeLabel =
    initialMonths === "all"
      ? "all time"
      : initialFrom && initialTo
        ? "selected range"
        : `last ${MONTHS_LABELS[initialMonths]}`;

  const handleApplyFilters = () => {
    if (rangeError) return;
    const params = new URLSearchParams({ months, location });
    if (days) params.set("days", days);
    if (hasCustomRange) {
      params.set("from", from);
      params.set("to", to);
    }
    startTransition(() => {
      // Preserve scroll position — only the query string changes
      router.push(`/admin/analytics?${params}`, { scroll: false });
    });
  };

  // Export every service night for the *applied* filters (what's on screen) as CSV.
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        months: initialMonths,
        location: initialLocation,
        format: "csv",
      });
      if (initialDays) params.set("days", initialDays);
      if (initialFrom && initialTo) {
        params.set("from", initialFrom);
        params.set("to", initialTo);
      }
      const res = await fetch(`/api/admin/analytics/service-nights?${params}`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const text = await res.text();
      const rows = Math.max(0, text.trim().split("\n").length - 1); // minus header
      const filename =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="?([^"]+)"?/)?.[1] ?? "service-nights.csv";
      const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(
        `Exported ${rows.toLocaleString()} service night${rows === 1 ? "" : "s"}`
      );
    } catch (error) {
      console.error("Error exporting service nights:", error);
      toast.error("Couldn't export CSV");
    } finally {
      setExporting(false);
    }
  };

  const labelColor = chartThemeMode === "dark" ? "#94a3b8" : "#475569";
  const axisStyle = { fontFamily: FONT, fontSize: "11px", colors: labelColor };
  const catStyle = { fontFamily: FONT, fontSize: "12px", colors: labelColor };
  const gridColor = chartThemeMode === "dark" ? "#334155" : "#e5e7eb";

  // ---- KPI cards ----
  const kpis: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    accent: string;
    footer?: React.ReactNode;
    tooltip?: string;
  }> = [
    {
      icon: UtensilsCrossed,
      label: "Guests served",
      value: num(data.summary.totalMeals),
      accent: "text-emerald-500",
      footer: (
        <YoYBadge
          percent={data.summary.yoyChangePercent}
          prevValue={data.summary.prevYearTotalMeals}
        />
      ),
      tooltip: `Total guests served in the ${rangeLabel} (recorded counts plus defaults for days without a record).`,
    },
    {
      icon: HandCoins,
      label: "Total koha",
      value: nzd(s.totalKoha),
      accent: "text-amber-500",
      footer: (
        <div className="flex flex-col gap-0.5">
          <YoYBadge percent={s.kohaYoyPercent} prevValue={s.prevTotalKoha} />
          {s.kohaTargetPercent !== null && (
            <span
              className={`text-xs font-medium ${
                s.kohaTargetPercent >= 100
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
              }`}
            >
              {s.kohaTargetPercent}% of target
            </span>
          )}
        </div>
      ),
      tooltip:
        "Total koha collected (cash + eftpos + Stripe) across recorded service nights. 'of target' compares to each location's per-night koha target.",
    },
    {
      icon: Wallet,
      label: "Koha / head",
      value: s.perHead === null ? "—" : nzd(s.perHead, 2),
      accent: "text-amber-500",
      footer: (
        <span className="text-xs text-muted-foreground">
          {s.perPaying === null
            ? "per guest served"
            : `${nzd(s.perPaying, 2)} per paying`}
        </span>
      ),
      tooltip:
        "Average koha per guest on nights where koha was recorded. The footer shows koha per paying guest (excluding non-paying).",
    },
    {
      icon: UserPlus,
      label: "New volunteers",
      value: num(s.newVolunteers),
      accent: "text-blue-500",
      tooltip:
        "First-time volunteers across the period (their first confirmed shift fell in this window).",
    },
    {
      icon: Percent,
      label: "Non-paying",
      value: s.nonPayingPercent === null ? "—" : `${s.nonPayingPercent}%`,
      accent: "text-rose-500",
      footer: (
        <span className="text-xs text-muted-foreground">
          {num(s.nonPayingCount)} guests
        </span>
      ),
      tooltip:
        "Share of recorded guests who didn't contribute koha (non-paying count ÷ guests served).",
    },
    {
      icon: ShoppingBag,
      label: "Takeaways",
      value: num(s.takeaways),
      accent: "text-violet-500",
      tooltip: "Total takeaway meals across recorded service nights.",
    },
    {
      icon: Salad,
      label: "Vege meals",
      value: num(s.vege),
      accent: "text-green-500",
      tooltip: "Total vegetarian meals across recorded service nights.",
    },
    {
      icon: Calendar,
      label: "Avg / day",
      value: num(data.summary.avgPerDay),
      accent: "text-sky-500",
      footer: (
        <span className="text-xs text-muted-foreground">
          {num(data.summary.daysWithShifts)} days active
        </span>
      ),
      tooltip:
        "Average guests served per operational day. 'Days active' counts days with scheduled shifts.",
    },
  ];

  const kohaMixTotal = s.cash + s.eftpos + s.stripe;

  return (
    <div className="space-y-6">
      {/* Filters — floating sticky toolbar */}
      <Card className="sticky top-2 z-20 shadow-md border-border/80 supports-[backdrop-filter]:bg-card/95 supports-[backdrop-filter]:backdrop-blur">
        <CardContent className="py-4">
          <div className="flex flex-col gap-4">
            {/* Row 1: period + custom range + location */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="months">Time Period</Label>
                <Select
                  value={hasCustomRange ? "custom" : months}
                  onValueChange={(v) => {
                    if (v === "custom") return;
                    setMonths(v);
                    setFrom("");
                    setTo("");
                  }}
                >
                  <SelectTrigger id="months">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Last 1 month</SelectItem>
                    <SelectItem value="3">Last 3 months</SelectItem>
                    <SelectItem value="6">Last 6 months</SelectItem>
                    <SelectItem value="12">Last 12 months</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                    {hasCustomRange && (
                      <SelectItem value="custom">Custom range</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-range">Date range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date-range"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !hasCustomRange && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4 shrink-0" />
                      {fromDate && toDate ? (
                        <span className="truncate">
                          {format(fromDate, "MMM d")} – {format(toDate, "MMM d, yyyy")}
                        </span>
                      ) : fromDate ? (
                        <span className="truncate">
                          {format(fromDate, "MMM d, yyyy")} – …
                        </span>
                      ) : (
                        <span>Pick a range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      defaultMonth={fromDate}
                      selected={{ from: fromDate, to: toDate }}
                      onSelect={(range) => {
                        setFrom(range?.from ? format(range.from, "yyyy-MM-dd") : "");
                        setTo(range?.to ? format(range.to, "yyyy-MM-dd") : "");
                      }}
                      numberOfMonths={2}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
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
            {/* Row 2: day-of-week + apply */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1">
                <DayOfWeekFilter value={days} onChange={setDays} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {hasCustomRange && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setFrom("");
                      setTo("");
                    }}
                    className="text-muted-foreground"
                  >
                    Clear range
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleExport}
                  disabled={exporting}
                  className="sm:w-auto w-full"
                  title="Download the applied service-night data as a CSV"
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Export CSV
                </Button>
                <Button
                  onClick={handleApplyFilters}
                  className="sm:w-auto w-full"
                  disabled={isPending || rangeError}
                >
                  {isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Apply Filters
                </Button>
              </div>
            </div>
            {rangeError && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Set both From and To dates (From must be on or before To).
              </p>
            )}
            {hasCustomRange && (
              <p className="text-xs text-muted-foreground">
                Showing a custom date range — overrides the time-period preset.
              </p>
            )}
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
        {/* KPI grid */}
        <motion.div variants={staggerItem}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map((kpi) => (
              <StatCard key={kpi.label} {...kpi} />
            ))}
          </div>
          {!data.hasServiceStats && (
            <p className="mt-2 text-xs text-muted-foreground">
              Koha, volunteer and service-mix figures come from recorded service
              nights — none found for this period yet.
            </p>
          )}
        </motion.div>

        {/* Trends: guests + koha */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Guests trend */}
          <motion.div variants={staggerItem}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    Guests Trend
                    <InfoDialog
                      title="Guests Trend"
                      description="How this chart tracks guests served over time"
                    >
                      <p>
                        Total guests served per {trendView === "weekly" ? "week" : "month"}{" "}
                        across all locations. Includes recorded counts and default
                        estimates for days without records.
                      </p>
                      <p>
                        The <span className="font-medium">dashed line</span>{" "}
                        overlays the same period last year to spot year-over-year
                        trends.
                      </p>
                    </InfoDialog>
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
                {(() => {
                  const isWeekly = trendView === "weekly";
                  const labels = isWeekly ? data.weeklyLabels : data.trendLabels;
                  const currentData = isWeekly
                    ? data.currentYearWeekly
                    : data.currentYearTrend;
                  const prevData = isWeekly
                    ? data.previousYearWeekly
                    : data.previousYearTrend;
                  const hasPrev = prevData.some((v) => v > 0);

                  return currentData.some((v) => v > 0) ? (
                    <Chart
                      key={`trend-${trendView}-${filterKey}`}
                      options={{
                        chart: {
                          type: "area" as const,
                          toolbar: { show: false },
                          background: "transparent",
                        },
                        xaxis: {
                          categories: labels,
                          tickAmount: isWeekly ? 12 : undefined,
                          labels: { style: axisStyle },
                          axisBorder: { show: false },
                          axisTicks: { show: false },
                        },
                        yaxis: {
                          labels: {
                            formatter: (val: number) =>
                              val >= 1000
                                ? `${(val / 1000).toFixed(1)}k`
                                : String(Math.round(val)),
                            style: axisStyle,
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
                          borderColor: gridColor,
                          strokeDashArray: 4,
                          xaxis: { lines: { show: false } },
                        },
                        tooltip: {
                          shared: true,
                          y: {
                            formatter: (val: number) =>
                              val == null ? "" : `${num(val)} guests`,
                          },
                        },
                        markers: {
                          size: isWeekly ? 0 : [4, 3],
                          strokeWidth: 2,
                          strokeColors: "#fff",
                          hover: { sizeOffset: 4 },
                        },
                        legend: {
                          show: hasPrev,
                          position: "top" as const,
                          fontSize: "12px",
                          fontFamily: FONT,
                          markers: { size: 6, offsetX: -2 },
                        },
                        theme: { mode: chartThemeMode },
                      }}
                      series={[
                        { name: "This Year", data: currentData },
                        ...(hasPrev
                          ? [{ name: "Previous Year", data: prevData }]
                          : []),
                      ]}
                      type="area"
                      height={300}
                    />
                  ) : (
                    <ChartEmpty message="No guest data available" />
                  );
                })()}
              </CardContent>
            </Card>
          </motion.div>

          {/* Koha trend */}
          <motion.div variants={staggerItem}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <HandCoins className="h-4 w-4 text-amber-500" />
                    Koha Trend
                    <InfoDialog
                      title="Koha Trend"
                      description="Monthly koha collected, split by method"
                    >
                      <p>
                        Total koha each month, split by method (cash, eftpos and
                        Stripe), across recorded service nights.
                      </p>
                      <p>
                        Switch to <span className="font-medium">100%</span> to see
                        each method&rsquo;s share of the monthly total instead of
                        absolute dollars.
                      </p>
                      {data.hasKohaTarget && (
                        <p>
                          The <span className="font-medium">dashed line</span> is
                          the koha target for the month (each location&rsquo;s
                          per-night target × its service nights). It only shows in
                          the Stacked view.
                        </p>
                      )}
                    </InfoDialog>
                  </CardTitle>
                  <StackModeToggle value={kohaStack} onChange={setKohaStack} />
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const is100 = kohaStack === "100%";
                  // The target line is an absolute dollar figure — it has no
                  // meaning once bars are normalised to 100%, so hide it there.
                  const showTarget = data.hasKohaTarget && !is100;

                  return data.kohaTrend.some((v) => v > 0) ? (
                    <Chart
                      key={`koha-trend-${filterKey}-${kohaStack}`}
                      options={{
                        chart: {
                          type: "line" as const,
                          stacked: true,
                          stackType: is100 ? ("100%" as const) : ("normal" as const),
                          toolbar: { show: false },
                          background: "transparent",
                        },
                        xaxis: {
                          categories: data.trendLabels,
                          labels: { style: axisStyle },
                          axisBorder: { show: false },
                          axisTicks: { show: false },
                        },
                        yaxis: {
                          labels: {
                            formatter: (val: number) =>
                              is100
                                ? `${Math.round(val)}%`
                                : val >= 1000
                                  ? `$${(val / 1000).toFixed(1)}k`
                                  : `$${Math.round(val)}`,
                            style: axisStyle,
                          },
                          min: 0,
                          max: is100 ? 100 : undefined,
                        },
                        colors: ["#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444"],
                        plotOptions: {
                          bar: {
                            columnWidth: "55%",
                            borderRadius: 3,
                            borderRadiusApplication: "end" as const,
                          },
                        },
                        stroke: {
                          width: showTarget ? [0, 0, 0, 2.5] : [0, 0, 0],
                          curve: "smooth" as const,
                          dashArray: showTarget ? [0, 0, 0, 5] : [0, 0, 0],
                        },
                        fill: { opacity: 1 },
                        dataLabels: { enabled: false },
                        grid: {
                          borderColor: gridColor,
                          strokeDashArray: 4,
                          xaxis: { lines: { show: false } },
                        },
                        tooltip: {
                          shared: true,
                          y: { formatter: (val: number) => nzd(val ?? 0, 2) },
                        },
                        markers: { size: 0, hover: { sizeOffset: 3 } },
                        legend: {
                          position: "top" as const,
                          fontSize: "12px",
                          fontFamily: FONT,
                          markers: { size: 6, offsetX: -2 },
                        },
                        theme: { mode: chartThemeMode },
                      }}
                      series={[
                        { name: "Cash", type: "column", data: data.kohaStreamTrend.cash },
                        { name: "Eftpos", type: "column", data: data.kohaStreamTrend.eftpos },
                        {
                          name: "Stripe",
                          type: "column",
                          data: data.kohaStreamTrend.stripe,
                        },
                        ...(showTarget
                          ? [
                              {
                                name: "Target",
                                type: "line" as const,
                                data: data.kohaTargetTrend,
                              },
                            ]
                          : []),
                      ]}
                      type="line"
                      height={300}
                    />
                  ) : (
                    <ChartEmpty message="No koha recorded yet" />
                  );
                })()}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Breakdown: koha mix + location comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Koha mix donut */}
          <motion.div variants={staggerItem}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-amber-500" />
                  Koha by Method
                  <InfoDialog
                    title="Koha by Method"
                    description="How koha was collected"
                  >
                    <p>
                      Breakdown of total koha across the three payment streams:
                      cash, eftpos and Stripe.
                    </p>
                  </InfoDialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {kohaMixTotal > 0 ? (
                  <Chart
                    key={`koha-mix-${filterKey}`}
                    options={{
                      chart: { type: "donut" as const, background: "transparent" },
                      labels: ["Cash", "Eftpos", "Stripe"],
                      colors: ["#f59e0b", "#3b82f6", "#8b5cf6"],
                      stroke: { width: 0 },
                      dataLabels: {
                        enabled: true,
                        formatter: (val: number) => `${Math.round(val)}%`,
                        style: { fontFamily: FONT, fontSize: "11px" },
                      },
                      legend: {
                        position: "bottom" as const,
                        fontFamily: FONT,
                        fontSize: "12px",
                      },
                      tooltip: {
                        y: { formatter: (val: number) => nzd(val ?? 0, 2) },
                      },
                      plotOptions: {
                        pie: {
                          donut: {
                            size: "62%",
                            labels: {
                              show: true,
                              total: {
                                show: true,
                                label: "Total",
                                fontFamily: FONT,
                                fontSize: "12px",
                                formatter: () => nzd(kohaMixTotal),
                              },
                              value: {
                                fontFamily: FONT,
                                formatter: (val: string) =>
                                  nzd(Number(val), 0),
                              },
                            },
                          },
                        },
                      },
                      theme: { mode: chartThemeMode },
                    }}
                    series={[s.cash, s.eftpos, s.stripe]}
                    type="donut"
                    height={300}
                  />
                ) : (
                  <ChartEmpty message="No koha recorded yet" />
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Location comparison (guests) */}
          <motion.div variants={staggerItem}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-emerald-500" />
                  Guests by Location
                  <InfoDialog
                    title="Guests by Location"
                    description="Year-over-year comparison by location"
                  >
                    <p>
                      Compares total guests served at each location with the same
                      period last year.
                    </p>
                    <p>
                      The <span className="font-medium">dot marker</span> shows
                      last year&rsquo;s total for each location.
                    </p>
                  </InfoDialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.locationBreakdown.length > 0 ? (
                  <Chart
                    key={`loc-${filterKey}`}
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
                            return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : val;
                          },
                          style: axisStyle,
                        },
                        title: {
                          text: "Guests served",
                          style: { fontFamily: FONT, fontSize: "11px", fontWeight: 400 },
                        },
                      },
                      yaxis: { labels: { style: catStyle } },
                      colors: ["#10b981"],
                      dataLabels: {
                        enabled: true,
                        formatter: (val: number) => (val > 0 ? num(val) : ""),
                        style: { fontFamily: FONT, fontSize: "11px", fontWeight: 600 },
                      },
                      grid: {
                        borderColor: gridColor,
                        strokeDashArray: 4,
                        yaxis: { lines: { show: false } },
                      },
                      tooltip: {
                        shared: true,
                        intersect: false,
                        custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
                          const loc = data.locationBreakdown[dataPointIndex];
                          if (!loc) return "";
                          const diff = loc.totalMeals - loc.prevYearMeals;
                          const diffLabel =
                            loc.prevYearMeals > 0
                              ? diff > 0
                                ? `<span style="color:#10b981">+${num(diff)} vs last year</span>`
                                : diff < 0
                                  ? `<span style="color:#ef4444">${num(diff)} vs last year</span>`
                                  : `<span style="color:#64748b">No change</span>`
                              : "";
                          return `<div style="padding:8px 12px;font-size:12px;line-height:1.6">
                            <b>${loc.location}</b><br/>
                            This year: <b>${num(loc.totalMeals)}</b><br/>
                            ${loc.prevYearMeals > 0 ? `Last year: ${num(loc.prevYearMeals)}<br/>${diffLabel}<br/>` : ""}
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
                                  text: "Last yr: " + num(l.prevYearMeals),
                                  borderWidth: 0,
                                  style: {
                                    fontSize: "9px",
                                    fontFamily: FONT,
                                    color: "#64748b",
                                    background: "transparent",
                                    padding: { left: 4, right: 4, top: 1, bottom: 1 },
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
                        data: data.locationBreakdown.map((l) => l.totalMeals),
                      },
                    ]}
                    type="bar"
                    height={Math.max(280, data.locationBreakdown.length * 80)}
                  />
                ) : (
                  <ChartEmpty message="No location data available" />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Service mix: protein + weather */}
        {data.hasServiceStats &&
          (data.proteinMix.length > 0 || data.weatherMix.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Protein mix */}
              <motion.div variants={staggerItem}>
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Beef className="h-4 w-4 text-rose-500" />
                      Protein Mix
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.proteinMix.length > 0 ? (
                      <Chart
                        key={`protein-${filterKey}`}
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
                              barHeight: "62%",
                              distributed: true,
                            },
                          },
                          colors: [
                            "#f43f5e",
                            "#f59e0b",
                            "#10b981",
                            "#3b82f6",
                            "#8b5cf6",
                            "#14b8a6",
                            "#ec4899",
                            "#64748b",
                          ],
                          xaxis: {
                            categories: data.proteinMix.map((p) => p.label),
                            labels: { style: axisStyle },
                            title: {
                              text: "Nights served",
                              style: { fontFamily: FONT, fontSize: "11px", fontWeight: 400 },
                            },
                          },
                          yaxis: { labels: { style: catStyle } },
                          dataLabels: {
                            enabled: true,
                            formatter: (val: number) => String(val),
                            style: { fontFamily: FONT, fontSize: "11px", fontWeight: 600 },
                          },
                          grid: {
                            borderColor: gridColor,
                            strokeDashArray: 4,
                            yaxis: { lines: { show: false } },
                          },
                          legend: { show: false },
                          tooltip: {
                            y: { formatter: (val: number) => `${val} night${val === 1 ? "" : "s"}` },
                          },
                          theme: { mode: chartThemeMode },
                        }}
                        series={[
                          { name: "Nights", data: data.proteinMix.map((p) => p.nights) },
                        ]}
                        type="bar"
                        height={Math.max(220, data.proteinMix.length * 44)}
                      />
                    ) : (
                      <ChartEmpty message="No protein data yet" />
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Weather mix */}
              <motion.div variants={staggerItem}>
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <CloudSun className="h-4 w-4 text-sky-500" />
                      Weather Mix
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.weatherMix.length > 0 ? (
                      <Chart
                        key={`weather-${filterKey}`}
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
                              barHeight: "62%",
                            },
                          },
                          colors: ["#0ea5e9"],
                          xaxis: {
                            categories: data.weatherMix.map((w) => w.label),
                            labels: { style: axisStyle },
                            title: {
                              text: "Nights",
                              style: { fontFamily: FONT, fontSize: "11px", fontWeight: 400 },
                            },
                          },
                          yaxis: { labels: { style: catStyle } },
                          dataLabels: {
                            enabled: true,
                            formatter: (val: number) => String(val),
                            style: { fontFamily: FONT, fontSize: "11px", fontWeight: 600 },
                          },
                          grid: {
                            borderColor: gridColor,
                            strokeDashArray: 4,
                            yaxis: { lines: { show: false } },
                          },
                          legend: { show: false },
                          tooltip: {
                            y: { formatter: (val: number) => `${val} night${val === 1 ? "" : "s"}` },
                          },
                          theme: { mode: chartThemeMode },
                        }}
                        series={[
                          { name: "Nights", data: data.weatherMix.map((w) => w.nights) },
                        ]}
                        type="bar"
                        height={Math.max(220, data.weatherMix.length * 44)}
                      />
                    ) : (
                      <ChartEmpty message="No weather data yet" />
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          )}

        {/* Year-over-Year summary */}
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    {
                      label: "Guests Served",
                      current: data.summary.totalMeals,
                      previous: data.summary.prevYearTotalMeals,
                      format: (v: number) => num(v),
                    },
                    {
                      label: "Avg per Day",
                      current: data.summary.avgPerDay,
                      previous: data.summary.prevYearAvgPerDay,
                      format: (v: number) => String(v),
                    },
                    {
                      label: "Total Koha",
                      current: s.totalKoha,
                      previous: s.prevTotalKoha,
                      format: (v: number) => nzd(v),
                    },
                  ].map((metric) => {
                    const diff = metric.current - metric.previous;
                    const pctChange =
                      metric.previous > 0
                        ? Math.round((diff / metric.previous) * 100)
                        : 0;
                    return (
                      <div key={metric.label} className="text-center space-y-1 py-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {metric.label}
                        </p>
                        <p className="text-xl font-bold tabular-nums">
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
                          <p className="text-xs text-muted-foreground">&nbsp;</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Per-night detail table */}
        <motion.div variants={staggerItem}>
          <ServiceNightsTable
            months={initialMonths}
            location={initialLocation}
            days={initialDays}
            from={initialFrom}
            to={initialTo}
          />
        </motion.div>

        {/* Detailed reports (legacy dashboard) */}
        <motion.div variants={staggerItem}>
          <RestaurantReports data={reports} />
        </motion.div>

        {/* Empty state */}
        {data.locationBreakdown.length === 0 &&
          !data.currentYearTrend.some((v) => v > 0) &&
          !data.hasServiceStats && (
            <motion.div variants={staggerItem}>
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <UtensilsCrossed className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No data available</p>
                  <p className="text-sm mt-1">
                    No restaurant data found for the {rangeLabel}
                    {initialLocation !== "all" && ` at ${initialLocation}`}.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
      </motion.div>
    </div>
  );
}
