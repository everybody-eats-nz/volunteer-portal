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
import Link from "next/link";
import type { MilestoneData } from "@/lib/milestone-analytics";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

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

// Milestone colour palette — one per threshold
const MILESTONE_COLORS: Record<number, string> = {
  10: "#6366f1",
  25: "#8b5cf6",
  50: "#ec4899",
  100: "#f59e0b",
  200: "#10b981",
  500: "#3b82f6",
};

function MilestoneCard({
  threshold,
  hitInPeriod,
  allTimeTotal,
  periodLabel,
}: {
  threshold: number;
  hitInPeriod: number;
  allTimeTotal: number;
  periodLabel: string;
}) {
  const color = MILESTONE_COLORS[threshold] ?? "#6b7280";
  return (
    <Card className="border-0 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div
            className="rounded-lg p-2"
            style={{ backgroundColor: color + "20" }}
          >
            <Trophy className="h-4 w-4" style={{ color }} />
          </div>
          <span
            className="text-xs font-semibold rounded-full px-2 py-0.5"
            style={{ backgroundColor: color + "20", color }}
          >
            {threshold} shifts
          </span>
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
  const chartThemeMode = (resolvedTheme === "dark" ? "dark" : "light") as
    | "dark"
    | "light";

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

  // Distribution chart data (sorted by minShifts)
  const distCategories = data.distribution.map((b) => b.label);
  const distCounts = data.distribution.map((b) => b.count);

  // Milestone hits chart
  const hitsCategories = data.milestoneHits.map((m) => `${m.threshold}`);
  const hitsInPeriod = data.milestoneHits.map((m) => m.hitInPeriod);
  const hitsAllTime = data.milestoneHits.map((m) => m.allTimeTotal);

  // Projection chart
  const projCategories = data.projections.map((p) => `${p.threshold} shifts`);
  const projAlready = data.projections.map((p) => p.alreadyHit);
  const projAdditional = data.projections.map((p) => p.projectedAdditional);

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
                    <SelectItem value="24">Last 24 months</SelectItem>
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
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Milestones Hit
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
                          The darker bars show all-time totals (everyone who has
                          ever reached that milestone). The bright bars show how
                          many crossed it during the selected period.
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hitsAllTime.some((v) => v > 0) ? (
                  <Chart
                    options={{
                      chart: {
                        type: "bar" as const,
                        toolbar: { show: false },
                        background: "transparent",
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
                          style: {
                            fontFamily:
                              "var(--font-libre-franklin), sans-serif",
                            fontSize: "11px",
                          },
                        },
                      },
                      colors: ["#f59e0b", "#f59e0b33"],
                      dataLabels: {
                        enabled: true,
                        formatter: (val: number) =>
                          val > 0 ? String(val) : "",
                        style: {
                          fontSize: "11px",
                          fontFamily: "var(--font-libre-franklin), sans-serif",
                          fontWeight: 600,
                        },
                      },
                      grid: {
                        borderColor: "#e5e7eb",
                        strokeDashArray: 4,
                        xaxis: { lines: { show: false } },
                      },
                      tooltip: {
                        shared: true,
                        intersect: false,
                        y: {
                          formatter: (val: number) =>
                            `${val} volunteer${val !== 1 ? "s" : ""}`,
                        },
                      },
                      legend: {
                        position: "top" as const,
                        fontSize: "12px",
                        fontFamily: "var(--font-libre-franklin), sans-serif",
                        markers: { size: 6, offsetX: -2 },
                      },
                      theme: { mode: chartThemeMode },
                    }}
                    series={[
                      {
                        name: `Hit in last ${periodLabel}`,
                        data: hitsInPeriod,
                      },
                      { name: "All-time total", data: hitsAllTime },
                    ]}
                    type="bar"
                    height={300}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                    No milestone data available
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Volunteer Distribution */}
          <motion.div variants={staggerItem}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  Volunteer Distribution
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition-colors">
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="w-auto max-w-56">
                      How many volunteers currently sit in each shift-count band
                      (all-time completed shifts)
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {distCounts.some((v) => v > 0) ? (
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
                        categories: distCategories,
                        title: {
                          text: "Volunteers",
                          style: {
                            fontFamily:
                              "var(--font-libre-franklin), sans-serif",
                            fontSize: "11px",
                            fontWeight: 400,
                          },
                        },
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
                          style: {
                            fontFamily:
                              "var(--font-libre-franklin), sans-serif",
                            fontSize: "12px",
                          },
                        },
                      },
                      colors: ["#3b82f6"],
                      dataLabels: {
                        enabled: true,
                        formatter: (val: number) =>
                          val > 0 ? String(val) : "",
                        style: {
                          fontSize: "11px",
                          fontFamily: "var(--font-libre-franklin), sans-serif",
                          fontWeight: 600,
                        },
                      },
                      grid: {
                        borderColor: "#e5e7eb",
                        strokeDashArray: 4,
                        yaxis: { lines: { show: false } },
                      },
                      tooltip: {
                        y: {
                          formatter: (val: number) =>
                            `${val} volunteer${val !== 1 ? "s" : ""}`,
                        },
                      },
                      legend: { show: false },
                      theme: { mode: chartThemeMode },
                    }}
                    series={[{ name: "Volunteers", data: distCounts }]}
                    type="bar"
                    height={300}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                    No distribution data available
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* 12-Month Projections */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                12-Month Milestone Projections
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
                        Volunteers with no shifts in the past 6 months are not
                        projected — they&rsquo;re considered inactive. Use the
                        approaching volunteers list below to view everyone close
                        to a milestone regardless of recent activity.
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
              {projAlready.some((v) => v > 0) ||
              projAdditional.some((v) => v > 0) ? (
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
                        horizontal: false,
                        borderRadius: 4,
                        borderRadiusApplication: "end" as const,
                        columnWidth: "50%",
                      },
                    },
                    xaxis: {
                      categories: projCategories,
                      labels: {
                        style: {
                          fontFamily: "var(--font-libre-franklin), sans-serif",
                          fontSize: "11px",
                        },
                      },
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                    },
                    yaxis: {
                      title: {
                        text: "Volunteers",
                        style: {
                          fontFamily: "var(--font-libre-franklin), sans-serif",
                          fontSize: "11px",
                          fontWeight: 400,
                        },
                      },
                      labels: {
                        style: {
                          fontFamily: "var(--font-libre-franklin), sans-serif",
                          fontSize: "11px",
                        },
                      },
                    },
                    colors: ["#10b981", "#6366f1"],
                    dataLabels: {
                      enabled: true,
                      formatter: (val: number) => (val > 0 ? String(val) : ""),
                      style: {
                        fontSize: "11px",
                        fontFamily: "var(--font-libre-franklin), sans-serif",
                        fontWeight: 600,
                      },
                    },
                    grid: {
                      borderColor: "#e5e7eb",
                      strokeDashArray: 4,
                      xaxis: { lines: { show: false } },
                    },
                    tooltip: {
                      shared: true,
                      intersect: false,
                      y: {
                        formatter: (val: number) =>
                          `${val} volunteer${val !== 1 ? "s" : ""}`,
                      },
                    },
                    legend: {
                      position: "top" as const,
                      fontSize: "12px",
                      fontFamily: "var(--font-libre-franklin), sans-serif",
                      markers: { size: 6, offsetX: -2 },
                    },
                    theme: { mode: chartThemeMode },
                  }}
                  series={[
                    { name: "Already achieved", data: projAlready },
                    {
                      name: "Projected in next 12 months",
                      data: projAdditional,
                    },
                  ]}
                  type="bar"
                  height={300}
                />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  No projection data available
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Approaching Volunteers */}
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  Approaching Volunteers
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition-colors">
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
                    <SelectTrigger id="milestone-select" className="w-36">
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
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pb-1">
                    <span className="flex-1">Volunteer</span>
                    <span className="w-24 text-right">Shifts</span>
                    <span className="w-24 text-right">Still needed</span>
                    <span className="w-28 text-right">Rate / month</span>
                    <span className="w-28 text-right">Est. arrival</span>
                    <span className="w-8" />
                  </div>
                  {selectedProjection.approaching.map((v) => {
                    const color =
                      MILESTONE_COLORS[selectedMilestone] ?? "#6b7280";
                    const pctDone = (v.totalShifts / selectedMilestone) * 100;
                    return (
                      <div
                        key={v.userId}
                        className="flex items-center gap-4 py-2 border-b last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {v.name}
                          </p>
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
                        <span className="w-24 text-right text-sm tabular-nums font-medium">
                          {v.totalShifts}
                        </span>
                        <span className="w-24 text-right text-sm tabular-nums text-muted-foreground">
                          {v.shiftsNeeded}
                        </span>
                        <span className="w-28 text-right text-sm tabular-nums text-muted-foreground">
                          {v.monthlyRate > 0 ? `${v.monthlyRate}/mo` : "—"}
                        </span>
                        <span className="w-28 text-right text-sm">
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
      </motion.div>
    </div>
  );
}
