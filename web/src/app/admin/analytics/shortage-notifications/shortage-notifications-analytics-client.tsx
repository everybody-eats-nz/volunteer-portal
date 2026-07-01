"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bell,
  Send,
  Users,
  UserCheck,
  MailCheck,
  Gauge,
  MapPin,
  Percent,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartCard, ChartEmpty, ApexChart } from "../_components/primitives";
import {
  baseOptions,
  chartTokens,
  compactCount,
  num,
  PALETTE,
} from "../_lib/chart-theme";
import { ShortageConversionsDialog } from "./shortage-conversions-dialog";
import type {
  ShortageNotificationAnalytics,
  ShortageSiteRow,
} from "@/lib/shortage-analytics";

interface Props {
  data: ShortageNotificationAnalytics;
  months: string;
  location: string;
  locations: Array<{ value: string; label: string }>;
}

const MONTHS_LABELS: Record<string, string> = {
  "3": "3 months",
  "6": "6 months",
  "12": "12 months",
  all: "all time",
};

/** Small area sparkline, matching the Restaurant Analytics KPI cards. */
function Sparkline({
  data,
  color,
  mode,
}: {
  data: number[];
  color: string;
  mode: "light" | "dark";
}) {
  if (!data.some((v) => v > 0)) return <div className="h-10" />;
  return (
    <ApexChart
      type="area"
      height={40}
      options={{
        chart: {
          sparkline: { enabled: true },
          animations: { enabled: false },
          background: "transparent",
        },
        colors: [color],
        stroke: { curve: "smooth", width: 2 },
        fill: {
          type: "gradient",
          gradient: { opacityFrom: 0.4, opacityTo: 0.02, stops: [0, 100] },
        },
        tooltip: { enabled: false },
        theme: { mode },
      }}
      series={[{ data }]}
    />
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
  tint,
  spark,
  sparkColor,
  mode,
  footer,
  tooltip,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
  tint: string;
  spark: number[];
  sparkColor: string;
  mode: "light" | "dark";
  footer?: React.ReactNode;
  tooltip: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.08] blur-2xl",
          tint
        )}
      />
      <div className="flex items-center gap-2 text-muted-foreground">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60",
            accent
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold leading-none tracking-tight tabular-nums">
        {value}
      </p>
      <div className="mt-2 min-h-5 text-xs text-muted-foreground">{footer}</div>
      <div className="-mx-1 mt-2">
        <Sparkline data={spark} color={sparkColor} mode={mode} />
      </div>
    </>
  );

  const base =
    "relative flex h-full flex-col overflow-hidden rounded-xl border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={tooltip}
        className={cn(
          base,
          "cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        )}
      >
        {body}
      </button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(base, "cursor-help")}>{body}</div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-60">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  accent,
  sub,
  tooltip,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
  sub?: string;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-full cursor-help items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60",
              accent
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="text-lg font-bold leading-tight tabular-nums">
              {value}
              {sub && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {sub}
                </span>
              )}
            </p>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-60">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function ShortageNotificationsAnalyticsClient({
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

  // Drill-down modal: which site's signups to show ("all" or a restaurant).
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLocation, setModalLocation] = useState("all");

  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const tokens = chartTokens(mode);

  const handleApplyFilters = () => {
    const params = new URLSearchParams({ months, location });
    startTransition(() => {
      router.push(`/admin/analytics/shortage-notifications?${params}`);
    });
  };

  const openConversions = (loc: string) => {
    setModalLocation(loc);
    setModalOpen(true);
  };

  const { totals, bySite, trend } = data;
  const hasData = totals.emails > 0;
  const avgPerSend =
    totals.sendEvents > 0 ? Math.round(totals.emails / totals.sendEvents) : 0;
  const periodLabel = MONTHS_LABELS[initialMonths] ?? "the period";
  const filterKey = `${initialMonths}-${initialLocation}`;

  const convTrend = trend.map((t) =>
    t.deliveredEmails > 0 ? Math.round((t.signups / t.deliveredEmails) * 100) : 0
  );

  const modalTitle =
    modalLocation === "all"
      ? "Signups from alerts"
      : `${modalLocation} — signups from alerts`;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="months">Time Period</Label>
              <Select value={months} onValueChange={setMonths}>
                <SelectTrigger id="months">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Last 3 months</SelectItem>
                  <SelectItem value="6">Last 6 months</SelectItem>
                  <SelectItem value="12">Last 12 months</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
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
            className="w-full sm:w-auto"
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply Filters
          </Button>
        </div>
      </div>

      <div
        className={`space-y-4 transition-opacity ${isPending ? "pointer-events-none opacity-50" : ""}`}
      >
        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={Bell}
            label="Notifications Sent"
            value={num(totals.sendEvents)}
            accent="text-sky-600 dark:text-sky-400"
            tint="bg-sky-500"
            spark={trend.map((t) => t.sendEvents)}
            sparkColor="#0ea5e9"
            mode={mode}
            footer={`Send events · last ${periodLabel}`}
            tooltip="Each time an admin sends a shortage alert counts as one send event, no matter how many volunteers it reaches."
          />
          <KpiCard
            icon={Send}
            label="Alerts Delivered"
            value={num(totals.successfulEmails)}
            accent="text-blue-600 dark:text-blue-400"
            tint="bg-blue-500"
            spark={trend.map((t) => t.deliveredEmails)}
            sparkColor="#3b82f6"
            mode={mode}
            footer={`of ${num(totals.emails)} emails sent`}
            tooltip="Notification emails successfully delivered to volunteers across all send events."
          />
          <KpiCard
            icon={UserCheck}
            label="Signups from Alerts"
            value={num(totals.converted)}
            accent="text-emerald-600 dark:text-emerald-400"
            tint="bg-emerald-500"
            spark={trend.map((t) => t.signups)}
            sparkColor="#10b981"
            mode={mode}
            footer={
              <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                View volunteers
                <span aria-hidden>→</span>
              </span>
            }
            tooltip="Volunteers who signed up for a shift after a delivered alert. Click to see who."
            onClick={() => openConversions(initialLocation)}
          />
          <KpiCard
            icon={Percent}
            label="Conversion Rate"
            value={`${totals.conversionRate}%`}
            accent="text-violet-600 dark:text-violet-400"
            tint="bg-violet-500"
            spark={convTrend}
            sparkColor="#8b5cf6"
            mode={mode}
            footer={`${num(totals.converted)} of ${num(totals.successfulEmails)} delivered`}
            tooltip="Share of delivered alerts that led to a signup (signups ÷ delivered alerts)."
          />
        </div>

        {/* Secondary stat chips */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatChip
            icon={MailCheck}
            label="Delivery Rate"
            value={`${totals.successRate}%`}
            accent="text-emerald-600 dark:text-emerald-400"
            sub={`${num(totals.successfulEmails)}/${num(totals.emails)}`}
            tooltip="Share of notification emails accepted for delivery (the rest bounced or errored)."
          />
          <StatChip
            icon={Users}
            label="Volunteers Reached"
            value={num(totals.volunteersReached)}
            accent="text-sky-600 dark:text-sky-400"
            sub="reached"
            tooltip="Distinct volunteers who received at least one shortage alert in this period."
          />
          <StatChip
            icon={Gauge}
            label="Avg per Send"
            value={num(avgPerSend)}
            accent="text-amber-600 dark:text-amber-400"
            sub="per alert"
            tooltip="Average number of volunteers emailed each time a shortage alert goes out."
          />
          <StatChip
            icon={MapPin}
            label="Sites Notified"
            value={num(bySite.length)}
            accent="text-violet-600 dark:text-violet-400"
            sub={bySite.length === 1 ? "restaurant" : "restaurants"}
            tooltip="Distinct restaurants that had at least one shortage alert in this period."
          />
        </div>

        {/* Trend over time */}
        <ChartCard
          title="Notifications Over Time"
          icon={TrendingUp}
          accent="text-sky-600 dark:text-sky-400"
          info={{
            title: "Notifications Over Time",
            description: "Alerts delivered vs signups they drove, by month",
            body: (
              <>
                <p>
                  Columns show notification emails delivered each month; the line
                  shows how many of those alerts led to a signup.
                </p>
                <p>
                  The gap between the two is the share of alerts that
                  didn&rsquo;t convert.
                </p>
              </>
            ),
          }}
        >
          {hasData ? (
            <ApexChart
              key={`shortage-trend-${filterKey}`}
              type="line"
              height={300}
              options={{
                ...baseOptions(tokens),
                chart: {
                  ...baseOptions(tokens).chart,
                  type: "line",
                  stacked: false,
                },
                stroke: { width: [0, 3], curve: "smooth" },
                plotOptions: {
                  bar: {
                    columnWidth: "45%",
                    borderRadius: 4,
                    borderRadiusApplication: "end",
                  },
                },
                xaxis: {
                  categories: trend.map((t) => t.label),
                  labels: { style: tokens.axisStyle },
                  axisBorder: { show: false },
                  axisTicks: { show: false },
                },
                yaxis: {
                  min: 0,
                  forceNiceScale: true,
                  labels: { formatter: compactCount, style: tokens.axisStyle },
                },
                colors: [PALETTE.eftpos, PALETTE.guests],
                fill: { opacity: [0.85, 1] },
                markers: {
                  size: [0, 5],
                  strokeWidth: 2,
                  strokeColors: tokens.mode === "dark" ? "#0f1114" : "#fff",
                },
                tooltip: { shared: true, intersect: false },
              }}
              series={[
                {
                  name: "Alerts delivered",
                  type: "column",
                  data: trend.map((t) => t.deliveredEmails),
                },
                {
                  name: "Signups from alerts",
                  type: "line",
                  data: trend.map((t) => t.signups),
                },
              ]}
            />
          ) : (
            <ChartEmpty message="No shortage notifications sent in the selected period" />
          )}
        </ChartCard>

        {/* Per-restaurant breakdown */}
        <ChartCard
          title="Per-Restaurant Breakdown"
          icon={MapPin}
          accent="text-violet-600 dark:text-violet-400"
          bodyClassName="px-2"
          info={{
            title: "Per-Restaurant Breakdown",
            description: "Alerts and signups by restaurant",
            body: (
              <>
                <p>
                  Click a row to see the volunteers who signed up after an alert
                  at that restaurant.
                </p>
                <p>
                  A single alert covering shifts at more than one restaurant
                  counts toward each of them, so rows can add up to more than the
                  org total.
                </p>
              </>
            ),
          }}
        >
          <div className="overflow-x-auto px-2 pb-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead className="text-right">Send Events</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Volunteers</TableHead>
                  <TableHead className="text-right">Signups</TableHead>
                  <TableHead className="text-right">Conversion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bySite.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No shortage notifications sent in the selected period
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {bySite.map((row: ShortageSiteRow) => (
                      <TableRow
                        key={row.location}
                        role="button"
                        tabIndex={0}
                        onClick={() => openConversions(row.location)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openConversions(row.location);
                          }
                        }}
                        className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                        title={`View volunteers who signed up after an alert at ${row.location}`}
                      >
                        <TableCell className="font-medium">
                          {row.location}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.sendEvents}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          {row.successfulEmails}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
                          {row.failedEmails}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.volunteersReached}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400 underline decoration-dotted underline-offset-2">
                          {row.converted}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {row.conversionRate}%
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow
                      role="button"
                      tabIndex={0}
                      onClick={() => openConversions(initialLocation)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openConversions(initialLocation);
                        }
                      }}
                      className="cursor-pointer border-t-2 font-semibold transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                      title="View all volunteers who signed up after an alert"
                    >
                      <TableCell>All Locations</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totals.sendEvents}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                        {totals.successfulEmails}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
                        {totals.failedEmails}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totals.volunteersReached}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400 underline decoration-dotted underline-offset-2">
                        {totals.converted}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {totals.conversionRate}%
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </ChartCard>
      </div>

      <ShortageConversionsDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        months={initialMonths}
        location={modalLocation}
        title={modalTitle}
        subtitle="Volunteers who signed up for a shift after getting a shortage alert"
      />
    </div>
  );
}
