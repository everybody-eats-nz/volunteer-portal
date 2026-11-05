"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion } from "motion/react";
import {
  AlarmClock,
  BarChart3,
  CircleCheck,
  Hourglass,
  Inbox,
  Info,
  Loader2,
  Timer,
  XCircle,
  Zap,
} from "lucide-react";
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
  plural,
} from "@/app/admin/analytics/_lib/chart-theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { staggerContainer, staggerItem } from "@/lib/motion";
import { volunteerProfileHref } from "@/lib/admin-navigation";
import {
  RESPONSE_TARGET_HOURS,
  formatResponseHours,
  type LocationResponseStats,
  type ResponseStats,
} from "@/lib/application-responses";

export interface OverdueApplication {
  signupId: string;
  volunteerId: string;
  volunteerName: string;
  shiftName: string;
  /** Pre-formatted in NZ time. */
  shiftWhen: string;
  location: string | null;
  rosterHref: string;
  waitingHours: number;
}

interface Props {
  totals: ResponseStats;
  byLocation: LocationResponseStats[];
  overdue: OverdueApplication[];
  /** The backlog hit the page's limit; there are more than shown. */
  overdueTruncated: boolean;
  months: string;
  location: string;
  locations: Array<{ value: string; label: string }>;
}

const PERIOD_LABELS: Record<string, string> = {
  "1": "last month",
  "3": "last 3 months",
  "6": "last 6 months",
  "12": "last 12 months",
};

function rate(value: number | null): string {
  return value === null ? "-" : `${value}%`;
}

function TargetRing({ value, color }: { value: number | null; color: string }) {
  const size = 72;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(value ?? 0, 0), 100) / 100);

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/20"
      />
      {value !== null && (
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
      )}
    </svg>
  );
}

export function ApplicationsAnalyticsClient({
  totals,
  byLocation,
  overdue,
  overdueTruncated,
  months: initialMonths,
  location: initialLocation,
  locations,
}: Props) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [isPending, startTransition] = useTransition();
  const [months, setMonths] = useState(initialMonths);
  const [location, setLocation] = useState(initialLocation);
  const tokens = chartTokens(chartModeFrom(resolvedTheme));
  const base = baseOptions(tokens);

  const applyFilters = () => {
    startTransition(() => {
      router.push(
        `/admin/analytics/applications?${new URLSearchParams({ months, location })}`
      );
    });
  };

  const due = totals.answered + totals.waitingOverdue + totals.missed;
  const hasDecisions = byLocation.some((r) => r.answered + r.autoApproved > 0);
  const periodLabel = PERIOD_LABELS[initialMonths];

  const statCards = [
    {
      label: "Applications",
      value: String(totals.applications),
      desc: periodLabel,
      tooltip:
        "Shift signups from volunteers that needed a decision, by when they came in.",
      icon: Inbox,
      bg: "bg-muted/60",
      fg: "text-muted-foreground",
    },
    {
      label: "Auto-approved",
      value: String(totals.autoApproved),
      desc: "Confirmed by the rules on signup",
      tooltip:
        "Instant, so not counted toward the 48-hour target either way.",
      icon: Zap,
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      fg: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Declined",
      value: String(totals.declined),
      desc: `${rate(totals.declineRate)} of the team's answers`,
      tooltip:
        "Applications the team declined, as a share of all the applications the team answered.",
      icon: XCircle,
      bg: "bg-amber-50 dark:bg-amber-950/20",
      fg: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Never answered",
      value: String(totals.missed),
      desc: "Still pending when the shift started",
      tooltip:
        "The volunteer never heard back before the shift. Counts as late.",
      icon: AlarmClock,
      bg: "bg-red-50 dark:bg-red-950/20",
      fg: "text-red-600 dark:text-red-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="py-4">
        <CardContent className="px-4">
          <div className="flex flex-col items-end gap-4 sm:flex-row">
            <div className="grid w-full flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="months">Applications from</Label>
                <Select value={months} onValueChange={setMonths}>
                  <SelectTrigger id="months" size="md" data-testid="applications-period-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Last month</SelectItem>
                    <SelectItem value="3">Last 3 months</SelectItem>
                    <SelectItem value="6">Last 6 months</SelectItem>
                    <SelectItem value="12">Last 12 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Restaurant</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger id="location" size="md" data-testid="applications-location-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All restaurants</SelectItem>
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
              onClick={applyFilters}
              className="w-full sm:w-auto"
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className={`space-y-6 transition-opacity ${isPending ? "pointer-events-none opacity-50" : ""}`}
      >
        {/* Hero: the 48-hour target */}
        <motion.div variants={staggerItem}>
          <Card className="overflow-hidden" data-testid="applications-target-card">
            <div className="flex flex-col md:flex-row">
              <div className="flex items-center gap-5 p-6">
                <div className="relative">
                  <TargetRing value={totals.onTimeRate} color={tokens.series[0]} />
                  <div
                    className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums"
                    data-testid="applications-on-time-rate"
                  >
                    {rate(totals.onTimeRate)}
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help pl-2">
                      <p className="text-sm text-muted-foreground">
                        Answered within {RESPONSE_TARGET_HOURS} hours
                      </p>
                      <p className="text-3xl font-bold tracking-tight tabular-nums">
                        {totals.answeredOnTime}
                        <span className="text-lg text-muted-foreground"> / {due}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Applications that came due, {periodLabel}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-64">
                    Out of every application the team answered, plus those
                    left waiting more than {RESPONSE_TARGET_HOURS} hours or
                    never answered. Ones still inside the window aren&apos;t
                    late yet, so they aren&apos;t counted.
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="grid flex-1 grid-cols-2 divide-x border-t md:border-l md:border-t-0">
                <div className="flex flex-col items-center justify-center p-5">
                  <Timer className="mb-1 h-4 w-4 text-muted-foreground" aria-hidden />
                  <p
                    className="text-2xl font-bold tracking-tight tabular-nums"
                    data-testid="applications-median-response"
                  >
                    {formatResponseHours(totals.medianResponseHours)}
                  </p>
                  <p className="text-xs text-muted-foreground">Median response</p>
                </div>
                <div className="flex flex-col items-center justify-center p-5">
                  <Hourglass className="mb-1 h-4 w-4 text-muted-foreground" aria-hidden />
                  <p
                    className="text-2xl font-bold tracking-tight tabular-nums"
                    data-testid="applications-overdue-count"
                  >
                    {overdue.length}
                    {overdueTruncated && "+"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Waiting over {RESPONSE_TARGET_HOURS} hours now
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Stat cards */}
        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <motion.div key={stat.label} variants={staggerItem}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className={`${stat.bg} cursor-help border-0 py-5`}>
                      <CardContent className="flex items-center gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-background/70 ${stat.fg}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-muted-foreground">
                            {stat.label}
                          </p>
                          <p className="text-2xl font-bold tracking-tight tabular-nums">
                            {stat.value}
                          </p>
                          <p className="text-xs text-muted-foreground">{stat.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-56">
                    {stat.tooltip}
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Waiting over 48 hours */}
        <motion.div variants={staggerItem}>
          <Card data-testid="applications-overdue-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <ChartIcon icon={Hourglass} accent="text-amber-500" />
                Waiting over {RESPONSE_TARGET_HOURS} hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overdue.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
                  <CircleCheck className="h-4 w-4 text-emerald-600" aria-hidden />
                  Every upcoming application has had an answer within{" "}
                  {RESPONSE_TARGET_HOURS} hours.
                </div>
              ) : (
                <ul className="divide-y" data-testid="applications-overdue-list">
                  {overdue.map((app) => (
                    <li
                      key={app.signupId}
                      className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      data-testid={`overdue-application-${app.signupId}`}
                    >
                      <div className="min-w-0">
                        <Link
                          href={volunteerProfileHref(
                            app.volunteerId,
                            "/admin/analytics/applications"
                          )}
                          className="font-medium hover:underline"
                        >
                          {app.volunteerName}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {app.shiftName}, {app.shiftWhen}
                          {app.location ? ` at ${app.location}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-medium tabular-nums text-amber-700 dark:text-amber-400">
                          Waiting {formatResponseHours(app.waitingHours)}
                        </span>
                        <Button asChild variant="outline" size="sm">
                          <Link href={app.rosterHref}>Open roster</Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Decisions by restaurant */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <ChartIcon icon={BarChart3} accent="text-emerald-500" />
                Decisions by restaurant
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasDecisions ? (
                <ApexChart
                  key={`applications-${initialMonths}-${initialLocation}`}
                  options={{
                    ...base,
                    chart: { ...base.chart, type: "bar" as const, stacked: true },
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
                      categories: byLocation.map((r) => r.location),
                      labels: {
                        style: tokens.axisStyle,
                        formatter: (v: string) => String(Math.round(Number(v))),
                      },
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                    },
                    yaxis: { labels: { style: tokens.catStyle } },
                    colors: [
                      tokens.series[0],
                      tokens.series[1],
                      tokens.series[2],
                      tokens.series[3],
                    ],
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
                      y: { formatter: (val: number) => plural(val, "application") },
                    },
                  }}
                  series={[
                    { name: "Auto-approved", data: byLocation.map((r) => r.autoApproved) },
                    { name: "Approved by the team", data: byLocation.map((r) => r.approved) },
                    { name: "Waitlisted", data: byLocation.map((r) => r.waitlisted) },
                    { name: "Declined", data: byLocation.map((r) => r.declined) },
                  ]}
                  type="bar"
                  height={Math.max(220, byLocation.length * 56)}
                />
              ) : (
                <ChartEmpty
                  height={220}
                  message="No decisions in this period"
                  hint="Try a longer period or another restaurant."
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Per-restaurant table */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <ChartIcon icon={Info} accent="text-muted-foreground" />
                By restaurant
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table data-testid="applications-by-location-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Restaurant</TableHead>
                      <TableHead className="text-right">Applications</TableHead>
                      <TableHead className="text-right">Auto-approved</TableHead>
                      <TableHead className="text-right">Team answered</TableHead>
                      <TableHead className="text-right">Within {RESPONSE_TARGET_HOURS} h</TableHead>
                      <TableHead className="text-right">Median response</TableHead>
                      <TableHead className="text-right">Declined</TableHead>
                      <TableHead className="text-right">Decline rate</TableHead>
                      <TableHead className="text-right">Overdue now</TableHead>
                      <TableHead className="text-right">Never answered</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byLocation.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                          No applications in this period
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {byLocation.map((row) => (
                          <LocationRow key={row.location} label={row.location} stats={row} />
                        ))}
                        {byLocation.length > 1 && (
                          <LocationRow label="All restaurants" stats={totals} total />
                        )}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
              {totals.closedWithoutResponse > 0 && (
                <p className="mt-4 text-xs text-muted-foreground">
                  {plural(totals.closedWithoutResponse, "application")} closed
                  with no response on record: withdrawn by the volunteer,
                  cancelled because another shift at the same time was
                  confirmed, or decided before response times were tracked.
                  They&apos;re left out of the rates.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

function LocationRow({
  label,
  stats,
  total = false,
}: {
  label: string;
  stats: ResponseStats;
  total?: boolean;
}) {
  return (
    <TableRow className={total ? "border-t-2 font-semibold" : undefined}>
      <TableCell className={total ? undefined : "font-medium"}>{label}</TableCell>
      <TableCell className="text-right tabular-nums">{stats.applications}</TableCell>
      <TableCell className="text-right tabular-nums">{stats.autoApproved}</TableCell>
      <TableCell className="text-right tabular-nums">{stats.answered}</TableCell>
      <TableCell className="text-right tabular-nums">{rate(stats.onTimeRate)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatResponseHours(stats.medianResponseHours)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{stats.declined}</TableCell>
      <TableCell className="text-right tabular-nums">{rate(stats.declineRate)}</TableCell>
      <TableCell className="text-right tabular-nums text-amber-700 dark:text-amber-400">
        {stats.waitingOverdue}
      </TableCell>
      <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
        {stats.missed}
      </TableCell>
    </TableRow>
  );
}
