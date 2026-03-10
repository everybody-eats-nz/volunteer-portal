"use client";

import { motion } from "motion/react";
import { StatsGrid } from "@/components/dashboard-animated";
import { staggerItem } from "@/lib/motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Users, Calendar, Clock, TrendingUp } from "lucide-react";

interface AdminDashboardStatsProps {
  totalVolunteers: number;
  totalAdmins: number;
  totalUsers: number;
  upcomingShifts: number;
  pastShifts: number;
  signupsLast7Days: number;
  signupsLast30Days: number;
  pendingSignups: number;
  monthlySignups: number;
  monthlyShifts: number;
  newUsersThisMonth: number;
}

const styles = {
  blue: {
    card: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800/50",
    value: "text-blue-700 dark:text-blue-300",
    title: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-900/50",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  green: {
    card: "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800/50",
    value: "text-green-700 dark:text-green-300",
    title: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-100 dark:bg-green-900/50",
    iconColor: "text-green-600 dark:text-green-400",
  },
  amber: {
    card: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800/50",
    value: "text-amber-700 dark:text-amber-300",
    title: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-900/50",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  purple: {
    card: "bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 border-purple-200 dark:border-purple-800/50",
    value: "text-purple-700 dark:text-purple-300",
    title: "text-purple-600 dark:text-purple-400",
    iconBg: "bg-purple-100 dark:bg-purple-900/50",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
};

export function AdminDashboardStats({
  totalVolunteers,
  totalAdmins,
  totalUsers,
  upcomingShifts,
  pastShifts,
  signupsLast7Days,
  signupsLast30Days,
  pendingSignups,
  monthlySignups,
  monthlyShifts,
  newUsersThisMonth,
}: AdminDashboardStatsProps) {
  return (
    <StatsGrid>
      <motion.div variants={staggerItem}>
        <Card
          className={cn("p-4", styles.blue.card)}
          data-testid="total-users-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className={cn("text-2xl font-bold", styles.blue.value)}>
                {totalVolunteers}
              </div>
              <div className={cn("text-sm font-medium", styles.blue.title)}>
                Total Volunteers
              </div>
              <div
                className="text-xs text-muted-foreground mt-1"
                data-testid="users-breakdown"
              >
                {totalAdmins} admins, {totalUsers} total
              </div>
            </div>
            <div className={cn("p-2 rounded-lg", styles.blue.iconBg)}>
              <Users className={cn("h-5 w-5", styles.blue.iconColor)} />
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card
          className={cn("p-4", styles.green.card)}
          data-testid="total-shifts-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className={cn("text-2xl font-bold", styles.green.value)}>
                {upcomingShifts}
              </div>
              <div className={cn("text-sm font-medium", styles.green.title)}>
                Upcoming Shifts
              </div>
              <div
                className="text-xs text-muted-foreground mt-1"
                data-testid="shifts-breakdown"
              >
                {pastShifts} completed
              </div>
            </div>
            <div className={cn("p-2 rounded-lg", styles.green.iconBg)}>
              <Calendar className={cn("h-5 w-5", styles.green.iconColor)} />
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card
          className={cn("p-4", styles.amber.card)}
          data-testid="recent-signups-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className={cn("text-2xl font-bold", styles.amber.value)}>
                {signupsLast7Days}
              </div>
              <div
                className={cn(
                  "text-sm font-medium flex items-center gap-2",
                  styles.amber.title
                )}
              >
                Recent Signups
                {pendingSignups > 0 && (
                  <Badge
                    variant="warning"
                    data-testid="pending-signups-badge"
                  >
                    {pendingSignups} pending
                  </Badge>
                )}
              </div>
              <div
                className="text-xs text-muted-foreground mt-1"
                data-testid="signups-breakdown"
              >
                {signupsLast30Days} in last 30 days
              </div>
            </div>
            <div className={cn("p-2 rounded-lg", styles.amber.iconBg)}>
              <Clock className={cn("h-5 w-5", styles.amber.iconColor)} />
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Card
          className={cn("p-4", styles.purple.card)}
          data-testid="this-month-card"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className={cn("text-2xl font-bold", styles.purple.value)}>
                {monthlySignups}
              </div>
              <div className={cn("text-sm font-medium", styles.purple.title)}>
                This Month
              </div>
              <div
                className="text-xs text-muted-foreground mt-1"
                data-testid="monthly-signups-text"
              >
                {monthlyShifts} shifts
              </div>
              <div
                className="text-xs text-muted-foreground"
                data-testid="monthly-new-users-text"
              >
                {newUsersThisMonth} new users
              </div>
            </div>
            <div className={cn("p-2 rounded-lg", styles.purple.iconBg)}>
              <TrendingUp className={cn("h-5 w-5", styles.purple.iconColor)} />
            </div>
          </div>
        </Card>
      </motion.div>
    </StatsGrid>
  );
}
