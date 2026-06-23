"use client";

import dynamic from "next/dynamic";
import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Single dynamic ApexCharts import reused by every card. */
export const ApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg"
      style={{ height }}
    >
      <div className="h-full w-full animate-pulse rounded-lg bg-muted/40" />
    </div>
  );
}

/**
 * The visual chassis for every chart on the dashboard. A subtle accent rail on
 * the left ties each card to its semantic colour.
 */
export function ChartCard({
  title,
  icon: Icon,
  accent,
  info,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind text-* colour class for the icon, e.g. "text-emerald-500" */
  accent: string;
  info?: { title: string; description?: string; body: React.ReactNode };
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card",
        "shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      <header className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60",
              accent
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="truncate">{title}</span>
          {info && (
            <InfoHint
              title={info.title}
              description={info.description}
              body={info.body}
            />
          )}
        </h3>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      <div className={cn("flex-1 px-2 pb-3", bodyClassName)}>{children}</div>
    </section>
  );
}

export function InfoHint({
  title,
  description,
  body,
}: {
  title: string;
  description?: string;
  body: React.ReactNode;
}) {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground/60 transition-colors hover:text-foreground"
              aria-label={`About ${title}`}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">What is this?</TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">{body}</div>
      </DialogContent>
    </Dialog>
  );
}

/** Year-over-year (or generic) delta pill. */
export function DeltaBadge({
  percent,
  base,
  suffix = "vs last year",
  className,
}: {
  percent: number;
  /** the comparison value; when 0 we can't compute a meaningful delta */
  base: number;
  suffix?: string;
  className?: string;
}) {
  if (base === 0) return null;

  if (percent === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground",
          className
        )}
      >
        <Minus className="h-3 w-3" />
        No change
      </span>
    );
  }

  const positive = percent > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        positive
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/10 text-red-600 dark:text-red-400",
        className
      )}
    >
      {positive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {positive ? "+" : ""}
      {percent}%
      <span className="font-normal opacity-70">{suffix}</span>
    </span>
  );
}

export function ChartEmpty({
  message,
  height = 300,
}: {
  message: string;
  height?: number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground"
      style={{ height }}
    >
      <span>{message}</span>
    </div>
  );
}

/** Small segmented control used for chart-level view toggles. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "sm",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-md font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
