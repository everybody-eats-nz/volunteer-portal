"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, AlertTriangle, Calendar, XCircle, Target, Utensils, Clock } from "lucide-react";

interface AnalyticsStatCardsProps {
  data: {
    retention?: any;
    signups?: any;
    engagement?: any;
    impact?: any;
  };
}

export function AnalyticsStatCards({ data }: AnalyticsStatCardsProps) {
  const { retention, signups, engagement, impact } = data;

  const stats = [
    {
      title: "Active Volunteers",
      value: retention?.dropoutAnalysis?.activeVolunteers || 0,
      icon: Users,
      description: `${retention?.dropoutAnalysis?.totalVolunteers || 0} total`,
      variant: "default" as const,
    },
    {
      title: "Retention Rate",
      value: `${100 - (retention?.dropoutAnalysis?.dropoutRate || 0)}%`,
      icon: TrendingUp,
      description: "30-day retention",
      variant: "default" as const,
    },
    {
      title: "At-Risk Volunteers",
      value: retention?.atRiskVolunteers?.length || 0,
      icon: AlertTriangle,
      description: "No shifts in 30+ days",
      variant: retention?.atRiskVolunteers?.length > 5 ? ("destructive" as const) : ("default" as const),
    },
    {
      title: "Total Signups",
      value: signups?.timeSeriesData?.reduce((sum: number, day: any) => sum + day.signups, 0) || 0,
      icon: Calendar,
      description: "In selected period",
      variant: "default" as const,
    },
    {
      title: "No-Show Rate",
      value: `${signups?.noShowPatterns?.noShowRate || 0}%`,
      icon: XCircle,
      description: `${signups?.noShowPatterns?.totalNoShows || 0} no-shows`,
      variant: (signups?.noShowPatterns?.noShowRate || 0) > 10 ? ("destructive" as const) : ("default" as const),
    },
    {
      title: "Average Fill Rate",
      value: `${impact?.capacityUtilization?.averageFillRate || 0}%`,
      icon: Target,
      description: "Shift capacity",
      variant: "default" as const,
    },
    {
      title: "Total Meals Served",
      value: (impact?.impactMetrics?.totalMealsServed || 0).toLocaleString(),
      icon: Utensils,
      description: "In selected period",
      variant: "default" as const,
    },
    {
      title: "Volunteer Hours",
      value: (impact?.impactMetrics?.totalHoursVolunteered || 0).toLocaleString(),
      icon: Clock,
      description: `${impact?.impactMetrics?.averageHoursPerVolunteer || 0} avg per volunteer`,
      variant: "default" as const,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index} className={stat.variant === "destructive" ? "border-destructive" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.variant === "destructive" ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stat.variant === "destructive" ? "text-destructive" : ""}`}>{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
