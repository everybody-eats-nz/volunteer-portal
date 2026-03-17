import { prisma } from "@/lib/prisma";
import { formatInNZT, getStartOfDayUTC } from "@/lib/timezone";
import { differenceInHours } from "date-fns";
import { generateCalendarUrls } from "@/lib/calendar-utils";
import { Button } from "@/components/ui/button";
import { AvatarList } from "@/components/ui/avatar-list";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { CancelSignupButton } from "./cancel-signup-button";
import { StatusBadge } from "./status-badge";
import { getShiftTheme } from "@/lib/shift-themes";
import { CalendarPlus } from "lucide-react";
import type { ShiftSignup } from "./my-shifts-content";

export async function ShiftDetailsDialog({
  shift,
  now,
  children,
}: {
  shift: ShiftSignup;
  now: Date;
  children: React.ReactNode;
}) {
  const theme = getShiftTheme(shift.shift.shiftType.name);
  const isPastShift = shift.shift.end < now;

  // Fetch meals served for this shift's date and location
  let mealsServedData = null;
  let defaultMealsServed = null;
  let isEstimated = false;

  if (isPastShift && shift.shift.location) {
    const startOfDayUTC = getStartOfDayUTC(shift.shift.start);

    // First try to get actual meals served
    mealsServedData = await prisma.mealsServed.findUnique({
      where: {
        date_location: {
          date: startOfDayUTC,
          location: shift.shift.location,
        },
      },
    });

    // If no actual data, get the location's default
    if (!mealsServedData) {
      const locationData = await prisma.location.findUnique({
        where: { name: shift.shift.location },
        select: { defaultMealsServed: true },
      });
      defaultMealsServed = locationData?.defaultMealsServed;
      isEstimated = true;
    }
  }

  return (
    <ResponsiveDialog>
      <ResponsiveDialogTrigger asChild>{children}</ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl bg-gradient-to-br ${theme.fullGradient} shadow-lg flex items-center justify-center text-white text-lg`}
            >
              {theme.emoji}
            </div>
            <div>
              <div className="font-semibold">
                {shift.shift.shiftType.name}
              </div>
              <div className="text-sm font-normal text-muted-foreground">
                {formatInNZT(shift.shift.start, "EEEE, MMMM d, yyyy")}
              </div>
            </div>
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <StatusBadge status={shift.status} isPast={isPastShift} />
          </div>

          {/* Time */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Time</span>
            <div className="text-sm text-right">
              <div>
                {formatInNZT(shift.shift.start, "h:mm a")} -{" "}
                {formatInNZT(shift.shift.end, "h:mm a")}
              </div>
              <div className="text-xs text-muted-foreground">
                {differenceInHours(shift.shift.end, shift.shift.start)} hours
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Location</span>
            <span className="text-sm">
              {shift.shift.location || "To be confirmed"}
            </span>
          </div>

          {/* Meals Served (for past shifts) */}
          {isPastShift && (mealsServedData || defaultMealsServed) && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Meals Served</span>
              <div className="text-sm text-right">
                <div
                  className={
                    isEstimated
                      ? "text-muted-foreground"
                      : "font-semibold text-primary"
                  }
                >
                  {isEstimated ? "~" : ""}
                  {mealsServedData?.mealsServed || defaultMealsServed} people
                </div>
                {isEstimated && (
                  <div className="text-xs text-muted-foreground">
                    estimated
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {shift.shift.shiftType.description && (
            <div>
              <div className="text-sm font-medium mb-2">Description</div>
              <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                {shift.shift.shiftType.description}
              </div>
            </div>
          )}

          {/* Notes */}
          {shift.shift.notes && (
            <div>
              <div className="text-sm font-medium mb-2">Notes</div>
              <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                {shift.shift.notes}
              </div>
            </div>
          )}

          {/* Friends joining */}
          {shift.shift.signups.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-3">Friends Joining</div>
              <AvatarList
                users={shift.shift.signups.map((signup) => signup.user)}
                size="md"
                maxDisplay={6}
              />
            </div>
          )}

          {/* Actions */}
          {!isPastShift && (
            <div className="pt-4 border-t space-y-3">
              {/* Add to Calendar */}
              <div>
                <div className="text-sm font-medium mb-2">
                  Add to Calendar
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(() => {
                    const urls = generateCalendarUrls(shift.shift);
                    return (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          asChild
                        >
                          <a
                            href={urls.google}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <CalendarPlus className="h-3 w-3" />
                            Google
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          asChild
                        >
                          <a
                            href={urls.outlook}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <CalendarPlus className="h-3 w-3" />
                            Outlook
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          asChild
                        >
                          <a
                            href={urls.ics}
                            download={`shift-${shift.shift.id}.ics`}
                          >
                            <CalendarPlus className="h-3 w-3" />
                            .ics File
                          </a>
                        </Button>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Cancel Shift */}
              <CancelSignupButton
                shiftId={shift.shift.id}
                shiftName={shift.shift.shiftType.name}
              />
            </div>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
