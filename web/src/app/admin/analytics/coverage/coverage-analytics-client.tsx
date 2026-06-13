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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/motion";
import {
  CalendarRange,
  Users,
  UserMinus,
  CircleSlash,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  BarChart3,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import dynamic from "next/dynamic";
import { DayOfWeekFilter } from "@/components/day-of-week-filter";
import type { ShiftCoverageData, ShiftCoverageRow } from "@/lib/shift-coverage";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Props {
  data: ShiftCoverageData;
  months: string;
  location: string;
  days: string;
  locations: Array<{ value: string; label: string }>;
}

const MONTHS_LABELS: Record<string, string> = {
  "1": "1 month",
  "3": "3 months",
  "6": "6 months",
  "12": "12 months",
};

function CoverageRing({
  value,
  color,
  size = 72,
  strokeWidth = 6,
}: {
  value: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(value, 0), 100) / 100;
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

export function CoverageAnalyticsClient({
  data,
  months: initialMonths,
  location: initialLocation,
  days: initialDays,
  locations,
}: Props) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [isPending, startTransition] = useTransition();
  const [months, setMonths] = useState(initialMonths);
  const [location, setLocation] = useState(initialLocation);
  const [days, setDays] = useState(initialDays);
  const chartThemeMode = (resolvedTheme === "dark" ? "dark" : "light") as
    | "dark"
    | "light";

  const handleApplyFilters = () => {
    const params = new URLSearchParams({ months, location });
    if (days) params.set("days", days);
    startTransition(() => {
      router.push(`/admin/analytics/coverage?${params}`);
    });
  };

  const { totals, byLocation } = data;

  // Stacked bar: mutually exclusive staffing bands per restaurant.
  const chartLocations = byLocation.map((r) => r.location);
  const adequateSeries = byLocation.map(
    (r) => r.totalShifts - r.understaffedShifts
  );
  const understaffedSeries = byLocation.map(
    (r) => r.understaffedShifts - r.criticallyUnderstaffedShifts
  );
  const criticalSeries = byLocation.map((r) => r.criticallyUnderstaffedShifts);
  const hasData = totals.totalShifts > 0;

  const statCards: Array<{
    label: string;
    value: number;
    desc: string;
    tooltip: string;
    icon: React.ComponentType<{ className?: string }>;
    bg: string;
    fg: string;
  }> = [
    {
      label: "Unfilled Shifts",
      value: totals.unfilledShifts,
      desc: "Have empty positions",
      tooltip:
        "Shifts where at least one position went unfilled (filled < capacity).",
      icon: UserMinus,
      bg: "bg-amber-50 dark:bg-amber-950/20",
      fg: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Fully Empty",
      value: totals.fullyEmptyShifts,
      desc: "Nobody signed up",
      tooltip: "Shifts that ran with zero volunteers signed up.",
      icon: CircleSlash,
      bg: "bg-orange-50 dark:bg-orange-950/20",
      fg: "text-orange-600 dark:text-orange-400",
    },
    {
      label: "Understaffed",
      value: totals.understaffedShifts,
      desc: "Under 75% filled",
      tooltip:
        "Shifts filled to less than 75% of capacity (includes critically understaffed).",
      icon: AlertTriangle,
      bg: "bg-amber-50 dark:bg-amber-950/20",
      fg: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Critically Understaffed",
      value: totals.criticallyUnderstaffedShifts,
      desc: "Under 50% filled",
      tooltip: "Shifts filled to less than 50% of capacity — the most at risk.",
      icon: ShieldAlert,
      bg: "bg-red-50 dark:bg-red-950/20",
      fg: "text-red-600 dark:text-red-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <DayOfWeekFilter value={days} onChange={setDays} />
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

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className={`space-y-6 transition-opacity ${isPending ? "opacity-50 pointer-events-none" : ""}`}
      >
        {/* Hero — fill rate + headline counts */}
        <motion.div variants={staggerItem}>
          <Card className="overflow-hidden">
            <div className="flex flex-col md:flex-row">
              <div className="flex items-center gap-5 p-6">
                <div className="relative">
                  <CoverageRing value={totals.fillRate} color="#10b981" />
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">
                    {totals.fillRate}%
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help pl-6">
                      <p className="text-sm text-muted-foreground">Fill Rate</p>
                      <p className="text-3xl font-bold tracking-tight tabular-nums">
                        {totals.filledPositions}
                        <span className="text-lg text-muted-foreground">
                          {" "}
                          / {totals.totalPositions}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Positions filled · last {MONTHS_LABELS[initialMonths]}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-56">
                    Filled positions ÷ positions offered. &ldquo;Filled&rdquo;
                    counts confirmed volunteers, regulars and walk-ins.
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="flex-1 grid grid-cols-2 divide-x border-t md:border-t-0 md:border-l">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center justify-center p-5 cursor-help">
                      <CalendarRange className="h-4 w-4 text-muted-foreground mb-1" />
                      <p className="text-2xl font-bold tracking-tight tabular-nums">
                        {totals.totalShifts}
                      </p>
                      <p className="text-xs text-muted-foreground">Shifts Run</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-56">
                    Shifts scheduled to start within the selected period.
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center justify-center p-5 cursor-help">
                      <Users className="h-4 w-4 text-muted-foreground mb-1" />
                      <p className="text-2xl font-bold tracking-tight tabular-nums">
                        {totals.totalPositions}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Positions Offered
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="w-auto max-w-56">
                    Total capacity across all shifts in the period.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Stat cards */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
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
                    <Card className={`${stat.bg} border-0 cursor-help`}>
                      <CardContent className="flex items-center gap-4 py-5">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-background/70 ${stat.fg}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {stat.label}
                          </p>
                          <p className="text-2xl font-bold tracking-tight tabular-nums">
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
            );
          })}
        </motion.div>

        {/* Staffing by restaurant — chart */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-500" />
                Staffing by Restaurant
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasData ? (
                <Chart
                  key={`coverage-${initialMonths}-${initialLocation}-${initialDays}`}
                  options={{
                    chart: {
                      type: "bar" as const,
                      stacked: true,
                      toolbar: { show: false },
                      background: "transparent",
                      fontFamily: "var(--font-jakarta), sans-serif",
                    },
                    plotOptions: {
                      bar: {
                        horizontal: true,
                        borderRadius: 4,
                        barHeight: "60%",
                      },
                    },
                    xaxis: {
                      categories: chartLocations,
                      labels: { style: { fontSize: "11px" } },
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                    },
                    yaxis: { labels: { style: { fontSize: "12px" } } },
                    colors: ["#10b981", "#f59e0b", "#ef4444"],
                    dataLabels: { enabled: false },
                    grid: {
                      borderColor: "#e5e7eb",
                      strokeDashArray: 4,
                      yaxis: { lines: { show: false } },
                    },
                    legend: {
                      position: "top" as const,
                      fontSize: "12px",
                      markers: { size: 6, offsetX: -2 },
                    },
                    tooltip: {
                      shared: true,
                      intersect: false,
                      y: {
                        formatter: (val: number) =>
                          `${Math.round(val)} shift${val === 1 ? "" : "s"}`,
                      },
                    },
                    theme: { mode: chartThemeMode },
                  }}
                  series={[
                    { name: "Adequate (75%+)", data: adequateSeries },
                    { name: "Understaffed (50–74%)", data: understaffedSeries },
                    { name: "Critical (<50%)", data: criticalSeries },
                  ]}
                  type="bar"
                  height={Math.max(220, chartLocations.length * 56)}
                />
              ) : (
                <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
                  No shifts in the selected period
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Per-restaurant breakdown table */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                Per-Restaurant Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Restaurant</TableHead>
                      <TableHead className="text-right">Shifts</TableHead>
                      <TableHead className="text-right">Positions</TableHead>
                      <TableHead className="text-right">Filled</TableHead>
                      <TableHead className="text-right">Fill Rate</TableHead>
                      <TableHead className="text-right">Unfilled</TableHead>
                      <TableHead className="text-right">Empty</TableHead>
                      <TableHead className="text-right">Understaffed</TableHead>
                      <TableHead className="text-right">Critical</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byLocation.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-center text-muted-foreground py-8"
                        >
                          No shifts in the selected period
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {byLocation.map((row: ShiftCoverageRow) => (
                          <TableRow key={row.location}>
                            <TableCell className="font-medium">
                              {row.location}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.totalShifts}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.totalPositions}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.filledPositions}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.fillRate}%
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.unfilledShifts}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.fullyEmptyShifts}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-amber-600 dark:text-amber-400">
                              {row.understaffedShifts}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
                              {row.criticallyUnderstaffedShifts}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2 font-semibold">
                          <TableCell>All Locations</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {totals.totalShifts}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {totals.totalPositions}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {totals.filledPositions}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {totals.fillRate}%
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {totals.unfilledShifts}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {totals.fullyEmptyShifts}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-amber-600 dark:text-amber-400">
                            {totals.understaffedShifts}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400">
                            {totals.criticallyUnderstaffedShifts}
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
