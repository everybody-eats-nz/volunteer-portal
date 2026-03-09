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

interface AdminDashboardUpcomingShiftsProps {
  shifts: UpcomingShiftData[];
}

export function AdminDashboardUpcomingShifts({
  shifts,
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
          {shifts.length > 0 ? (
            <div className="space-y-4">
              {shifts.map((shift, index) => {
                const fillRate =
                  shift.capacity > 0
                    ? (shift.confirmedCount / shift.capacity) * 100
                    : 0;
                return (
                  <div
                    key={shift.id}
                    className={cn(
                      "space-y-2",
                      index < shifts.length - 1 && "pb-4 border-b border-border"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-medium text-sm truncate  mb-2">
                          <Link
                            href={`/admin/shifts?date=${shift.dateParam}${
                              shift.location
                                ? `&location=${encodeURIComponent(
                                    shift.location
                                  )}`
                                : ""
                            }&shiftId=${shift.id}`}
                            className="hover:underline"
                          >
                            {shift.shiftTypeName}
                          </Link>
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {shift.formattedDate}
                        </p>
                        {shift.location && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {shift.location}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={fillRate >= 50 ? "secondary" : "destructive"}
                        data-testid={
                          index === 0 ? "shift-volunteers-badge" : undefined
                        }
                      >
                        {shift.confirmedCount} / {shift.capacity}
                      </Badge>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          fillRate >= 75
                            ? "bg-green-500"
                            : fillRate >= 50
                            ? "bg-amber-500"
                            : "bg-red-500"
                        )}
                        style={{ width: `${Math.min(fillRate, 100)}%` }}
                      />
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
