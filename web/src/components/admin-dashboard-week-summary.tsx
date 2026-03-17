"use client";

import { motion } from "motion/react";
import { slideUpVariants } from "@/lib/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CalendarDays,
  Users,
  Clock,
  UtensilsCrossed,
  UserPlus,
} from "lucide-react";

interface AdminDashboardWeekSummaryProps {
  weekShifts: number;
  weekSignups: number;
  weekVolunteerHours: number;
  weekMeals: number;
  weekNewUsers: number;
}

const stats = [
  {
    key: "shifts",
    label: "Days with Shifts Left",
    icon: CalendarDays,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/50",
  },
  {
    key: "signups",
    label: "Volunteer Signups",
    icon: Users,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-900/50",
  },
  {
    key: "hours",
    label: "Hours Volunteered",
    icon: Clock,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/50",
  },
  {
    key: "meals",
    label: "Meals Served",
    icon: UtensilsCrossed,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-900/50",
  },
  {
    key: "newUsers",
    label: "New Registrations",
    icon: UserPlus,
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-100 dark:bg-pink-900/50",
  },
] as const;

export function AdminDashboardWeekSummary({
  weekShifts,
  weekSignups,
  weekVolunteerHours,
  weekMeals,
  weekNewUsers,
}: AdminDashboardWeekSummaryProps) {
  const values: Record<string, number> = {
    shifts: weekShifts,
    signups: weekSignups,
    hours: Math.round(weekVolunteerHours * 10) / 10,
    meals: weekMeals,
    newUsers: weekNewUsers,
  };

  return (
    <motion.div variants={slideUpVariants} initial="hidden" animate="visible">
      <Card>
        <CardHeader>
          <CardTitle data-testid="week-summary-heading">
            This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2" data-testid="week-summary-stats">
            {stats.map((stat) => (
              <div
                key={stat.key}
                className="flex items-center gap-3 p-2 rounded-lg"
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${stat.bg}`}
                >
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
                <span className="font-semibold text-sm tabular-nums">
                  {values[stat.key]}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
