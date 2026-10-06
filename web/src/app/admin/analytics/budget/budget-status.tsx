import { CheckCircle2, CircleAlert, CircleMinus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BudgetStatus } from "@/lib/budget-calculations";

/** One look per status, shared by pills, bars, chart points and the table. */
export const STATUS_META: Record<
  BudgetStatus,
  {
    label: string;
    short: string;
    icon: React.ComponentType<{ className?: string }>;
    /** Chart fill */
    hex: string;
    /** Solid fill for bars / dots */
    fill: string;
    pill: string;
  }
> = {
  green: {
    label: "On target",
    short: "On target",
    icon: CheckCircle2,
    hex: "#10b981",
    fill: "bg-emerald-500",
    pill: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  },
  yellow: {
    label: "Close to target",
    short: "Close",
    icon: CircleMinus,
    hex: "#eab308",
    fill: "bg-yellow-500",
    pill: "bg-yellow-400/20 text-yellow-800 dark:text-yellow-200",
  },
  red: {
    label: "Below target",
    short: "Below",
    icon: CircleAlert,
    hex: "#ef4444",
    fill: "bg-red-500",
    pill: "bg-red-500/12 text-red-700 dark:text-red-300",
  },
};

export function StatusPill({
  status,
  label,
  className,
}: {
  /** null = koha not recorded yet */
  status: BudgetStatus | null;
  label?: string;
  className?: string;
}) {
  if (status === null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground",
          className
        )}
      >
        <Clock className="h-3.5 w-3.5" />
        {label ?? "Not banked"}
      </span>
    );
  }
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold",
        meta.pill,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label ?? meta.label}
    </span>
  );
}

/**
 * Annual budget progress: the bar fills with koha banked; the notch marks
 * the pro-rata target (where the venue should be by now).
 */
export function BudgetProgressBar({
  annualRatio,
  proRataRatio,
  status,
  size = "md",
}: {
  annualRatio: number;
  proRataRatio: number;
  status: BudgetStatus | null;
  size?: "sm" | "md";
}) {
  const fill = Math.min(1, Math.max(0, annualRatio));
  const notch = Math.min(1, Math.max(0, proRataRatio));
  return (
    <div
      className={cn(
        "relative w-full rounded-full bg-muted",
        size === "md" ? "h-3" : "h-2"
      )}
      role="img"
      aria-label={`${Math.floor(annualRatio * 100)}% of the annual budget banked; pro-rata target is ${Math.floor(proRataRatio * 100)}%`}
    >
      <div
        className={cn(
          "h-full rounded-full",
          status ? STATUS_META[status].fill : "bg-muted-foreground/40"
        )}
        style={{ width: `${fill * 100}%` }}
      />
      {notch > 0 && (
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground",
            size === "md" ? "h-5" : "h-3.5"
          )}
          style={{ left: `${notch * 100}%` }}
        />
      )}
    </div>
  );
}
