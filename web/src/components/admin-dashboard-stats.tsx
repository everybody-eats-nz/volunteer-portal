import { Users, Calendar, Clock, TrendingUp } from "lucide-react";
import { KpiTile } from "@/components/admin/kpi-tile";
import { StatusBadge } from "@/components/admin/status-badge";

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
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        data-testid="total-users-card"
        href="/admin/users"
        tone="forest"
        icon={<Users />}
        label="Total volunteers"
        value={totalVolunteers}
        hint={
          <span data-testid="users-breakdown">
            {totalAdmins} admins, {totalUsers} total
          </span>
        }
      />
      <KpiTile
        data-testid="total-shifts-card"
        href="/admin/shifts"
        tone="forest"
        icon={<Calendar />}
        label="Upcoming shifts"
        value={upcomingShifts}
        hint={
          <span data-testid="shifts-breakdown">{pastShifts} completed</span>
        }
      />
      <KpiTile
        data-testid="recent-signups-card"
        tone="sun"
        icon={<Clock />}
        label="Signups, last 7 days"
        value={signupsLast7Days}
        badge={
          pendingSignups > 0 && (
            <StatusBadge tone="pending" data-testid="pending-signups-badge">
              {pendingSignups} pending
            </StatusBadge>
          )
        }
        hint={
          <span data-testid="signups-breakdown">
            {signupsLast30Days} in last 30 days
          </span>
        }
      />
      <KpiTile
        data-testid="this-month-card"
        tone="neutral"
        icon={<TrendingUp />}
        label="Signups this month"
        value={monthlySignups}
        hint={
          <>
            <span data-testid="monthly-signups-text" className="block">
              {monthlyShifts} shifts
            </span>
            <span data-testid="monthly-new-users-text" className="block">
              {newUsersThisMonth} new users
            </span>
          </>
        }
      />
    </div>
  );
}
