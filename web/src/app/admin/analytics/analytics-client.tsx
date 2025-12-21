"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { AnalyticsStatCards } from "@/components/analytics/analytics-stat-cards";
import { AnalyticsInsights } from "@/components/analytics/analytics-insights";
import { RetentionChart } from "@/components/analytics/retention-chart";
import { SignupTrendChart } from "@/components/analytics/signup-trend-chart";
import { MealsImpactChart } from "@/components/analytics/meals-impact-chart";
import { CapacityGaugeChart } from "@/components/analytics/capacity-gauge-chart";
import { VolunteerGradePieChart } from "@/components/analytics/volunteer-grade-pie-chart";
import { AtRiskVolunteersTable } from "@/components/analytics/at-risk-volunteers-table";
import { AnalyticsStatsSkeleton } from "@/components/analytics/analytics-stats-skeleton";
import { AnalyticsChartSkeleton } from "@/components/analytics/analytics-chart-skeleton";
import { useToast } from "@/hooks/use-toast";

interface Filters {
  location: string;
  startDate: string;
  endDate: string;
  volunteerGrade?: string;
  shiftTypeId?: string;
}

interface AnalyticsData {
  retention?: any;
  signups?: any;
  engagement?: any;
  impact?: any;
}

export function AnalyticsClient({
  initialFilters,
}: {
  initialFilters: Filters;
}) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [data, setData] = useState<AnalyticsData>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalyticsData();
  }, [filters]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("location", filters.location);
      params.set("startDate", filters.startDate);
      params.set("endDate", filters.endDate);
      if (filters.volunteerGrade)
        params.set("volunteerGrade", filters.volunteerGrade);
      if (filters.shiftTypeId) params.set("shiftTypeId", filters.shiftTypeId);

      const [retentionRes, signupsRes, engagementRes, impactRes] =
        await Promise.all([
          fetch(`/api/admin/analytics/retention?${params}`),
          fetch(`/api/admin/analytics/signups?${params}`),
          fetch(`/api/admin/analytics/engagement?${params}`),
          fetch(`/api/admin/analytics/impact?${params}`),
        ]);

      if (
        !retentionRes.ok ||
        !signupsRes.ok ||
        !engagementRes.ok ||
        !impactRes.ok
      ) {
        throw new Error("Failed to fetch analytics data");
      }

      const [retention, signups, engagement, impact] = await Promise.all([
        retentionRes.json(),
        signupsRes.json(),
        engagementRes.json(),
        impactRes.json(),
      ]);

      setData({ retention, signups, engagement, impact });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <AnalyticsFilters filters={filters} onChange={handleFilterChange} />

      {/* Insights/Alerts */}
      {!loading && data.retention && data.signups && data.impact && (
        <AnalyticsInsights data={data} />
      )}

      {/* KPI Cards */}
      {loading ? (
        <AnalyticsStatsSkeleton />
      ) : (
        <AnalyticsStatCards data={data} />
      )}

      {/* Charts in Tabs */}
      <Tabs defaultValue="retention" className="mt-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="retention">Retention</TabsTrigger>
          <TabsTrigger value="signups">Signups</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="impact">Impact</TabsTrigger>
        </TabsList>

        <TabsContent value="retention" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Volunteer Retention Curves</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <AnalyticsChartSkeleton />
              ) : (
                <RetentionChart data={data.retention?.cohortData || []} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>At-Risk Volunteers</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 animate-pulse bg-muted rounded" />
              ) : (
                <AtRiskVolunteersTable
                  data={data.retention?.atRiskVolunteers || []}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signups" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Signup Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <AnalyticsChartSkeleton />
              ) : (
                <SignupTrendChart data={data.signups?.timeSeriesData || []} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cancellation Reasons</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 animate-pulse bg-muted rounded" />
              ) : (
                <div className="space-y-2">
                  {data.signups?.cancellationReasons?.map(
                    (reason: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-3 bg-muted rounded"
                      >
                        <span className="font-medium">{reason.reason}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            {reason.count} cancellations
                          </span>
                          <span className="font-semibold">
                            {reason.percentage}%
                          </span>
                        </div>
                      </div>
                    )
                  ) || <p className="text-muted-foreground">No data available</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Registration Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <AnalyticsChartSkeleton />
              ) : (
                <SignupTrendChart
                  data={data.engagement?.registrationTrend || []}
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Volunteer Grade Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <AnalyticsChartSkeleton />
              ) : (
                <VolunteerGradePieChart
                  data={data.engagement?.volunteerGradeDistribution || {}}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="impact" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Meals Served Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <AnalyticsChartSkeleton />
              ) : (
                <MealsImpactChart data={data.impact?.mealsTrend || []} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Capacity Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <AnalyticsChartSkeleton />
              ) : (
                <CapacityGaugeChart
                  data={data.impact?.capacityUtilization || {}}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
