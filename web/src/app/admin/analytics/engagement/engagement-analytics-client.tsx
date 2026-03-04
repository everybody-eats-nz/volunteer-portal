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
import {
  Users,
  TrendingUp,
  Filter,
  Zap,
  UserCheck,
  UserMinus,
  UserX,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import dynamic from "next/dynamic";
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

export function EngagementAnalyticsClient({ locations, initialFilters }: Props) {
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

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={handleApplyFilters} className="w-full">
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading engagement data...
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {!isLoading && data && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="flex items-center py-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/30 p-3">
                    <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Highly Active</p>
                    <p className="text-2xl font-bold">
                      {data.summary.highlyActiveCount}
                    </p>
                    <p className="text-xs text-muted-foreground">2+ shifts/month avg</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center py-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 dark:bg-blue-950/30 p-3">
                    <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold">{data.summary.activeCount}</p>
                    <p className="text-xs text-muted-foreground">1+ shift in period</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center py-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-amber-100 dark:bg-amber-950/30 p-3">
                    <UserMinus className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Inactive</p>
                    <p className="text-2xl font-bold">
                      {data.summary.inactiveCount}
                    </p>
                    <p className="text-xs text-muted-foreground">No shifts in period</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center py-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-100 dark:bg-red-950/30 p-3">
                    <UserX className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Never Volunteered
                    </p>
                    <p className="text-2xl font-bold">
                      {data.summary.neverVolunteeredCount}
                    </p>
                    <p className="text-xs text-muted-foreground">0 completed shifts ever</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="flex items-center py-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-purple-100 dark:bg-purple-950/30 p-3">
                    <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Volunteers
                    </p>
                    <p className="text-2xl font-bold">
                      {data.summary.totalVolunteers}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center py-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-cyan-100 dark:bg-cyan-950/30 p-3">
                    <RefreshCw className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Retention Rate</p>
                    <p className="text-2xl font-bold">
                      {data.summary.retentionRate}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center py-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-100 dark:bg-green-950/30 p-3">
                    <UserPlus className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      New in Period
                    </p>
                    <p className="text-2xl font-bold">
                      {data.summary.newInPeriodCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Engagement Breakdown Donut */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
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
                      },
                      dataLabels: {
                        enabled: true,
                        formatter: function (val: number) {
                          return Math.round(val) + "%";
                        },
                      },
                      plotOptions: {
                        pie: {
                          donut: {
                            size: "60%",
                            labels: {
                              show: true,
                              total: {
                                show: true,
                                label: "Total",
                                fontFamily:
                                  "var(--font-libre-franklin), sans-serif",
                              },
                            },
                          },
                        },
                      },
                      theme: {
                        mode: "light" as const,
                      },
                    }}
                    series={data.breakdown.map((b) => b.value)}
                    type="donut"
                    height={320}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[320px] text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Monthly Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
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
                            fontFamily: "var(--font-libre-franklin), sans-serif",
                          },
                        },
                      },
                      yaxis: {
                        title: {
                          text: "Active Volunteers",
                          style: {
                            fontFamily: "var(--font-libre-franklin), sans-serif",
                            fontSize: "12px",
                          },
                        },
                        labels: {
                          style: {
                            fontFamily: "var(--font-libre-franklin), sans-serif",
                          },
                        },
                        min: 0,
                      },
                      colors: ["#3b82f6"],
                      stroke: {
                        curve: "smooth" as const,
                        width: 3,
                      },
                      fill: {
                        type: "gradient",
                        gradient: {
                          shadeIntensity: 1,
                          opacityFrom: 0.4,
                          opacityTo: 0.05,
                        },
                      },
                      dataLabels: { enabled: false },
                      grid: {
                        borderColor: "#e5e7eb",
                      },
                      tooltip: {
                        y: {
                          formatter: function (val: number) {
                            return val + " volunteers";
                          },
                        },
                      },
                      legend: {
                        fontFamily: "var(--font-libre-franklin), sans-serif",
                      },
                      theme: {
                        mode: "light" as const,
                      },
                    }}
                    series={[
                      {
                        name: "Active Volunteers",
                        data: data.monthlyTrend.map((t) => t.activeVolunteers),
                      },
                    ]}
                    type="area"
                    height={320}
                  />
                ) : (
                  <div className="flex items-center justify-center h-[320px] text-muted-foreground">
                    No trend data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Volunteer Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Volunteers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EngagementVolunteerTable months={months} location={location} />
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
