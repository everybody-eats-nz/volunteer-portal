"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/admin/status-badge";
import { STATUS_ICON, type StatusTone } from "@/lib/status-styles";
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

/** 75%+ filled is healthy, 50-75% wants a nudge, under 50% is short. */
function fillTone(fillRate: number): StatusTone {
  if (fillRate >= 75) return "confirmed";
  if (fillRate >= 50) return "pending";
  return "danger";
}

const FILL_BAR: Record<StatusTone, string> = {
  confirmed: "bg-forest-400 dark:bg-forest-300",
  pending: "bg-amber-500",
  waitlisted: "bg-sky-500",
  danger: "bg-red-600 dark:bg-red-500",
  neutral: "bg-stone-400",
};

interface AdminDashboardUpcomingShiftsProps {
  days: UpcomingShiftDay[];
}

export function AdminDashboardUpcomingShifts({
  days,
}: AdminDashboardUpcomingShiftsProps) {
  return (
    <div>
      <Card className="h-full">
        <CardHeader>
          <CardTitle data-testid="next-shift-heading">
            Upcoming shifts
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
                      <StatusBadge
                        tone={fillTone(dayFillRate)}
                        className="tabular-nums"
                        data-testid={
                          dayIndex === 0
                            ? "shift-volunteers-badge"
                            : undefined
                        }
                      >
                        {totalConfirmed} / {totalCapacity}
                      </StatusBadge>
                    </div>

                    {/* Day fill bar */}
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted mb-2">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          FILL_BAR[fillTone(dayFillRate)]
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
                                STATUS_ICON[fillTone(fillRate)]
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
    </div>
  );
}
