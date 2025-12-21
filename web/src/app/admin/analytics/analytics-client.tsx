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
    <div className="space-y-8">
      {/* Filters */}
      <AnalyticsFilters filters={filters} onChange={handleFilterChange} />

      {/* Insights/Alerts */}
      {!loading && data.retention && data.signups && data.impact && (
        <div className="animate-in fade-in duration-500">
          <AnalyticsInsights data={data} />
        </div>
      )}

      {/* KPI Cards */}
      {loading ? (
        <AnalyticsStatsSkeleton />
      ) : (
        <AnalyticsStatCards data={data} />
      )}

      {/* Charts in Tabs */}
      <Tabs defaultValue="retention" className="mt-8">
        <TabsList className="grid w-full grid-cols-4 bg-muted p-1 h-auto">
          <TabsTrigger value="retention" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            📈 Retention
          </TabsTrigger>
          <TabsTrigger value="signups" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            📅 Signups
          </TabsTrigger>
          <TabsTrigger value="engagement" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            🎯 Engagement
          </TabsTrigger>
          <TabsTrigger value="impact" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            💪 Impact
          </TabsTrigger>
        </TabsList>

        <TabsContent value="retention" className="space-y-6 mt-6">
          <Card className="border-l-4 border-l-blue-500 shadow-md">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-950/30">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                </div>
                Volunteer Retention Curves
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <AnalyticsChartSkeleton />
              ) : (
                <RetentionChart data={data.retention?.cohortData || []} />
              )}
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/30">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                </div>
                At-Risk Volunteers
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
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

        <TabsContent value="signups" className="space-y-6 mt-6">
          <Card className="border-l-4 border-l-purple-500 shadow-md">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-transparent dark:from-purple-950/30">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
                </div>
                Signup Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <AnalyticsChartSkeleton />
              ) : (
                <SignupTrendChart data={data.signups?.timeSeriesData || []} />
              )}
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-950/30">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                </div>
                Cancellation Reasons
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
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

        <TabsContent value="engagement" className="space-y-6 mt-6">
          <Card className="border-l-4 border-l-green-500 shadow-md">
            <CardHeader className="bg-gradient-to-r from-green-50 to-transparent dark:from-green-950/30">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                Registration Trend
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <AnalyticsChartSkeleton />
              ) : (
                <SignupTrendChart
                  data={data.engagement?.registrationTrend || []}
                />
              )}
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardHeader className="bg-gradient-to-r from-pink-50 to-transparent dark:from-pink-950/30">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-pink-500/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-600"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                </div>
                Volunteer Grade Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
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

        <TabsContent value="impact" className="space-y-6 mt-6">
          <Card className="border-l-4 border-l-orange-500 shadow-md">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-950/30">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-600"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
                </div>
                Meals Served Over Time
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <AnalyticsChartSkeleton />
              ) : (
                <MealsImpactChart data={data.impact?.mealsTrend || []} />
              )}
            </CardContent>
          </Card>
          <Card className="shadow-md">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-transparent dark:from-indigo-950/30">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                </div>
                Capacity Utilization
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
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
