import type { ReactNode } from "react";

import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Building blocks for admin route `loading.tsx` skeletons.
 *
 * Every admin route has its own `loading.tsx` so the header shows the right
 * title while the page streams in, and the skeleton mirrors the real layout
 * (same card radii, paddings and grid breakpoints) so nothing jumps when the
 * content arrives. Compose these primitives rather than hand-rolling divs.
 */

interface AdminPageSkeletonProps {
  /** Must match the real page's `AdminPageWrapper` title. */
  title: string;
  description?: string;
  /** Disabled copies of the real page's header actions. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Page shell: sets the admin header and marks the region as loading. */
export function AdminPageSkeleton({
  title,
  description,
  actions,
  className,
  children,
}: AdminPageSkeletonProps) {
  return (
    <AdminPageWrapper title={title} description={description} actions={actions}>
      <div
        data-testid="admin-page-skeleton"
        aria-busy="true"
        className={cn("space-y-6", className)}
      >
        <span className="sr-only" role="status">
          Loading {title}
        </span>
        {children}
      </div>
    </AdminPageWrapper>
  );
}

/** Same surface as `<Card>` (rounded-sm, border, shadow-sm). */
export function SkeletonCard({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-card rounded-sm border shadow-sm", className)}
    >
      {children}
    </div>
  );
}

/** Card title + optional description, matching `CardHeader` spacing. */
export function SkeletonCardHeader({
  titleWidth = "w-40",
  description = true,
  action,
  className,
}: {
  titleWidth?: string;
  description?: boolean;
  /** Width class of a right-aligned action button, if the card has one. */
  action?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-6", className)}>
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className={cn("h-5", titleWidth)} />
        {description && <Skeleton className="h-4 w-64 max-w-full" />}
      </div>
      {action && <Skeleton className={cn("h-9 shrink-0", action)} />}
    </div>
  );
}

/** Row of KPI tiles: label, big number, caption. */
export function StatCardsSkeleton({
  count = 4,
  className = "grid-cols-2 lg:grid-cols-4",
  caption = true,
}: {
  count?: number;
  className?: string;
  caption?: boolean;
}) {
  return (
    <div className={cn("grid gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className="space-y-3 p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-5 rounded" />
          </div>
          <Skeleton className="h-8 w-16" />
          {caption && <Skeleton className="h-3 w-28" />}
        </SkeletonCard>
      ))}
    </div>
  );
}

/** Horizontal bar of inputs/selects as used above lists and tables. */
export function FilterBarSkeleton({
  fields = ["w-full sm:w-72", "w-40"],
  labels = false,
  button,
  card = false,
  className,
}: {
  /** Width classes for each control, left to right. */
  fields?: string[];
  /** Render a small label above each control. */
  labels?: boolean;
  /** Width class of a trailing button (e.g. "w-28"). */
  button?: string;
  /** Wrap the bar in a card surface. */
  card?: boolean;
  className?: string;
}) {
  const bar = (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end",
        className
      )}
    >
      {fields.map((width, i) => (
        <div key={i} className={cn("space-y-2", width)}>
          {labels && <Skeleton className="h-3.5 w-20" />}
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      {button && <Skeleton className={cn("h-9 sm:ml-auto", button)} />}
    </div>
  );
  return card ? <SkeletonCard className="p-4">{bar}</SkeletonCard> : bar;
}

/** Segmented tab strip (shadcn `TabsList`). */
export function TabsSkeleton({
  tabs = ["w-20", "w-24", "w-20"],
  className,
}: {
  tabs?: string[];
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        // max-w-full + overflow-hidden mirrors ScrollableTabsList on phones
        "bg-muted/60 inline-flex h-9 max-w-full items-center gap-1 overflow-hidden rounded-lg p-[3px]",
        className
      )}
    >
      {tabs.map((width, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-full shrink-0 rounded-md",
            i === 0 ? "bg-background shadow-sm" : "bg-transparent",
            width
          )}
        />
      ))}
    </div>
  );
}

/** Data table inside a card: header row plus body rows. */
export function TableSkeleton({
  rows = 8,
  columns = ["w-40", "w-24", "w-20", "w-16"],
  avatar = false,
  actions = false,
  card = true,
  header,
  headerClassName,
  rowClassName,
  className,
}: {
  rows?: number;
  /** Width class of each column's cell content, left to right. */
  columns?: string[];
  /** Leading avatar circle in the first column. */
  avatar?: boolean;
  /** Trailing row-action button. */
  actions?: boolean;
  card?: boolean;
  /** Optional content above the table (e.g. a SkeletonCardHeader). */
  header?: ReactNode;
  /** Overrides for the header row (e.g. a taller `h-11`). */
  headerClassName?: string;
  /** Overrides for body rows, to match a real table's row height. */
  rowClassName?: string;
  className?: string;
}) {
  const table = (
    <div className="w-full overflow-hidden">
      <div className={cn("flex h-10 items-center gap-6 border-b px-4", headerClassName)}>
        {columns.map((width, i) =>
          i === 0 ? (
            <div key={i} className="flex-1">
              <Skeleton className="h-3.5 w-20" />
            </div>
          ) : (
            <div key={i} className={cn("hidden shrink-0 md:block", width)}>
              <Skeleton className="h-3.5 w-14" />
            </div>
          )
        )}
        {actions && <span className="w-8" />}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className={cn(
            "flex min-h-14 items-center gap-6 border-b px-4 py-3 last:border-0",
            rowClassName
          )}
        >
          {columns.map((width, c) =>
            c === 0 ? (
              <div key={c} className="flex min-w-0 flex-1 items-center gap-3">
                {avatar && <Skeleton className="size-8 shrink-0 rounded-full" />}
                <div className="min-w-0 space-y-1.5">
                  <Skeleton className={cn("h-4", width)} />
                  {avatar && <Skeleton className="h-3 w-32" />}
                </div>
              </div>
            ) : (
              <Skeleton
                key={c}
                className={cn("hidden h-4 shrink-0 md:block", width)}
              />
            )
          )}
          {actions && <Skeleton className="size-8 shrink-0" />}
        </div>
      ))}
    </div>
  );

  if (!card) return <div className={className}>{table}</div>;
  return (
    <SkeletonCard className={cn("overflow-hidden", header && "pt-6", className)}>
      {header && <div className="pb-4">{header}</div>}
      {table}
    </SkeletonCard>
  );
}

/** Card holding a chart: header plus a plot area with faint bars. */
export function ChartCardSkeleton({
  height = 300,
  description = true,
  className,
}: {
  height?: number;
  description?: boolean;
  className?: string;
}) {
  // Fixed pseudo-random heights so server and client render identically.
  const bars = [45, 70, 55, 85, 60, 75, 40, 65, 90, 50, 72, 58];
  return (
    <SkeletonCard className={cn("space-y-6 py-6", className)}>
      <SkeletonCardHeader description={description} />
      <div className="px-6">
        <div className="flex items-end gap-2 border-b border-l pl-2" style={{ height }}>
          {bars.map((h, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-b-none bg-muted/70"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </SkeletonCard>
  );
}

/** Stacked label + input pairs inside a card. */
export function FormCardSkeleton({
  fields = 4,
  title = true,
  footer = true,
  className,
}: {
  fields?: number;
  title?: boolean;
  /** Trailing submit button. */
  footer?: boolean;
  className?: string;
}) {
  return (
    <SkeletonCard className={cn("space-y-6 py-6", className)}>
      {title && <SkeletonCardHeader />}
      <div className="space-y-5 px-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      {footer && (
        <div className="flex justify-end px-6">
          <Skeleton className="h-9 w-28" />
        </div>
      )}
    </SkeletonCard>
  );
}

/** Card with a list of rows (icon/avatar, two text lines, trailing badge). */
export function ListCardSkeleton({
  rows = 5,
  avatar = true,
  trailing = "w-16",
  header = true,
  className,
}: {
  rows?: number;
  avatar?: boolean;
  /** Width class of a trailing badge/button, or false for none. */
  trailing?: string | false;
  header?: boolean;
  className?: string;
}) {
  return (
    <SkeletonCard className={cn("space-y-4 py-6", className)}>
      {header && <SkeletonCardHeader description={false} />}
      <div className="divide-y px-6">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            {avatar && <Skeleton className="size-9 shrink-0 rounded-full" />}
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3 w-32 max-w-full" />
            </div>
            {trailing && <Skeleton className={cn("h-6 shrink-0 rounded-full", trailing)} />}
          </div>
        ))}
      </div>
    </SkeletonCard>
  );
}
