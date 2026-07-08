"use client";

import { useEffect, useState } from "react";
import { differenceInCalendarDays, format, isBefore, startOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  AlertTriangleIcon,
  CalendarIcon,
  ClipboardListIcon,
  HistoryIcon,
  Loader2Icon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface RangePreview {
  shiftCount: number;
  volunteerCount: number;
  shiftTypes: string[];
}

interface DeleteShiftsDateRangeDialogProps {
  location: string;
  /** Month the range picker opens at, e.g. the page's current date filter */
  defaultMonth: Date;
  onDelete: (startDate: string, endDate: string) => Promise<void>;
  /** Controlled open state; when provided together with onOpenChange, no trigger is needed */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function DeleteShiftsDateRangeDialog({
  location,
  defaultMonth,
  onDelete,
  open: controlledOpen,
  onOpenChange,
  children,
}: DeleteShiftsDateRangeDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [preview, setPreview] = useState<RangePreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const from = dateRange?.from;
  const to = dateRange?.to ?? dateRange?.from;
  const startDateStr = from ? format(from, "yyyy-MM-dd") : null;
  const endDateStr = to ? format(to, "yyyy-MM-dd") : null;

  // Load a preview of the blast radius whenever a complete range is picked
  useEffect(() => {
    if (!open || !startDateStr || !endDateStr) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoadingPreview(true);
    setPreviewError(null);

    fetch(
      `/api/admin/shifts/by-date-range?startDate=${startDateStr}&endDate=${endDateStr}&location=${encodeURIComponent(location)}`,
      { signal: controller.signal }
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load shifts");
        }
        setPreview(data);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPreview(null);
        setPreviewError(
          error instanceof Error ? error.message : "Failed to load shifts"
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingPreview(false);
        }
      });

    return () => controller.abort();
  }, [open, startDateStr, endDateStr, location]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setDateRange(undefined);
      setPreview(null);
      setPreviewError(null);
    }
  };

  const handleDelete = async () => {
    if (!startDateStr || !endDateStr) return;
    setIsDeleting(true);
    try {
      await onDelete(startDateStr, endDateStr);
      setOpen(false);
    } catch (error) {
      console.error("Failed to delete shifts:", error);
      setPreviewError(
        error instanceof Error ? error.message : "Failed to delete shifts"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const dayCount =
    from && to ? differenceInCalendarDays(to, from) + 1 : 0;
  const includesPastDays = from
    ? isBefore(startOfDay(from), startOfDay(new Date()))
    : false;
  const hasVolunteers = (preview?.volunteerCount ?? 0) > 0;
  const canDelete =
    !isLoadingPreview && !isDeleting && (preview?.shiftCount ?? 0) > 0;

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      {children && (
        <ResponsiveDialogTrigger asChild>{children}</ResponsiveDialogTrigger>
      )}
      <ResponsiveDialogContent
        className="sm:max-w-md"
        data-testid="delete-date-range-dialog"
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle
            className="flex items-center gap-2 text-red-600 dark:text-red-400"
            data-testid="delete-date-range-dialog-title"
          >
            <Trash2Icon className="h-5 w-5" />
            Delete Shifts by Date Range
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Every shift at {location} between the selected dates will be
            permanently deleted. This action cannot be undone.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          {/* Date range picker */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date range *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-11 w-full justify-start text-left font-normal",
                    !from && "text-muted-foreground"
                  )}
                  data-testid="delete-date-range-input"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {from && to ? (
                    <>
                      {format(from, "EEE d MMM yyyy")}
                      {"  -  "}
                      {format(to, "EEE d MMM yyyy")}
                    </>
                  ) : from ? (
                    format(from, "EEE d MMM yyyy")
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  autoFocus
                  numberOfMonths={2}
                  defaultMonth={defaultMonth}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Preview of what will be deleted */}
          {from && to && (
            <div
              className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-900/50"
              data-testid="delete-date-range-preview"
              aria-live="polite"
            >
              <div className="flex items-center gap-2 mb-3">
                <CalendarIcon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span className="font-medium">
                  {dayCount} day{dayCount !== 1 ? "s" : ""} - {location}
                </span>
              </div>

              {isLoadingPreview ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  Checking shifts in this range...
                </div>
              ) : preview ? (
                preview.shiftCount === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No shifts found in this range for {location}. Pick a
                    different range or location.
                  </p>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <ClipboardListIcon className="h-4 w-4 text-slate-500" />
                      <span>
                        <strong>{preview.shiftCount}</strong> shift
                        {preview.shiftCount !== 1 ? "s" : ""} will be deleted
                      </span>
                    </div>

                    {hasVolunteers && (
                      <div className="flex items-center gap-2">
                        <UsersIcon className="h-4 w-4 text-slate-500" />
                        <span>
                          <strong>{preview.volunteerCount}</strong> volunteer
                          {preview.volunteerCount !== 1 ? "s" : ""} currently
                          signed up
                        </span>
                      </div>
                    )}

                    {preview.shiftTypes.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-slate-600 dark:text-slate-400">
                          Shift types:{" "}
                        </span>
                        <span>{preview.shiftTypes.join(", ")}</span>
                      </div>
                    )}
                  </div>
                )
              ) : null}
            </div>
          )}

          {/* Fetch/delete errors */}
          {previewError && (
            <Alert variant="destructive">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription data-testid="delete-date-range-error">
                {previewError}
              </AlertDescription>
            </Alert>
          )}

          {/* Warning when the range reaches into the past */}
          {includesPastDays && (
            <Alert>
              <HistoryIcon className="h-4 w-4" />
              <AlertDescription>
                This range includes past days. Deleting past shifts also
                removes their attendance history.
              </AlertDescription>
            </Alert>
          )}

          {/* Warning about volunteers */}
          {hasVolunteers && preview && (
            <Alert variant="destructive">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">
                    {preview.volunteerCount} volunteer
                    {preview.volunteerCount !== 1 ? "s are" : " is"} signed up
                    for these shifts
                  </p>
                  <p className="text-sm">Deleting these shifts will:</p>
                  <ul className="text-sm list-disc list-inside space-y-1 ml-2">
                    <li>Remove all volunteer signups</li>
                    <li>Cancel volunteer notifications</li>
                    <li>Remove the shifts from volunteer schedules</li>
                  </ul>
                  <p className="text-sm font-medium">
                    Consider notifying the volunteers before deleting these
                    shifts.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <ResponsiveDialogFooter className="flex gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
            data-testid="delete-date-range-cancel-button"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete}
            data-testid="delete-date-range-confirm-button"
          >
            {isDeleting ? (
              <>
                <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2Icon className="h-4 w-4 mr-2" />
                {preview && preview.shiftCount > 0
                  ? `Delete ${preview.shiftCount} Shift${preview.shiftCount !== 1 ? "s" : ""}`
                  : "Delete Shifts"}
              </>
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
