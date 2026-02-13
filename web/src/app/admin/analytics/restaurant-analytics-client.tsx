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
  UtensilsCrossed,
  TrendingUp,
  Calendar,
  Target,
  TrendingDown,
} from "lucide-react";
import dynamic from "next/dynamic";

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface MealsServedData {
  totalsByLocation: Record<
    string,
    {
      total: number;
      records: number;
      daysWithShifts: number;
      average: number;
      expected: number;
      defaultMealsPerDay: number;
      variance: number;
      percentOfTarget: number;
    }
  >;
  grandTotal: number;
  grandExpected: number;
  grandVariance: number;
  grandPercentOfTarget: number;
  daysInRange: number;
  chartData: Array<Record<string, string | number>>;
  monthlyTrends: Record<string, Record<string, { total: number; count: number }>>;
  recordCount: number;
}

interface Props {
  locations: Array<{ value: string; label: string }>;
  initialFilters: {
    location: string;
    startDate: string;
    endDate: string;
  };
}

// Date range presets
const DATE_PRESETS = [
  { value: "last7days", label: "Last 7 Days" },
  { value: "last30days", label: "Last 30 Days" },
  { value: "last90days", label: "Last 90 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "thisYear", label: "This Year" },
  { value: "lastYear", label: "Last Year" },
  { value: "custom", label: "Custom Range" },
];

function getDateRangeFromPreset(preset: string): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = new Date(today);
  let end = new Date(today);

  switch (preset) {
    case "last7days":
      start.setDate(today.getDate() - 7);
      break;
    case "last30days":
      start.setDate(today.getDate() - 30);
      break;
    case "last90days":
      start.setDate(today.getDate() - 90);
      break;
    case "thisMonth":
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case "lastMonth":
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case "thisYear":
      start = new Date(today.getFullYear(), 0, 1);
      break;
    case "lastYear":
      start = new Date(today.getFullYear() - 1, 0, 1);
      end = new Date(today.getFullYear() - 1, 11, 31);
      break;
  }

  return {
    start: start.toISOString().substring(0, 10),
    end: end.toISOString().substring(0, 10),
  };
}

export function RestaurantAnalyticsClient({ locations, initialFilters }: Props) {
  const [datePreset, setDatePreset] = useState("last30days");
  const [location, setLocation] = useState(initialFilters.location);
  const [startDate, setStartDate] = useState(
    initialFilters.startDate.substring(0, 10)
  );
  const [endDate, setEndDate] = useState(initialFilters.endDate.substring(0, 10));
  const [mealsData, setMealsData] = useState<MealsServedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMealsData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        location,
      });

      const response = await fetch(`/api/admin/analytics/meals-served?${params}`);
      if (response.ok) {
        const data = await response.json();
        setMealsData(data);
      }
    } catch (error) {
      console.error("Error fetching meals data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMealsData();
  }, []);

  const handleApplyFilters = () => {
    fetchMealsData();
  };

  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      const { start, end } = getDateRangeFromPreset(preset);
      setStartDate(start);
      setEndDate(end);
    }
  };

  const handleManualDateChange = () => {
    setDatePreset("custom");
  };

  // Calculate percentage of total for each location
  const getPercentage = (locationTotal: number) => {
    if (!mealsData?.grandTotal) return 0;
    return ((locationTotal / mealsData.grandTotal) * 100).toFixed(1);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="datePreset">Date Range</Label>
              <Select value={datePreset} onValueChange={handlePresetChange}>
                <SelectTrigger id="datePreset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  handleManualDateChange();
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  handleManualDateChange();
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
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
            Loading data...
          </CardContent>
        </Card>
      )}

      {/* Meals Served Report */}
      {!isLoading && mealsData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" />
                Total Guests Served
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {new Date(startDate).toLocaleDateString()} -{" "}
                {new Date(endDate).toLocaleDateString()} • {mealsData.recordCount}{" "}
                records
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Grand Totals - Actual vs Expected */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg bg-primary/5 p-6 text-center">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Total Meals Served
                  </div>
                  <div className="text-4xl font-bold text-primary">
                    {mealsData.grandTotal.toLocaleString()}
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-6 text-center">
                  <div className="text-sm font-medium text-muted-foreground mb-1 flex items-center justify-center gap-1">
                    <Target className="h-4 w-4" />
                    Expected Total
                  </div>
                  <div className="text-4xl font-bold">
                    {mealsData.grandExpected.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Based on {mealsData.daysInRange} days
                  </div>
                </div>

                <div
                  className={`rounded-lg p-6 text-center ${
                    mealsData.grandVariance >= 0
                      ? "bg-green-50 dark:bg-green-950/20"
                      : "bg-red-50 dark:bg-red-950/20"
                  }`}
                >
                  <div className="text-sm font-medium text-muted-foreground mb-1 flex items-center justify-center gap-1">
                    {mealsData.grandVariance >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    Variance
                  </div>
                  <div
                    className={`text-4xl font-bold ${
                      mealsData.grandVariance >= 0
                        ? "text-green-700 dark:text-green-400"
                        : "text-red-700 dark:text-red-400"
                    }`}
                  >
                    {mealsData.grandVariance >= 0 ? "+" : ""}
                    {mealsData.grandVariance.toLocaleString()}
                  </div>
                  <div className="text-sm font-medium mt-1">
                    {mealsData.grandPercentOfTarget}% of target
                  </div>
                </div>
              </div>

              {/* Daily Trend Chart */}
              {mealsData.chartData.length > 0 && (() => {
                const locations = Object.keys(mealsData.totalsByLocation);
                const colors = ["#3b82f6", "#10b981", "#ef4444", "#6366f1", "#f59e0b"];

                // Prepare bar series data for ApexCharts
                const barSeries = locations.map((loc, index) => ({
                  name: loc,
                  type: "column",
                  data: mealsData.chartData.map((item) => item[loc] as number || 0),
                  color: colors[index % colors.length],
                }));

                // Calculate total trend line
                const trendData = mealsData.chartData.map((item) => {
                  return locations.reduce((sum, loc) => {
                    return sum + (item[loc] as number || 0);
                  }, 0);
                });

                const trendSeries = {
                  name: "Total Trend",
                  type: "line",
                  data: trendData,
                };

                const series = [...barSeries, trendSeries];

                // Prepare categories (x-axis labels) with weekdays
                const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                const categories = mealsData.chartData.map((item) => {
                  const date = new Date(item.date as string);
                  const weekday = weekdays[date.getDay()];
                  return `${weekday} ${date.getMonth() + 1}/${date.getDate()}`;
                });

                const chartOptions: any = {
                  chart: {
                    type: "line",
                    height: 400,
                    toolbar: {
                      show: false,
                    },
                    background: "transparent",
                  },
                  plotOptions: {
                    bar: {
                      horizontal: false,
                      columnWidth: "75%",
                      borderRadius: 4,
                    },
                  },
                  dataLabels: {
                    enabled: false,
                  },
                  stroke: {
                    width: [...Array(locations.length).fill(0), 3],
                    curve: "smooth",
                  },
                  colors: [...colors.slice(0, locations.length), "#000000"],
                  xaxis: {
                    categories: categories,
                    title: {
                      text: "Date",
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
                  },
                  yaxis: {
                    title: {
                      text: "Meals Served",
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
                  },
                  fill: {
                    opacity: 1,
                  },
                  tooltip: {
                    y: {
                      formatter: function (val: number) {
                        return val.toLocaleString() + " meals";
                      },
                    },
                  },
                  legend: {
                    position: "top",
                    horizontalAlign: "left",
                    fontFamily: "var(--font-libre-franklin), sans-serif",
                  },
                  theme: {
                    mode: "light",
                  },
                  grid: {
                    borderColor: "#e5e7eb",
                  },
                  markers: {
                    size: 4,
                  },
                };

                return (
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Daily Trend
                    </h3>
                    <div className="w-full">
                      <Chart
                        options={chartOptions}
                        series={series}
                        type="line"
                        height={400}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* By Location */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  By Location
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(mealsData.totalsByLocation)
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([loc, data]) => (
                      <Card key={loc}>
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div className="font-semibold text-lg">{loc}</div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">
                                  Actual Total
                                </span>
                                <span className="font-bold text-xl">
                                  {data.total.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">
                                  Expected Total
                                </span>
                                <span className="font-medium">
                                  {data.expected.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between items-center pb-2 border-b">
                                <span className="text-sm text-muted-foreground">
                                  Variance
                                </span>
                                <span
                                  className={`font-medium ${
                                    data.variance >= 0
                                      ? "text-green-600 dark:text-green-400"
                                      : "text-red-600 dark:text-red-400"
                                  }`}
                                >
                                  {data.variance >= 0 ? "+" : ""}
                                  {data.variance.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">
                                  Average/Day
                                </span>
                                <span className="font-medium">
                                  {data.average.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">
                                  Target/Day
                                </span>
                                <span className="font-medium">
                                  {data.defaultMealsPerDay}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">
                                  Days with Shifts
                                </span>
                                <span className="font-medium">
                                  {data.daysWithShifts}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">
                                  Days Recorded
                                </span>
                                <span className="font-medium">
                                  {data.records}
                                  {data.records < data.daysWithShifts && (
                                    <span className="text-xs text-yellow-600 dark:text-yellow-400 ml-1">
                                      ({data.daysWithShifts - data.records} using
                                      default)
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t">
                                <span className="text-sm font-medium text-muted-foreground">
                                  % of Target
                                </span>
                                <span
                                  className={`font-bold ${
                                    data.percentOfTarget >= 100
                                      ? "text-green-600 dark:text-green-400"
                                      : data.percentOfTarget >= 80
                                        ? "text-yellow-600 dark:text-yellow-400"
                                        : "text-red-600 dark:text-red-400"
                                  }`}
                                >
                                  {data.percentOfTarget}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>

              {/* No data message */}
              {Object.keys(mealsData.totalsByLocation).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No meals served data found for the selected filters.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
