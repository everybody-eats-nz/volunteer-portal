"use client";

import { Component, type ComponentProps, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Info,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChartTokens } from "../_lib/chart-theme";
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

const LazyApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  // Fills the wrapper below, which reserves the chart's own height.
  loading: () => (
    <div className="min-h-[inherit] w-full animate-pulse rounded-lg bg-muted/40" />
  ),
});

/**
 * Single dynamic ApexCharts import reused by every chart. The wrapper reserves
 * the chart's height so the placeholder matches it (a 40px sparkline must not
 * flash a 300px block) and nothing jumps when the chunk arrives. Each chart is
 * isolated in its own error boundary, so one bad chart shows an error state in
 * its own frame instead of blanking the page.
 */
export function ApexChart(props: ComponentProps<typeof LazyApexChart>) {
  const { height = 300 } = props;
  const minHeight = typeof height === "number" ? height : undefined;
  return (
    <div style={{ minHeight: height }}>
      <ChartErrorBoundary height={minHeight} compact={(minHeight ?? 300) < 120}>
        <LazyApexChart {...props} />
      </ChartErrorBoundary>
    </div>
  );
}

/**
 * Isolates a single chart/section so a render error in one ApexCharts instance
 * (bad data, misconfig) degrades to a message with a retry instead of taking
 * down the whole dashboard.
 */
export class ChartErrorBoundary extends Component<
  { children: ReactNode; height?: number; compact?: boolean },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Chart failed to render:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.compact) {
      return (
        <div
          role="alert"
          className="flex h-full items-center text-xs text-muted-foreground"
          style={{ minHeight: this.props.height }}
        >
          Chart unavailable
        </div>
      );
    }
    return (
      <div
        role="alert"
        data-testid="chart-error"
        className="flex flex-col items-center justify-center gap-2 px-4 text-center"
        style={{ height: this.props.height ?? 260 }}
      >
        <AlertTriangle className="h-5 w-5 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">This chart couldn&rsquo;t be drawn</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          The rest of the page is unaffected. Try drawing it again, or reload
          the page if it keeps failing.
        </p>
        <button
          type="button"
          onClick={() => this.setState({ hasError: false })}
          className="mt-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Try again
        </button>
      </div>
    );
  }
}

/**
 * Small area sparkline for KPI cards. Decorative: the card's number carries the
 * value, so it has no tooltip and no animation.
 */
export function Sparkline({
  data,
  color,
  tokens,
}: {
  data: number[];
  color: string;
  tokens: ChartTokens;
}) {
  if (!data.some((v) => v > 0)) return <div className="h-10" />;
  return (
    <div aria-hidden>
      <ApexChart
        type="area"
        height={40}
        options={{
          chart: {
            sparkline: { enabled: true },
            animations: { enabled: false },
            background: "transparent",
          },
          colors: [color],
          stroke: { curve: "smooth", width: 2 },
          fill: {
            type: "gradient",
            gradient: { opacityFrom: 0.4, opacityTo: 0.02, stops: [0, 100] },
          },
          tooltip: { enabled: false },
          theme: { mode: tokens.mode },
        }}
        series={[{ data }]}
      />
    </div>
  );
}

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
          <ChartIcon icon={Icon} accent={accent} />
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
      <div className={cn("flex-1 px-2 pb-3", bodyClassName)}>
        <ChartErrorBoundary>{children}</ChartErrorBoundary>
      </div>
    </section>
  );
}

/**
 * The tinted icon chip that leads every chart card title. Shared so cards
 * built on shadcn `Card` (coverage, engagement, milestones) read the same as
 * `ChartCard`.
 */
export function ChartIcon({
  icon: Icon,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind text-* colour class for the icon, e.g. "text-emerald-500" */
  accent: string;
}) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60",
        accent
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
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
          "inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground",
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
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
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

/**
 * Empty state for a chart with nothing to plot. Takes the chart's height so
 * the card doesn't collapse, and never draws an empty axis frame.
 */
export function ChartEmpty({
  message,
  hint,
  height = 300,
}: {
  message: string;
  /** What the admin can do about it, e.g. widen the time period. */
  hint?: string;
  height?: number;
}) {
  return (
    <div
      data-testid="chart-empty"
      className="flex flex-col items-center justify-center gap-1.5 px-4 text-center"
      style={{ height }}
    >
      <BarChart3 className="h-5 w-5 text-muted-foreground/70" aria-hidden />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      {hint && (
        <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>
      )}
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
              "whitespace-nowrap rounded-md font-medium transition-colors",
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
