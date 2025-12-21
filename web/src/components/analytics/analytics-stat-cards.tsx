"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, AlertTriangle, Calendar, XCircle, Target, Utensils, Clock } from "lucide-react";
import { motion } from "motion/react";

interface AnalyticsStatCardsProps {
  data: {
    retention?: {
      atRiskVolunteers?: Array<{
        userId: string;
        name: string;
        lastShiftDate: string | null;
        daysSinceLastShift: number;
        totalShifts: number;
        riskScore: number;
      }>;
      dropoutAnalysis?: {
        totalVolunteers: number;
        activeVolunteers: number;
        dropoutRate: number;
      };
    };
    signups?: {
      timeSeriesData?: Array<{
        date: string;
        signups: number;
      }>;
      noShowPatterns?: {
        totalNoShows: number;
        noShowRate: number;
      };
    };
    impact?: {
      impactMetrics?: {
        totalMealsServed: number;
        totalHoursVolunteered: number;
        averageHoursPerVolunteer: number;
      };
      capacityUtilization?: {
        averageFillRate: number;
      };
    };
  };
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut" as const,
    },
  },
};

export function AnalyticsStatCards({ data }: AnalyticsStatCardsProps) {
  const { retention, signups, impact } = data;

  const stats = [
    {
      title: "Active Volunteers",
      value: retention?.dropoutAnalysis?.activeVolunteers || 0,
      icon: Users,
      description: `${retention?.dropoutAnalysis?.totalVolunteers || 0} total`,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
      iconColor: "text-blue-600",
      variant: "default" as const,
    },
    {
      title: "Retention Rate",
      value: `${100 - (retention?.dropoutAnalysis?.dropoutRate || 0)}%`,
      icon: TrendingUp,
      description: "30-day retention",
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-500/10",
      iconColor: "text-green-600",
      variant: "default" as const,
    },
    {
      title: "At-Risk Volunteers",
      value: retention?.atRiskVolunteers?.length || 0,
      icon: AlertTriangle,
      description: "No shifts in 30+ days",
      color: (retention?.atRiskVolunteers?.length || 0) > 5 ? "from-red-500 to-orange-500" : "from-yellow-500 to-amber-500",
      bgColor: (retention?.atRiskVolunteers?.length || 0) > 5 ? "bg-red-500/10" : "bg-yellow-500/10",
      iconColor: (retention?.atRiskVolunteers?.length || 0) > 5 ? "text-red-600" : "text-yellow-600",
      variant: (retention?.atRiskVolunteers?.length || 0) > 5 ? ("destructive" as const) : ("default" as const),
    },
    {
      title: "Total Signups",
      value: signups?.timeSeriesData?.reduce((sum: number, day: { signups: number }) => sum + day.signups, 0) || 0,
      icon: Calendar,
      description: "In selected period",
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-500/10",
      iconColor: "text-purple-600",
      variant: "default" as const,
    },
    {
      title: "No-Show Rate",
      value: `${signups?.noShowPatterns?.noShowRate || 0}%`,
      icon: XCircle,
      description: `${signups?.noShowPatterns?.totalNoShows || 0} no-shows`,
      color: (signups?.noShowPatterns?.noShowRate || 0) > 10 ? "from-red-500 to-rose-500" : "from-slate-500 to-gray-500",
      bgColor: (signups?.noShowPatterns?.noShowRate || 0) > 10 ? "bg-red-500/10" : "bg-slate-500/10",
      iconColor: (signups?.noShowPatterns?.noShowRate || 0) > 10 ? "text-red-600" : "text-slate-600",
      variant: (signups?.noShowPatterns?.noShowRate || 0) > 10 ? ("destructive" as const) : ("default" as const),
    },
    {
      title: "Average Fill Rate",
      value: `${impact?.capacityUtilization?.averageFillRate || 0}%`,
      icon: Target,
      description: "Shift capacity",
      color: "from-indigo-500 to-blue-500",
      bgColor: "bg-indigo-500/10",
      iconColor: "text-indigo-600",
      variant: "default" as const,
    },
    {
      title: "Total Meals Served",
      value: (impact?.impactMetrics?.totalMealsServed || 0).toLocaleString(),
      icon: Utensils,
      description: "In selected period",
      color: "from-orange-500 to-amber-500",
      bgColor: "bg-orange-500/10",
      iconColor: "text-orange-600",
      variant: "default" as const,
    },
    {
      title: "Volunteer Hours",
      value: (impact?.impactMetrics?.totalHoursVolunteered || 0).toLocaleString(),
      icon: Clock,
      description: `${impact?.impactMetrics?.averageHoursPerVolunteer || 0} avg per volunteer`,
      color: "from-teal-500 to-cyan-500",
      bgColor: "bg-teal-500/10",
      iconColor: "text-teal-600",
      variant: "default" as const,
    },
  ];

  return (
    <motion.div
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {stats.map((stat, index) => (
        <motion.div key={index} variants={cardVariants}>
          <Card className={`overflow-hidden border-l-4 ${stat.variant === "destructive" ? "border-l-destructive" : ""} hover:shadow-lg transition-shadow duration-200`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
