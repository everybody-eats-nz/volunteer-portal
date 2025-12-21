"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, TrendingUp, AlertCircle } from "lucide-react";
import Link from "next/link";

interface AnalyticsInsightsProps {
  data: {
    retention?: any;
    signups?: any;
    engagement?: any;
    impact?: any;
  };
}

export function AnalyticsInsights({ data }: AnalyticsInsightsProps) {
  const { retention, signups, impact } = data;

  const insights: Array<{
    type: "default" | "destructive";
    title: string;
    description: string;
    action?: { label: string; href: string };
  }> = [];

  // At-risk volunteers
  if (retention?.atRiskVolunteers?.length > 0) {
    insights.push({
      type: "destructive",
      title: `${retention.atRiskVolunteers.length} volunteers at risk`,
      description: "These volunteers haven't signed up in 30+ days but were previously active. Consider reaching out with personalized engagement.",
      action: {
        label: "View volunteers",
        href: "/admin/users?filter=inactive",
      },
    });
  }

  // High no-show rate
  if (signups?.noShowPatterns?.noShowRate > 10) {
    insights.push({
      type: "destructive",
      title: `High no-show rate: ${signups.noShowPatterns.noShowRate}%`,
      description: `${signups.noShowPatterns.totalNoShows} volunteers didn't show up to their shifts. This may indicate communication or scheduling issues.`,
    });
  }

  // Low capacity utilization
  if (impact?.capacityUtilization?.averageFillRate < 60) {
    insights.push({
      type: "default",
      title: "Shifts are underutilized",
      description: `Average fill rate is ${impact.capacityUtilization.averageFillRate}%. ${impact.capacityUtilization.underutilizedShifts} shifts are below 50% capacity.`,
      action: {
        label: "Send notifications",
        href: "/admin/notifications",
      },
    });
  }

  // Positive: High retention
  if (retention?.dropoutAnalysis?.dropoutRate < 20) {
    insights.push({
      type: "default",
      title: "Excellent volunteer retention!",
      description: `Only ${retention.dropoutAnalysis.dropoutRate}% of volunteers have become inactive. Your engagement strategy is working well.`,
    });
  }

  if (insights.length === 0) {
    return null;
  }

  const iconMap = {
    default: Info,
    destructive: AlertCircle,
  };

  return (
    <div className="space-y-3">
      {insights.map((insight, index) => {
        const Icon = iconMap[insight.type];
        return (
          <Alert key={index} variant={insight.type}>
            <Icon className="h-4 w-4" />
            <AlertTitle>{insight.title}</AlertTitle>
            <AlertDescription className="mt-2 flex items-center justify-between">
              <span>{insight.description}</span>
              {insight.action && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={insight.action.href}>{insight.action.label}</Link>
                </Button>
              )}
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
