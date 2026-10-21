import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { STATUS_ICON } from "@/lib/status-styles";

/**
 * Brand-derived tones. `forest` and `sun` are the everyday accents; `pending`
 * and `danger` come from the shared status map and are reserved for numbers
 * that ask an admin to act (a backlog, a coverage gap).
 */
export type KpiTone = "forest" | "sun" | "pending" | "danger" | "neutral";

const TONE_STYLES: Record<KpiTone, { iconWrap: string; value: string }> = {
  forest: {
    iconWrap: "bg-primary-light text-primary-text",
    value: "text-primary-text",
  },
  sun: {
    iconWrap:
      "bg-sun-200/60 text-forest-700 dark:bg-sun-200/15 dark:text-sun-200",
    value: "text-foreground",
  },
  pending: {
    iconWrap: cn("bg-amber-400/15", STATUS_ICON.pending),
    value: STATUS_ICON.pending,
  },
  danger: {
    iconWrap: cn("bg-red-500/10", STATUS_ICON.danger),
    value: STATUS_ICON.danger,
  },
  neutral: {
    iconWrap: "bg-stone-100 text-stone-600 dark:bg-white/10 dark:text-stone-300",
    value: "text-foreground",
  },
};

/**
 * The admin headline-number tile: label, tinted icon chip, Fraunces value and
 * an optional hint line. Every admin overview row (dashboard, moderation,
 * locations, labels, coverage) uses this so the numbers read as one system.
 */
export function KpiTile({
  icon,
  label,
  value,
  suffix,
  hint,
  badge,
  tone,
  href,
  className,
  "data-testid": testId,
  valueTestId = "kpi-tile-value",
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  /** Muted text after the value, e.g. "/ 4". */
  suffix?: string;
  /** A short line under the value, e.g. "12 admins, 200 total". */
  hint?: ReactNode;
  /** A status chip shown beside the label, e.g. "3 pending". */
  badge?: ReactNode;
  tone: KpiTone;
  /** Makes the whole tile a link to the page behind the number. */
  href?: string;
  className?: string;
  "data-testid"?: string;
  valueTestId?: string;
}) {
  const styles = TONE_STYLES[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-muted-foreground">
          {label}
          {badge}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4",
            styles.iconWrap
          )}
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          data-testid={valueTestId}
          className={cn(
            "font-accent text-3xl font-semibold tabular-nums leading-none",
            styles.value
          )}
        >
          {typeof value === "number" ? value.toLocaleString("en-NZ") : value}
        </span>
        {suffix && (
          <span className="text-sm font-medium text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
    </>
  );

  const tileClass = cn(
    "block h-full rounded-xl border bg-card p-4 shadow-sm",
    href &&
      "transition-colors hover:border-primary/40 hover:bg-primary-light/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    className
  );

  // No entrance animation: these numbers are above the fold, and a fade-in
  // would ship them invisible in the server HTML.
  return href ? (
    <Link href={href} className={tileClass} data-testid={testId}>
      {body}
    </Link>
  ) : (
    <div className={tileClass} data-testid={testId}>
      {body}
    </div>
  );
}
