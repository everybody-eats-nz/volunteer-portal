"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  CalendarCheck,
  Clock,
  Sparkles,
  Hand,
  type LucideIcon,
} from "lucide-react";
import type { SurveyTriggerType } from "@/generated/client";

/* -------------------------------------------------------------------------- */
/*  Status semantics — one source of truth for assignment-status colours       */
/* -------------------------------------------------------------------------- */

export type AssignmentStatusKey =
  | "completed"
  | "pending"
  | "dismissed"
  | "expired";

export const STATUS_META: Record<
  AssignmentStatusKey,
  {
    label: string;
    /** solid swatch used for dots and bar segments */
    swatch: string;
    /** readable text colour for counts */
    text: string;
    /** soft tinted surface */
    soft: string;
    ring: string;
  }
> = {
  completed: {
    label: "Completed",
    swatch: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    soft: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
  },
  pending: {
    label: "Pending",
    swatch: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    soft: "bg-amber-500/10",
    ring: "ring-amber-500/20",
  },
  dismissed: {
    label: "Dismissed",
    swatch: "bg-slate-400 dark:bg-slate-500",
    text: "text-slate-500 dark:text-slate-400",
    soft: "bg-slate-400/10",
    ring: "ring-slate-400/20",
  },
  expired: {
    label: "Expired",
    swatch: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    soft: "bg-rose-500/10",
    ring: "ring-rose-500/20",
  },
};

export const STATUS_ORDER: AssignmentStatusKey[] = [
  "completed",
  "pending",
  "dismissed",
  "expired",
];

/* -------------------------------------------------------------------------- */
/*  Trigger semantics                                                          */
/* -------------------------------------------------------------------------- */

export const TRIGGER_META: Record<
  SurveyTriggerType,
  { label: string; icon: LucideIcon; accent: string }
> = {
  SHIFTS_COMPLETED: {
    label: "Shifts completed",
    icon: CalendarCheck,
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  HOURS_VOLUNTEERED: {
    label: "Hours volunteered",
    icon: Clock,
    accent: "text-sky-600 dark:text-sky-400",
  },
  FIRST_SHIFT: {
    label: "First shift",
    icon: Sparkles,
    accent: "text-violet-600 dark:text-violet-400",
  },
  MANUAL: {
    label: "Manual",
    icon: Hand,
    accent: "text-slate-500 dark:text-slate-400",
  },
};

/* -------------------------------------------------------------------------- */
/*  Completion ring — the recurring motif across both pages                    */
/* -------------------------------------------------------------------------- */

export function CompletionRing({
  value,
  size = 72,
  stroke = 7,
  label,
  sublabel,
  className,
}: {
  /** 0–100 */
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - (mounted ? clamped : 0) / 100);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(clamped)}% complete`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            stroke: "var(--ee-primary-text)",
            transition:
              "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
          className="motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold tabular-nums leading-none text-foreground">
          {label ?? `${Math.round(clamped)}%`}
        </span>
        {sublabel && (
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Segmented status bar                                                        */
/* -------------------------------------------------------------------------- */

export function StatusBar({
  segments,
  className,
}: {
  segments: { key: AssignmentStatusKey; value: number }[];
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div
      className={cn(
        "flex h-2 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      {total === 0
        ? null
        : segments.map((s) =>
            s.value > 0 ? (
              <div
                key={s.key}
                className={cn(
                  STATUS_META[s.key].swatch,
                  "h-full transition-[width] duration-700 ease-out first:rounded-l-full last:rounded-r-full motion-reduce:transition-none"
                )}
                style={{ width: `${(s.value / total) * 100}%` }}
                title={`${STATUS_META[s.key].label}: ${s.value}`}
              />
            ) : null
          )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Count chip with status dot                                                  */
/* -------------------------------------------------------------------------- */

export function CountChip({
  status,
  value,
}: {
  status: AssignmentStatusKey;
  value: number;
}) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className={cn("h-2 w-2 rounded-full", meta.swatch)} />
      <span className="tabular-nums text-foreground">{value}</span>
      <span>{meta.label.toLowerCase()}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  KPI stat tile (overview strips)                                             */
/* -------------------------------------------------------------------------- */

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  accent = "text-foreground",
  iconWrap = "bg-muted/60 text-muted-foreground",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: string;
  iconWrap?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg",
            iconWrap
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="flex items-end gap-2">
        <span className={cn("text-2xl font-bold tabular-nums leading-none", accent)}>
          {value}
        </span>
      </div>
      {hint && (
        <span className="text-xs text-muted-foreground">{hint}</span>
      )}
    </div>
  );
}
