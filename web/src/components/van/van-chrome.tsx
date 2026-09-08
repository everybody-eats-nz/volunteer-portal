"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** 44px minimum touch target, for a phone held one-handed. */
const BACK_CONTROL =
  "-ml-2 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 active:bg-primary/15";

/**
 * Chrome shared by every driver screen.
 *
 * The driver flow is deliberately its own visual world inside the portal: a
 * single-column, thumb-reachable phone layout, because it is used one-handed in
 * a loading bay rather than at a desk. It stays on the portal's brand tokens
 * (forest / cream / sun, Fraunces headings) so it never reads as a different
 * product, and it carries dark mode, which the design prototype did not.
 */

export function DriverScreen({
  children,
  className,
  testid,
}: {
  children: React.ReactNode;
  className?: string;
  testid?: string;
}) {
  return (
    <div
      data-testid={testid}
      className={cn(
        // dvh, not vh: mobile browser chrome makes vh lie. The offset leaves
        // room for the site header this sits under.
        "mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-md flex-col px-4 pt-2",
        "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FlowHeader({
  onBack,
  backHref,
  title,
  sub,
  step,
  stepCount,
}: {
  onBack?: () => void;
  backHref?: string;
  /** Omitted on screens that already name the van in the body. */
  title?: string;
  sub?: string;
  step?: number;
  stepCount?: number;
}) {
  const showProgress = step != null && stepCount != null;
  return (
    <div className="sticky top-0 z-20 -mx-4 bg-background/90 px-4 pb-2 pt-3 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        {/* A back control has to actually go somewhere. `onBack` drives the
            in-flow steps; `backHref` is for screens whose back is a plain
            navigation, and it renders a real link so it works with a
            long-press, a middle click, and assistive tech. */}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            data-testid="van-flow-back"
            className={BACK_CONTROL}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        ) : backHref ? (
          <Link
            href={backHref}
            aria-label="Back"
            data-testid="van-flow-back"
            className={BACK_CONTROL}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
        ) : (
          <span className="size-11 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          {title && (
            <p className="truncate text-sm font-semibold leading-tight">
              {title}
            </p>
          )}
          {sub && (
            <p className="truncate text-xs tabular-nums text-muted-foreground">
              {sub}
            </p>
          )}
        </div>
        {showProgress && (
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {step} of {stepCount}
          </span>
        )}
      </div>
      {showProgress && (
        <div className="mt-2 flex gap-1" aria-hidden>
          {Array.from({ length: stepCount }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i < step ? "bg-primary dark:bg-forest-300" : "bg-primary/15"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type PillTone = "out" | "available" | "warn" | "danger" | "neutral" | "accent";

const PILL_TONES: Record<PillTone, string> = {
  available:
    "bg-forest-50 text-forest-600 ring-forest-500/20 dark:bg-forest-500/15 dark:text-forest-200 dark:ring-forest-300/25",
  out: "bg-amber-50 text-amber-700 ring-amber-500/25 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-300/25",
  warn: "bg-amber-50 text-amber-700 ring-amber-500/25 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-300/25",
  danger:
    "bg-red-50 text-red-700 ring-red-500/25 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-300/25",
  neutral: "bg-muted text-muted-foreground ring-border",
  accent:
    "bg-sun-200 text-forest-700 ring-sun-300/60 dark:bg-sun-200 dark:text-forest-700",
};

/**
 * Status never rests on colour alone: the dot is paired with a word, so it
 * still reads for a colour-blind driver and in bright sun.
 */
export function StatusPill({
  tone,
  dot,
  children,
  className,
}: {
  tone: PillTone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        PILL_TONES[tone],
        className
      )}
    >
      {dot && (
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
      )}
      {children}
    </span>
  );
}

/** A two-up label/value grid. Tabular figures so odometer readings line up. */
export function CellGrid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border">
      {children}
    </dl>
  );
}

export function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-[15px] font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}
