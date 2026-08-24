"use client";

import { CheckCircle2, CircleSlash, Clock, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type Outcome = "APPROVED" | "HELD" | "BLOCKED" | "ERROR";

/**
 * One colour vocabulary for outcomes, used by every surface on this page.
 * Each outcome carries an icon and a word as well as a colour - the state is
 * never communicated by colour alone.
 */
export const OUTCOME_META: Record<
  Outcome,
  {
    label: string;
    /** What actually happened to the volunteer, in their terms. */
    blurb: string;
    icon: typeof CheckCircle2;
    badge: string;
    dot: string;
    hex: string;
  }
> = {
  APPROVED: {
    label: "Approved",
    blurb: "Confirmed on the spot",
    icon: CheckCircle2,
    badge:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    dot: "bg-emerald-500",
    hex: "#10b981",
  },
  HELD: {
    label: "Held",
    blurb: "Waiting on a person",
    icon: Clock,
    badge:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    dot: "bg-amber-500",
    hex: "#f59e0b",
  },
  BLOCKED: {
    label: "Blocked",
    blurb: "Held deliberately by a block rule",
    icon: CircleSlash,
    badge:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
    dot: "bg-rose-500",
    hex: "#f43f5e",
  },
  ERROR: {
    label: "Error",
    blurb: "Evaluation failed - treated as held",
    icon: TriangleAlert,
    badge:
      "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    dot: "bg-slate-500",
    hex: "#64748b",
  },
};

export function OutcomeBadge({
  outcome,
  className,
  showIcon = true,
}: {
  outcome: Outcome;
  className?: string;
  showIcon?: boolean;
}) {
  const meta = OUTCOME_META[outcome];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        meta.badge,
        className
      )}
      data-testid={`outcome-badge-${outcome.toLowerCase()}`}
    >
      {showIcon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      {meta.label}
    </span>
  );
}
