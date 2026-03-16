"use client";

import { motion } from "motion/react";
import { slideUpVariants } from "@/lib/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Plus,
  CalendarDays,
  Users,
  Star,
  BarChart3,
  ExternalLink,
} from "lucide-react";

const actions = [
  {
    label: "New Shift",
    description: "Schedule new volunteer shifts",
    href: "/admin/shifts/new",
    icon: Plus,
    testId: "create-shift-button",
    primary: true,
  },
  {
    label: "Shifts",
    description: "View and edit all shifts",
    href: "/admin/shifts",
    icon: CalendarDays,
    testId: "dashboard-manage-shifts-button",
  },
  {
    label: "Users",
    description: "View and manage volunteers",
    href: "/admin/users",
    icon: Users,
    testId: "dashboard-manage-users-button",
  },
  {
    label: "Regulars",
    description: "Manage recurring assignments",
    href: "/admin/regulars",
    icon: Star,
    testId: "dashboard-regulars-button",
  },
  {
    label: "Analytics",
    description: "View engagement metrics",
    href: "/admin/analytics",
    icon: BarChart3,
    testId: "dashboard-analytics-button",
  },
  {
    label: "Managers",
    description: "Manage restaurant managers",
    href: "/admin/restaurant-managers",
    icon: Users,
    testId: "restaurant-managers-button",
  },
  {
    label: "Public",
    description: "View the public shifts page",
    href: "/shifts",
    icon: ExternalLink,
    testId: "dashboard-view-public-shifts-button",
  },
];

export function AdminDashboardQuickActions() {
  return (
    <motion.div
      variants={slideUpVariants}
      initial="hidden"
      animate="visible"
    >
      <Card className="h-full">
        <CardHeader>
          <CardTitle data-testid="quick-actions-heading">
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {actions.map((action) => (
              <Button
                key={action.href}
                asChild
                variant={action.primary ? "default" : "outline"}
                className={
                  action.primary
                    ? "h-auto py-3 px-4 flex-col items-start gap-1 col-span-2 btn-primary"
                    : "h-auto py-3 px-4 flex-col items-start gap-1"
                }
                data-testid={action.testId}
              >
                <Link href={action.href}>
                  <div className="flex items-center gap-2 w-full">
                    <action.icon className="h-4 w-4 shrink-0" />
                    <span className="font-medium text-sm truncate">{action.label}</span>
                  </div>
                  <span className="text-xs opacity-70 font-normal pl-6 hidden sm:inline">
                    {action.description}
                  </span>
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
