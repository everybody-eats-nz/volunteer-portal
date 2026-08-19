"use client";

import { Check, ChevronRight, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { RuleTrace } from "@/lib/auto-approval/types";

/**
 * The receipt for a single decision: every rule that was considered, in the
 * order the engine considered it, and for each one exactly what it asked for
 * versus what was true.
 *
 * This is the answer to "why?" - so it shows the rules that did *not* fire as
 * well as the one that did. A near-miss ("attendance 78%, needed 80%") is
 * usually the thing an admin actually wanted to know.
 */
export function DecisionReceipt({
  trace,
  className,
}: {
  trace: RuleTrace[];
  className?: string;
}) {
  if (!trace?.length) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No rules existed when this was decided.
      </p>
    );
  }

  const considered = trace.filter((t) => t.status !== "OUT_OF_SCOPE");
  const skipped = trace.filter((t) => t.status === "OUT_OF_SCOPE");

  return (
    <div className={cn("space-y-3", className)} data-testid="decision-receipt">
      {considered.map((rule) => (
        <RuleRow key={rule.ruleId} rule={rule} />
      ))}

      {skipped.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {skipped.length} rule{skipped.length === 1 ? "" : "s"} didn&rsquo;t
          apply to this shift:{" "}
          {skipped
            .map((r) => `${r.ruleName} (${r.scopeReason})`)
            .join(", ")}
        </p>
      )}
    </div>
  );
}

function RuleRow({ rule }: { rule: RuleTrace }) {
  const passed = rule.criteria.filter((c) => c.passed).length;

  return (
    <div
      className={cn(
        "rounded-lg border",
        rule.decisive
          ? rule.kind === "BLOCK"
            ? "border-rose-300 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20"
            : "border-emerald-300 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20"
          : "bg-muted/20"
      )}
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <StatusMark status={rule.status} kind={rule.kind} />
        <span className="text-sm font-medium">{rule.ruleName}</span>

        {rule.kind === "BLOCK" && (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Block
          </Badge>
        )}
        {rule.decisive && (
          <Badge
            variant="secondary"
            className="text-[10px] uppercase tracking-wide"
          >
            Decided it
          </Badge>
        )}

        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {rule.status === "NO_CRITERIA"
            ? "no conditions set"
            : rule.criteria.length > 0
              ? `${passed}/${rule.criteria.length} met · needs ${
                  rule.logic === "AND" ? "all" : "any"
                }`
              : null}
        </span>
      </div>

      {rule.criteria.length > 0 && (
        <ul className="border-t divide-y divide-border/60">
          {rule.criteria.map((c) => (
            <li
              key={c.key}
              className="flex items-start gap-2.5 px-3 py-2 text-sm"
            >
              {c.passed ? (
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-label="Met"
                />
              ) : (
                <X
                  className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400"
                  aria-label="Not met"
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="text-muted-foreground">{c.label}: </span>
                <span className="font-medium">{c.requirement}</span>
                <ChevronRight
                  className="mx-1 inline h-3 w-3 text-muted-foreground/60"
                  aria-hidden
                />
                <span
                  className={cn(
                    c.passed
                      ? "text-muted-foreground"
                      : "font-medium text-rose-700 dark:text-rose-400"
                  )}
                >
                  {c.actual}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {rule.status === "NO_CRITERIA" && (
        <p className="border-t px-3 py-2 text-sm text-muted-foreground">
          This rule has no conditions, so it can never match anyone.
        </p>
      )}
    </div>
  );
}

function StatusMark({
  status,
  kind,
}: {
  status: RuleTrace["status"];
  kind: RuleTrace["kind"];
}) {
  if (status === "MATCHED") {
    return (
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white",
          kind === "BLOCK" ? "bg-rose-500" : "bg-emerald-500"
        )}
        aria-label="Matched"
      >
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      aria-label="Did not match"
    >
      <Minus className="h-3.5 w-3.5" />
    </span>
  );
}
