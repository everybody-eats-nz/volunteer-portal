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

const detailLabel =
  "text-[0.65rem] font-medium uppercase tracking-[0.18em] text-forest-500/70 dark:text-cream-50/55";

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className={detailLabel}>{label}</span>
      <div className="text-right text-sm text-forest-700 dark:text-cream-50">
        {children}
      </div>
    </div>
  );
}

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
    const record = await prisma.mealsServed.findUnique({
      where: {
        date_location: {
          date: startOfDayUTC,
          location: shift.shift.location,
        },
      },
    });

    // Treat note-only records (mealsServed === null) the same as "no data"
    // — we still need a number to display, so fall back to the location default.
    if (record && record.mealsServed !== null) {
      mealsServedData = record;
    } else {
      const locationData = await prisma.location.findUnique({
        where: { name: shift.shift.location },
        select: { defaultMealsServed: true },
      });
      defaultMealsServed = locationData?.defaultMealsServed;
      isEstimated = true;
    }
  }

  const mealsServed = mealsServedData?.mealsServed || defaultMealsServed;

  return (
    <ResponsiveDialog>
      <ResponsiveDialogTrigger asChild>{children}</ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-3 text-left">
            <span
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sun-100 text-xl ring-1 ring-forest-500/10 dark:bg-sun-200/15 dark:ring-cream-50/10"
            >
              {theme.emoji}
            </span>
            <span className="min-w-0">
              <span className="display display-medium block truncate text-xl tracking-tight text-forest-700 dark:text-cream-50">
                {shift.shift.shiftType.name}
              </span>
              <span className="block text-sm font-normal text-forest-700/65 dark:text-cream-50/65">
                {formatInNZT(shift.shift.start, "EEEE, MMMM d, yyyy")}
              </span>
            </span>
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          {/* Key facts */}
          <div className="divide-y divide-forest-500/10 dark:divide-cream-50/10">
            <DetailRow label="Status">
              <StatusBadge status={shift.status} isPast={isPastShift} />
            </DetailRow>

            <DetailRow label="Time">
              <div>
                {formatInNZT(shift.shift.start, "h:mm a")} –{" "}
                {formatInNZT(shift.shift.end, "h:mm a")}
              </div>
              <div className="text-xs text-forest-700/60 dark:text-cream-50/55">
                {differenceInHours(shift.shift.end, shift.shift.start)} hours
              </div>
            </DetailRow>

            <DetailRow label="Location">
              {shift.shift.location || "To be confirmed"}
            </DetailRow>
          </div>

          {/* Meals served (for past shifts) — the pay-off moment */}
          {isPastShift && mealsServed && (
            <div className="grain relative overflow-hidden rounded-2xl bg-sun-100/70 p-4 ring-1 ring-forest-500/10 dark:bg-sun-200/10 dark:ring-cream-50/10">
              <p className="eyebrow text-forest-600/80 dark:text-sun-200/80">
                Ka pai — kai on the table
              </p>
              <p className="mt-1.5 text-sm text-forest-700/85 dark:text-cream-50/85">
                <span className="display text-2xl tracking-tight text-forest-700 tabular-nums dark:text-cream-50">
                  {isEstimated ? "~" : ""}
                  {mealsServed}
                </span>{" "}
                people fed that day
                {isEstimated && (
                  <span className="text-forest-700/60 dark:text-cream-50/55">
                    {" "}
                    (estimated)
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Description */}
          {shift.shift.shiftType.description && (
            <div>
              <div className={`${detailLabel} mb-2`}>Description</div>
              <div className="rounded-2xl bg-forest-500/5 p-3 text-sm leading-relaxed text-forest-700/80 dark:bg-cream-50/5 dark:text-cream-50/80">
                {shift.shift.shiftType.description}
              </div>
            </div>
          )}

          {/* Notes */}
          {shift.shift.notes && (
            <div>
              <div className={`${detailLabel} mb-2`}>Notes</div>
              <div className="rounded-2xl bg-forest-500/5 p-3 text-sm leading-relaxed text-forest-700/80 dark:bg-cream-50/5 dark:text-cream-50/80">
                {shift.shift.notes}
              </div>
            </div>
          )}

          {/* Friends joining */}
          {shift.shift.signups.length > 0 && (
            <div>
              <div className={`${detailLabel} mb-3`}>
                {isPastShift ? "Whānau who joined" : "Whānau joining"}
              </div>
              <AvatarList
                users={shift.shift.signups.map((signup) => signup.user)}
                size="md"
                maxDisplay={6}
              />
            </div>
          )}

          {/* Actions */}
          {!isPastShift && (
            <div className="space-y-4 border-t border-forest-500/10 pt-4 dark:border-cream-50/10">
              {/* Add to Calendar */}
              <div>
                <div className={`${detailLabel} mb-2`}>Add to calendar</div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const urls = generateCalendarUrls(shift.shift);
                    return (
                      <>
                        <Button variant="outline" size="sm" className="gap-2" asChild>
                          <a
                            href={urls.google}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <CalendarPlus className="h-3 w-3" />
                            Google
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2" asChild>
                          <a
                            href={urls.outlook}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <CalendarPlus className="h-3 w-3" />
                            Outlook
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2" asChild>
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
                className="w-full"
              />
            </div>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
