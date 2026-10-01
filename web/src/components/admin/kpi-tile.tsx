"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

export type KpiTone =
  | "forest"
  | "blue"
  | "violet"
  | "amber"
  | "rose"
  | "sun"
  | "neutral";

const TONE_STYLES: Record<KpiTone, { iconWrap: string; value: string }> = {
  forest: {
    iconWrap: "bg-primary-light text-primary-text",
    value: "text-primary-text",
  },
  blue: {
    iconWrap: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    value: "text-blue-700 dark:text-blue-200",
  },
  violet: {
    iconWrap: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    value: "text-violet-700 dark:text-violet-200",
  },
  amber: {
    iconWrap: "bg-amber-400/15 text-amber-600 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-400",
  },
  rose: {
    iconWrap: "bg-destructive/12 text-destructive",
    value: "text-destructive",
  },
  sun: {
    iconWrap:
      "bg-sun-200/60 text-forest-700 dark:bg-sun-200/15 dark:text-sun-200",
    value: "text-foreground",
  },
  neutral: {
    iconWrap: "bg-muted text-muted-foreground",
    value: "text-foreground",
  },
};

/**
 * Headline number tile used across admin overview rows (locations, restaurant
 * managers, custom labels): uppercase label, tinted icon chip, Fraunces value.
 */
export function KpiTile({
  icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  /** Muted text after the value, e.g. "/ 4". */
  suffix?: string;
  tone: KpiTone;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            styles.iconWrap
          )}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span
          className={cn(
            "font-accent text-3xl font-semibold tabular-nums leading-none",
            styles.value
          )}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-sm font-medium text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </motion.div>
  );
}
