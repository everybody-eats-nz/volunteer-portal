"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EngagementVolunteerTable } from "./engagement-volunteer-table";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface EngagementData {
  summary: {
    totalVolunteers: number;
    activeCount: number;
    highlyActiveCount: number;
    inactiveCount: number;
    neverVolunteeredCount: number;
    retentionRate: number;
    newInPeriodCount: number;
  };
  monthlyTrend: Array<{
    month: string;
    activeVolunteers: number;
  }>;
  breakdown: Array<{
    label: string;
    value: number;
    color: string;
  }>;
}

interface Props {
  locations: Array<{ value: string; label: string }>;
  initialFilters: {
    months: string;
    location: string;
  };
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
  locations,
  initialFilters,
}: Props) {
  const [months, setMonths] = useState(initialFilters.months);
  const [location, setLocation] = useState(initialFilters.location);
  const [data, setData] = useState<EngagementData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ months, location });
      const response = await fetch(`/api/admin/analytics/engagement?${params}`);
      if (response.ok) {
        const json = await response.json();
        setData(json);
      }
    } catch (error) {
      console.error("Error fetching engagement data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFilters = () => {
    fetchData();
  };

  const volunteersWithShifts = data
    ? data.summary.totalVolunteers - data.summary.neverVolunteeredCount
    : 0;
  const engagementRate = data
    ? Math.round(
        ((data.summary.activeCount + data.summary.highlyActiveCount) /
          Math.max(volunteersWithShifts, 1)) *
          100
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Filters — inline toolbar style */}
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
            <Button onClick={handleApplyFilters} className="sm:w-auto w-full">
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-3 w-20 bg-muted rounded" />
                  <div className="h-7 w-12 bg-muted rounded" />
                  <div className="h-2 w-28 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Content */}
      {!isLoading && data && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-6"
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
                        data.summary.activeCount +
                        data.summary.highlyActiveCount
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
                          Last {MONTHS_LABELS[months]}
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="w-auto max-w-56">
                      (Highly Active + Active) / Volunteers with shifts ={" "}
                      {data.summary.highlyActiveCount +
                        data.summary.activeCount}{" "}
                      / {volunteersWithShifts}
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
                        <p className="text-xs text-muted-foreground">
                          Retention
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="w-auto max-w-56">
                      Of volunteers active in the prior period, the percentage
                      who also volunteered in the current period
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
                icon: Zap,
                color: "text-emerald-600 dark:text-emerald-400",
                bg: "bg-emerald-50 dark:bg-emerald-950/20",
                ring: "#10b981",
              },
              {
                label: "Active",
                value: data.summary.activeCount,
                desc: "1+ shift in period",
                tooltip:
                  "Volunteers with at least 1 completed shift in the selected period (but fewer than 2/month avg)",
                icon: UserCheck,
                color: "text-blue-600 dark:text-blue-400",
                bg: "bg-blue-50 dark:bg-blue-950/20",
                ring: "#3b82f6",
              },
              {
                label: "Inactive",
                value: data.summary.inactiveCount,
                desc: "No shifts in period",
                tooltip:
                  "Volunteers who have completed shifts before but none during the selected period",
                icon: UserMinus,
                color: "text-amber-600 dark:text-amber-400",
                bg: "bg-amber-50 dark:bg-amber-950/20",
                ring: "#f59e0b",
              },
              {
                label: "Never Volunteered",
                value: data.summary.neverVolunteeredCount,
                desc: "0 completed shifts",
                tooltip:
                  "Registered volunteers who have never completed a shift",
                icon: UserX,
                color: "text-red-600 dark:text-red-400",
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
            {/* Donut */}
            <motion.div variants={staggerItem}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">
                    Engagement Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.breakdown.some((b) => b.value > 0) ? (
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
                        theme: { mode: "light" as const },
                      }}
                      series={data.breakdown.map((b) => b.value)}
                      type="donut"
                      height={320}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Area chart — wider */}
            <motion.div variants={staggerItem}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    Monthly Active Volunteers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.monthlyTrend.length > 0 ? (
                    <Chart
                      options={{
                        chart: {
                          type: "area" as const,
                          toolbar: { show: false },
                          background: "transparent",
                          sparkline: { enabled: false },
                        },
                        xaxis: {
                          categories: data.monthlyTrend.map((t) => {
                            const [year, month] = t.month.split("-");
                            const date = new Date(
                              parseInt(year),
                              parseInt(month) - 1
                            );
                            return date.toLocaleDateString("en-NZ", {
                              month: "short",
                              year: "2-digit",
                            });
                          }),
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
                          min: 0,
                        },
                        colors: ["#3b82f6"],
                        stroke: {
                          curve: "smooth" as const,
                          width: 2.5,
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
                          y: {
                            formatter: function (val: number) {
                              return val + " volunteers";
                            },
                          },
                        },
                        markers: {
                          size: 4,
                          strokeWidth: 2,
                          strokeColors: "#fff",
                          hover: { sizeOffset: 2 },
                        },
                        legend: { show: false },
                        theme: { mode: "light" as const },
                      }}
                      series={[
                        {
                          name: "Active Volunteers",
                          data: data.monthlyTrend.map(
                            (t) => t.activeVolunteers
                          ),
                        },
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
                <EngagementVolunteerTable months={months} location={location} />
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
