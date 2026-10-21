"use client";

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
    label: "Days with shifts left",
    icon: CalendarDays,
  },
  {
    key: "signups",
    label: "Volunteer signups",
    icon: Users,
  },
  {
    key: "hours",
    label: "Hours volunteered",
    icon: Clock,
  },
  {
    key: "meals",
    label: "Meals served",
    icon: UtensilsCrossed,
  },
  {
    key: "newUsers",
    label: "New registrations",
    icon: UserPlus,
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
    <div>
      <Card>
        <CardHeader>
          <CardTitle data-testid="week-summary-heading">
            This week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2" data-testid="week-summary-stats">
            {stats.map((stat) => (
              <div
                key={stat.key}
                className="flex items-center gap-3 p-2 rounded-lg"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary-light text-primary-text">
                  <stat.icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
                <span className="font-semibold text-sm tabular-nums">
                  {values[stat.key].toLocaleString("en-NZ")}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
