"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { budgetYearLabel } from "@/lib/budget-calculations";
import {
  formatDayRange,
  MAX_CUSTOM_RANGE_DAYS,
  resolveBudgetPeriod,
  switchBudgetPeriod,
  type BudgetPeriod,
  type BudgetPeriodKind,
} from "@/lib/budget-periods";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedControl } from "../_components/primitives";

const KIND_OPTIONS: { value: BudgetPeriodKind; label: string }[] = [
  { value: "year", label: "Year" },
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "custom", label: "Custom" },
];

/** What the second control is called for each kind of period. */
export const PERIOD_CONTROL_LABEL: Record<BudgetPeriodKind, string> = {
  year: "Financial year",
  month: "Month",
  week: "Week",
  custom: "Dates",
};

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// The restaurant has operated since 2017; allow planning a year ahead.
const FIRST_YEAR = 2017;

/**
 * Years the pickers offer: 2017 to next year, widened to take in the period
 * in view so a far-off week or range can always be shown and changed.
 */
function pickerYears(period: BudgetPeriod, today: string) {
  return {
    first: Math.min(FIRST_YEAR, Number(period.start.slice(0, 4))),
    last: Math.max(Number(today.slice(0, 4)) + 1, Number(period.end.slice(0, 4))),
  };
}

function calendarBounds(period: BudgetPeriod, today: string) {
  const { first, last } = pickerYears(period, today);
  return { startMonth: new Date(first, 0, 1), endMonth: new Date(last, 11, 31) };
}

/** yyyy-MM-dd ↔ a local Date at midnight, for the calendar. */
function toDate(day: string): Date {
  return new Date(`${day}T00:00:00`);
}
function toDay(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function PeriodKindControl({
  period,
  today,
  onChange,
}: {
  period: BudgetPeriod;
  today: string;
  onChange: (period: BudgetPeriod) => void;
}) {
  return (
    <div data-testid="budget-period-kind">
      <SegmentedControl
        size="lg"
        value={period.kind}
        onChange={(kind) => onChange(switchBudgetPeriod(period, kind, today))}
        options={KIND_OPTIONS}
      />
    </div>
  );
}

/** The control for the chosen kind: a year list, a stepper or a date range. */
export function PeriodValueControl({
  id,
  period,
  years,
  today,
  onChange,
}: {
  id: string;
  period: BudgetPeriod;
  years: number[];
  today: string;
  onChange: (period: BudgetPeriod) => void;
}) {
  switch (period.kind) {
    case "year":
      return (
        <Select
          value={String(period.year)}
          onValueChange={(v) =>
            onChange(resolveBudgetPeriod({ year: v }, today))
          }
        >
          <SelectTrigger
            id={id}
            className="w-full"
            data-testid="budget-year-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {budgetYearLabel(y)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "month":
    case "week":
      return (
        <PeriodStepper id={id} period={period} today={today} onChange={onChange} />
      );
    case "custom":
      return (
        <CustomRange id={id} period={period} today={today} onChange={onChange} />
      );
  }
}

function PeriodStepper({
  id,
  period,
  today,
  onChange,
}: {
  id: string;
  period: BudgetPeriod;
  today: string;
  onChange: (period: BudgetPeriod) => void;
}) {
  const [open, setOpen] = useState(false);
  const unit = period.kind === "month" ? "month" : "week";
  const go = (date: string | null) => {
    if (date) onChange(resolveBudgetPeriod({ period: period.kind, date }, today));
  };
  const pick = (date: string) => {
    setOpen(false);
    go(date);
  };
  const isCurrent = period.timing === "current";

  return (
    <div className="flex w-full items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="size-11 shrink-0"
        onClick={() => go(period.prev)}
        aria-label={`Previous ${unit}`}
        data-testid="budget-period-prev"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className="h-11 min-w-0 flex-1 justify-center gap-2 font-medium tabular-nums"
            aria-label={`Choose a ${unit}, showing ${period.label}`}
            data-testid="budget-period-label"
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{period.label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          {period.kind === "month" ? (
            <MonthGrid period={period} today={today} onPick={pick} />
          ) : (
            <Calendar
              mode="range"
              captionLayout="dropdown"
              {...calendarBounds(period, today)}
              defaultMonth={toDate(period.start)}
              weekStartsOn={0}
              selected={{ from: toDate(period.start), to: toDate(period.end) }}
              // Any day picks the Sunday-Saturday week around it.
              onSelect={(_range, day) => pick(toDay(day))}
              autoFocus
            />
          )}
          {!isCurrent && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => pick(today)}
              >
                Go to this {unit}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      <Button
        variant="outline"
        size="icon"
        className="size-11 shrink-0"
        onClick={() => go(period.next)}
        aria-label={`Next ${unit}`}
        data-testid="budget-period-next"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** Twelve months on a page, with the year stepped above them. */
function MonthGrid({
  period,
  today,
  onPick,
}: {
  period: BudgetPeriod;
  today: string;
  onPick: (date: string) => void;
}) {
  const [year, setYear] = useState(Number(period.start.slice(0, 4)));
  const selected = period.start.slice(0, 7);
  const thisMonth = today.slice(0, 7);
  const { first: minYear, last: maxYear } = pickerYears(period, today);

  return (
    <div className="w-64 p-3" data-testid="budget-month-grid">
      <div className="mb-2 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setYear((y) => y - 1)}
          disabled={year <= minYear}
          aria-label="Previous year"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold tabular-nums">{year}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setYear((y) => y + 1)}
          disabled={year >= maxYear}
          aria-label="Next year"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MONTHS_SHORT.map((name, i) => {
          const key = `${year}-${String(i + 1).padStart(2, "0")}`;
          const isSelected = key === selected;
          return (
            <Button
              key={key}
              variant={isSelected ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-9",
                !isSelected && key === thisMonth && "ring-1 ring-inset ring-border"
              )}
              aria-pressed={isSelected}
              onClick={() => onPick(`${key}-01`)}
            >
              {name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function CustomRange({
  id,
  period,
  today,
  onChange,
}: {
  id: string;
  period: BudgetPeriod;
  today: string;
  onChange: (period: BudgetPeriod) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from?: Date; to?: Date }>({});
  const complete = draft.from && draft.to;

  const openChange = (next: boolean) => {
    // Every open starts from the dates in view.
    if (next) setDraft({ from: toDate(period.start), to: toDate(period.end) });
    setOpen(next);
  };
  const apply = () => {
    if (!draft.from || !draft.to) return;
    setOpen(false);
    onChange(
      resolveBudgetPeriod(
        { period: "custom", from: toDay(draft.from), to: toDay(draft.to) },
        today
      )
    );
  };

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          className="h-11 w-full justify-start gap-2 font-medium tabular-nums"
          data-testid="budget-custom-range"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{period.label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          captionLayout="dropdown"
          {...calendarBounds(period, today)}
          defaultMonth={draft.from}
          weekStartsOn={0}
          selected={{ from: draft.from, to: draft.to }}
          // The dates in view show first; the next click starts a new range.
          resetOnSelect
          // The same three-year cap the page enforces on a typed-in URL.
          max={MAX_CUSTOM_RANGE_DAYS - 1}
          onSelect={(range) => setDraft({ from: range?.from, to: range?.to })}
          numberOfMonths={2}
          autoFocus
        />
        <div className="flex items-center justify-between gap-3 border-t p-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            {complete
              ? formatDayRange(toDay(draft.from!), toDay(draft.to!))
              : draft.from
                ? "Now pick the last day"
                : "Pick the first day"}
          </p>
          <Button
            size="sm"
            onClick={apply}
            disabled={!complete}
            data-testid="budget-custom-apply"
          >
            Show these dates
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
