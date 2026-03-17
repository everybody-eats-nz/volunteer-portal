"use client";

import { motion } from "motion/react";
import { slideUpVariants } from "@/lib/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";

export interface UpcomingShiftData {
  id: string;
  shiftTypeName: string;
  formattedDate: string;
  dateParam: string;
  location: string | null;
  capacity: number;
  confirmedCount: number;
}

export interface UpcomingShiftDay {
  label: string;
  dateParam: string;
  shifts: UpcomingShiftData[];
}

interface AdminDashboardUpcomingShiftsProps {
  days: UpcomingShiftDay[];
}

export function AdminDashboardUpcomingShifts({
  days,
}: AdminDashboardUpcomingShiftsProps) {
  return (
    <motion.div variants={slideUpVariants} initial="hidden" animate="visible">
      <Card className="h-full">
        <CardHeader>
          <CardTitle data-testid="next-shift-heading">
            Upcoming Shifts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {days.length > 0 ? (
            <div className="space-y-4">
              {days.map((day, dayIndex) => {
                const totalConfirmed = day.shifts.reduce(
                  (sum, s) => sum + s.confirmedCount,
                  0
                );
                const totalCapacity = day.shifts.reduce(
                  (sum, s) => sum + s.capacity,
                  0
                );
                const dayFillRate =
                  totalCapacity > 0
                    ? (totalConfirmed / totalCapacity) * 100
                    : 0;

                return (
                  <div
                    key={day.dateParam}
                    className={cn(
                      dayIndex < days.length - 1 &&
                        "pb-4 border-b border-border"
                    )}
                  >
                    {/* Day header */}
                    <div className="flex items-center justify-between mb-2">
                      <Link
                        href={`/admin/shifts?date=${day.dateParam}`}
                        className="font-medium text-sm hover:underline"
                      >
                        {day.label}
                      </Link>
                      <Badge
                        variant={dayFillRate >= 50 ? "secondary" : "destructive"}
                        data-testid={
                          dayIndex === 0
                            ? "shift-volunteers-badge"
                            : undefined
                        }
                      >
                        {totalConfirmed} / {totalCapacity}
                      </Badge>
                    </div>

                    {/* Day fill bar */}
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted mb-2">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          dayFillRate >= 75
                            ? "bg-green-500"
                            : dayFillRate >= 50
                              ? "bg-amber-500"
                              : "bg-red-500"
                        )}
                        style={{ width: `${Math.min(dayFillRate, 100)}%` }}
                      />
                    </div>

                    {/* Shifts for this day */}
                    <div className="space-y-1">
                      {day.shifts.map((shift) => {
                        const fillRate =
                          shift.capacity > 0
                            ? (shift.confirmedCount / shift.capacity) * 100
                            : 0;
                        return (
                          <Link
                            key={shift.id}
                            href={`/admin/shifts?date=${shift.dateParam}${
                              shift.location
                                ? `&location=${encodeURIComponent(shift.location)}`
                                : ""
                            }&shiftId=${shift.id}`}
                            className="flex items-center justify-between gap-2 py-1 px-2 rounded text-xs hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-muted-foreground shrink-0">
                                {shift.formattedDate}
                              </span>
                              <span className="truncate">
                                {shift.shiftTypeName}
                              </span>
                              {shift.location && (
                                <span className="text-muted-foreground flex items-center gap-0.5 shrink-0">
                                  <MapPin className="h-3 w-3" />
                                  {shift.location}
                                </span>
                              )}
                            </div>
                            <span
                              className={cn(
                                "shrink-0 tabular-nums font-medium",
                                fillRate >= 75
                                  ? "text-green-600 dark:text-green-400"
                                  : fillRate >= 50
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-red-600 dark:text-red-400"
                              )}
                            >
                              {shift.confirmedCount}/{shift.capacity}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <Button
                asChild
                size="sm"
                variant="outline"
                className="w-full"
                data-testid="view-shift-details-button"
              >
                <Link href="/admin/shifts?upcoming=true">View All Shifts</Link>
              </Button>
            </div>
          ) : (
            <p
              className="text-muted-foreground text-sm"
              data-testid="no-upcoming-shifts"
            >
              No upcoming shifts scheduled
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
