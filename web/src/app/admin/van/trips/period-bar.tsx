"use client";

import { ChevronLeft, ChevronRight, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { monthLabel, shiftMonth, type Period } from "@/lib/van/period";

/**
 * The reporting period.
 *
 * The funder asks for a month, so a month is the default unit and stepping
 * between months is one control rather than two date fields somebody has to
 * remember the last day of. The range and all-time modes stay for the questions
 * a month cannot answer.
 */

const FIELD =
  "h-9 rounded-lg border border-input bg-background px-2.5 text-[13px] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function PeriodBar({
  period,
  onChange,
  months,
  onExport,
  exportDisabled,
}: {
  period: Period;
  onChange: (period: Period) => void;
  /** Every month the record covers, newest first. */
  months: string[];
  onExport: () => void;
  exportDisabled: boolean;
}) {
  const oldest = months[months.length - 1];
  const newest = months[0];

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
      data-testid="van-trips-period"
    >
      <div className="flex flex-wrap items-center gap-2">
        {period.mode === "month" && (
          <div className="flex items-center gap-1">
            <StepButton
              direction="previous"
              disabled={!oldest || period.month <= oldest}
              onClick={() => onChange({ mode: "month", month: shiftMonth(period.month, -1) })}
            />
            {/* The heading and the picker are the same control: the month is
                both what you are looking at and how you move. */}
            <div className="relative">
              <select
                aria-label="Month"
                value={period.month}
                onChange={(e) => onChange({ mode: "month", month: e.target.value })}
                data-testid="van-trips-month"
                className="font-accent w-[13rem] appearance-none rounded-lg bg-transparent py-1 pl-2 pr-7 text-xl font-semibold outline-none transition-colors hover:bg-primary/5 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {months.map((month) => (
                  <option key={month} value={month}>
                    {monthLabel(month)}
                  </option>
                ))}
              </select>
              <ChevronRight
                className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 rotate-90 text-muted-foreground"
                aria-hidden
              />
            </div>
            <StepButton
              direction="next"
              disabled={!newest || period.month >= newest}
              onClick={() => onChange({ mode: "month", month: shiftMonth(period.month, 1) })}
            />
          </div>
        )}

        {period.mode === "range" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="date"
              aria-label="From date"
              className={FIELD}
              value={period.from}
              onChange={(e) => onChange({ ...period, from: e.target.value })}
            />
            <span className="text-[13px] text-muted-foreground">to</span>
            <input
              type="date"
              aria-label="To date"
              className={FIELD}
              value={period.to}
              onChange={(e) => onChange({ ...period, to: e.target.value })}
            />
          </div>
        )}

        <ModeSwitch period={period} onChange={onChange} newest={newest} />
      </div>

      <Button
        variant="secondary"
        size="sm"
        onClick={onExport}
        disabled={exportDisabled}
        data-testid="van-trips-export"
      >
        <Download aria-hidden />
        Export CSV
      </Button>
    </div>
  );
}

function StepButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "previous" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${direction === "previous" ? "Previous" : "Next"} month`}
      data-testid={`van-trips-month-${direction}`}
      className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

const MODES = [
  { key: "month", label: "Month" },
  { key: "range", label: "Range" },
  { key: "all", label: "All time" },
] as const;

function ModeSwitch({
  period,
  onChange,
  newest,
}: {
  period: Period;
  onChange: (period: Period) => void;
  newest: string | undefined;
}) {
  return (
    <div className="flex gap-1 rounded-full bg-muted p-0.5">
      {MODES.map((mode) => (
        <button
          key={mode.key}
          type="button"
          aria-pressed={period.mode === mode.key}
          data-testid={`van-trips-period-${mode.key}`}
          onClick={() => {
            if (mode.key === period.mode) return;
            if (mode.key === "month") {
              onChange({ mode: "month", month: newest ?? "" });
            } else if (mode.key === "range") {
              onChange({ mode: "range", from: "", to: "" });
            } else {
              onChange({ mode: "all" });
            }
          }}
          className={cn(
            "rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
            period.mode === mode.key
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
