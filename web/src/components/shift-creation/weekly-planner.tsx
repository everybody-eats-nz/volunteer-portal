"use client";

import React from "react";
import { useFormStatus } from "react-dom";
import {
  eachDayOfInterval,
  format,
  getDay,
  isBefore,
  isSameDay,
  startOfDay,
} from "date-fns";
import { DateRange } from "react-day-picker";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PlannerSection } from "./planner-section";
import { RunSheet, RunSheetLine } from "./run-sheet";
import {
  DAYS_OF_WEEK,
  groupTemplatesByLocation,
  TemplateOption,
  templateDisplayName,
  templateTestId,
} from "./types";

const DAY_NAME_BY_INDEX = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

interface WeeklyPlannerProps {
  templates: TemplateOption[];
  locations: readonly string[];
  action: (formData: FormData) => Promise<void>;
}

function SubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      className="h-12 w-full rounded-full text-base"
      data-testid="create-schedule-button"
      disabled={pending}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creating shifts...
        </>
      ) : count > 0 ? (
        `Create Schedule · ${count} shift${count === 1 ? "" : "s"}`
      ) : (
        "Create Schedule"
      )}
    </Button>
  );
}

export function WeeklyPlanner({
  templates,
  locations,
  action,
}: WeeklyPlannerProps) {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [selectedDays, setSelectedDays] = React.useState<Set<string>>(
    () => new Set(DAYS_OF_WEEK)
  );
  const [selectedTemplates, setSelectedTemplates] = React.useState<
    Set<string>
  >(() => new Set());
  const [attempted, setAttempted] = React.useState(false);

  const templateGroups = React.useMemo(
    () => groupTemplatesByLocation(templates, locations),
    [templates, locations]
  );

  const today = startOfDay(new Date());

  const matchingDays = React.useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    return eachDayOfInterval({
      start: dateRange.from,
      end: dateRange.to,
    }).filter((day) => selectedDays.has(DAY_NAME_BY_INDEX[getDay(day)]));
  }, [dateRange, selectedDays]);

  const serviceDays = matchingDays.filter(
    (day) => !isBefore(day, today)
  );
  const pastDaysExcluded = matchingDays.length - serviceDays.length;
  const includesToday = serviceDays.some((day) => isSameDay(day, today));

  const chosenTemplates = templates.filter((t) =>
    selectedTemplates.has(t.name)
  );
  const shiftCount = serviceDays.length * chosenTemplates.length;
  const placesTotal =
    serviceDays.length *
    chosenTemplates.reduce((sum, t) => sum + t.capacity, 0);

  const warnings: string[] = [];
  if (!dateRange?.from || !dateRange?.to) {
    warnings.push("Pick a date range");
  }
  if (selectedDays.size === 0) {
    warnings.push("Choose at least one day of the week");
  }
  if (selectedTemplates.size === 0) {
    warnings.push("Select at least one template");
  }
  if (
    warnings.length === 0 &&
    serviceDays.length === 0 &&
    matchingDays.length === 0
  ) {
    warnings.push("No selected weekdays fall inside this date range");
  }
  if (warnings.length === 0 && serviceDays.length === 0 && pastDaysExcluded > 0) {
    warnings.push("Every matching day in this range is in the past");
  }

  const lines: RunSheetLine[] = [];
  if (dateRange?.from && dateRange?.to) {
    lines.push({
      label: "Dates",
      value: `${format(dateRange.from, "d MMM")} - ${format(
        dateRange.to,
        "d MMM"
      )}`,
      emphasis: true,
    });
    lines.push({
      label: "Service days",
      value: String(serviceDays.length),
    });
  }
  for (const [location, group] of templateGroups) {
    const selectedInLocation = group.filter((t) =>
      selectedTemplates.has(t.name)
    ).length;
    if (selectedInLocation > 0) {
      lines.push({
        label: location,
        value: `${selectedInLocation} role${
          selectedInLocation === 1 ? "" : "s"
        }`,
      });
    }
  }

  let note: string | undefined;
  if (pastDaysExcluded > 0 && serviceDays.length > 0) {
    note = "Days before today are skipped.";
  } else if (includesToday) {
    note = "Shifts today that would start before now are skipped.";
  }

  const toggleDay = (day: string, checked: boolean) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (checked) next.add(day);
      else next.delete(day);
      return next;
    });
  };

  const toggleTemplate = (name: string, checked: boolean) => {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (checked) next.add(name);
      else next.delete(name);
      return next;
    });
  };

  const toggleLocation = (group: TemplateOption[], selectAll: boolean) => {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      for (const template of group) {
        if (selectAll) next.add(template.name);
        else next.delete(template.name);
      }
      return next;
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (warnings.length > 0 || shiftCount === 0) {
      event.preventDefault();
      setAttempted(true);
    }
  };

  return (
    <form
      action={action}
      onSubmit={handleSubmit}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start"
    >
      <div className="space-y-6">
        <PlannerSection
          step="Step 1"
          title="When"
          description="Shifts are created for every selected weekday inside the date range."
        >
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date range *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-11 w-full justify-start rounded-xl text-left font-normal sm:max-w-sm",
                      !dateRange?.from && "text-muted-foreground"
                    )}
                    data-testid="bulk-date-range-input"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "EEE d MMM yyyy")}
                          {"  -  "}
                          {format(dateRange.to, "EEE d MMM yyyy")}
                        </>
                      ) : (
                        format(dateRange.from, "EEE d MMM yyyy")
                      )
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
                    disabled={{ before: new Date() }}
                  />
                </PopoverContent>
              </Popover>
              <input
                type="hidden"
                name="startDate"
                value={
                  dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""
                }
              />
              <input
                type="hidden"
                name="endDate"
                value={dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : ""}
              />
            </div>

            <fieldset>
              <legend className="text-sm font-medium">Days of the week</legend>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <label key={day} className="relative">
                    <input
                      type="checkbox"
                      name={`day_${day}`}
                      checked={selectedDays.has(day)}
                      onChange={(e) => toggleDay(day, e.target.checked)}
                      aria-label={day}
                      data-testid={`day-${day.toLowerCase()}-checkbox`}
                      className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-11 min-w-[3.25rem] items-center justify-center rounded-full border px-3.5 text-sm font-medium transition-colors",
                        "border-border bg-transparent text-muted-foreground",
                        "peer-checked:border-forest-500 peer-checked:bg-forest-500 peer-checked:text-cream-50",
                        "peer-hover:border-forest-300 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
                      )}
                    >
                      {day.slice(0, 3)}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </PlannerSection>

        <PlannerSection
          step="Step 2"
          title="Which shifts"
          description="Each template creates one shift per service day, with its usual time, capacity, and location."
        >
          <div className="space-y-7">
            {templateGroups.map(([location, group]) => {
              const selectedInLocation = group.filter((t) =>
                selectedTemplates.has(t.name)
              ).length;
              const allSelected = selectedInLocation === group.length;
              return (
                <div key={location}>
                  <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h4 className="text-base text-foreground">{location}</h4>
                    <div className="flex items-baseline gap-3">
                      <span
                        className="text-xs text-muted-foreground tabular-nums"
                        aria-live="polite"
                      >
                        {selectedInLocation} of {group.length} selected
                      </span>
                      <button
                        type="button"
                        className="cursor-pointer text-xs font-semibold text-forest-400 underline-offset-2 hover:underline dark:text-forest-200"
                        onClick={() => toggleLocation(group, !allSelected)}
                      >
                        {allSelected ? "Clear all" : "Select all"}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 xl:grid-cols-2">
                    {group.map((template) => {
                      const displayName = templateDisplayName(
                        template.name,
                        location
                      );
                      return (
                        <label
                          key={template.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                            "border-border bg-card hover:border-forest-300",
                            "has-checked:border-forest-500 has-checked:bg-forest-500/5 dark:has-checked:bg-forest-500/15"
                          )}
                        >
                          <input
                            type="checkbox"
                            name={`template_${template.name}`}
                            checked={selectedTemplates.has(template.name)}
                            onChange={(e) =>
                              toggleTemplate(template.name, e.target.checked)
                            }
                            data-testid={templateTestId(template.name)}
                            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-forest-500"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-semibold text-foreground">
                                {displayName}
                              </span>
                              <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                                {template.startTime} - {template.endTime}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {template.capacity} place
                              {template.capacity === 1 ? "" : "s"}
                              {template.shiftTypeName !== displayName &&
                                ` · ${template.shiftTypeName}`}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {templateGroups.length === 0 && (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No templates yet. Create some in the Templates & Roles tab
                first - the weekly schedule is built from them.
              </p>
            )}
          </div>
        </PlannerSection>
      </div>

      <RunSheet
        count={shiftCount}
        places={placesTotal}
        lines={lines}
        warnings={warnings}
        attempted={attempted}
        note={note}
      >
        <SubmitButton count={shiftCount} />
      </RunSheet>
    </form>
  );
}
