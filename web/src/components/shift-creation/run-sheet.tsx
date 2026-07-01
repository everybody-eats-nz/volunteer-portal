"use client";

import React from "react";
import { AlertTriangleIcon, CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RunSheetLine {
  label: string;
  value: string;
  emphasis?: boolean;
}

interface RunSheetProps {
  /** Number of shifts the current selection will create */
  count: number;
  /** Noun for the count, e.g. "shift" */
  unit?: string;
  /** Approximate volunteer places across all shifts */
  places?: number;
  /** Breakdown rows shown under the count */
  lines: RunSheetLine[];
  /** Things still missing before the form can be submitted */
  warnings: string[];
  /** Escalate warnings visually after a blocked submit attempt */
  attempted?: boolean;
  /** Informational note, e.g. about past shifts being skipped */
  note?: string;
  /** Submit button (rendered inside the docket footer) */
  children: React.ReactNode;
}

/**
 * The "run sheet" docket: a sticky summary rail that tallies exactly what the
 * form will create before the admin commits. Styled after a kitchen pass
 * docket - yellow header, perforated edge, dashed dividers, tabular figures.
 */
export function RunSheet({
  count,
  unit = "shift",
  places,
  lines,
  warnings,
  attempted = false,
  note,
  children,
}: RunSheetProps) {
  const ready = warnings.length === 0 && count > 0;

  return (
    <aside
      className="lg:sticky lg:top-24"
      data-testid="run-sheet"
      aria-label="Run sheet summary"
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Docket header */}
        <div className="relative bg-sun-200 px-5 pt-4 pb-7">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-forest-700 uppercase">
            Run sheet
          </p>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span
              className={cn(
                "font-accent text-[56px] leading-none tabular-nums text-forest-800 transition-opacity",
                count === 0 && "opacity-40"
              )}
              data-testid="run-sheet-count"
            >
              {count}
            </span>
            <span className="max-w-[9rem] text-sm leading-tight font-medium text-forest-700">
              {count === 1 ? unit : `${unit}s`} will be created
            </span>
          </div>
          {/* Perforated docket edge */}
          <svg
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-2 w-full text-card"
            viewBox="0 0 120 8"
            preserveAspectRatio="none"
          >
            <path
              fill="currentColor"
              d="M0 8 L4 1 L8 8 L12 1 L16 8 L20 1 L24 8 L28 1 L32 8 L36 1 L40 8 L44 1 L48 8 L52 1 L56 8 L60 1 L64 8 L68 1 L72 8 L76 1 L80 8 L84 1 L88 8 L92 1 L96 8 L100 1 L104 8 L108 1 L112 8 L116 1 L120 8 Z"
            />
          </svg>
        </div>

        <div className="space-y-4 px-5 py-4">
          {places !== undefined && places > 0 && (
            <p className="text-sm text-muted-foreground">
              Roughly{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {places}
              </span>{" "}
              volunteer places in total.
            </p>
          )}

          {lines.length > 0 && (
            <dl className="space-y-2 border-t border-dashed border-border pt-4">
              {lines.map((line) => (
                <div
                  key={line.label}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <dt className="shrink-0 text-muted-foreground">
                    {line.label}
                  </dt>
                  <dd
                    className={cn(
                      "truncate text-right tabular-nums",
                      line.emphasis
                        ? "font-semibold text-foreground"
                        : "font-medium text-foreground/90"
                    )}
                  >
                    {line.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {warnings.length > 0 ? (
            <ul
              className="space-y-1.5 border-t border-dashed border-border pt-4"
              data-testid="run-sheet-warnings"
              aria-live="polite"
            >
              {warnings.map((warning) => (
                <li
                  key={warning}
                  className={cn(
                    "flex items-start gap-2 text-sm",
                    attempted
                      ? "font-medium text-amber-700 dark:text-amber-400"
                      : "text-muted-foreground"
                  )}
                >
                  <AlertTriangleIcon
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 shrink-0",
                      attempted
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground/60"
                    )}
                  />
                  {warning}
                </li>
              ))}
            </ul>
          ) : (
            ready && (
              <p className="flex items-start gap-2 border-t border-dashed border-border pt-4 text-sm text-forest-400 dark:text-forest-200">
                <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Ready to go. Regular volunteers who match are signed up
                automatically.
              </p>
            )
          )}

          {note && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {note}
            </p>
          )}
        </div>

        <div className="border-t border-dashed border-border px-5 py-4">
          {children}
        </div>
      </div>
    </aside>
  );
}
