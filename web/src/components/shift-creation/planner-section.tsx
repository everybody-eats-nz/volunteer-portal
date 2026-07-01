import React from "react";
import { cn } from "@/lib/utils";

interface PlannerSectionProps {
  step?: string;
  title: string;
  description?: string;
  headerAside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * A step card in the shift planner flow: numbered eyebrow, Fraunces heading,
 * one-line description, and an optional action slot in the header.
 */
export function PlannerSection({
  step,
  title,
  description,
  headerAside,
  className,
  children,
}: PlannerSectionProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm",
        className
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div>
          {step && (
            <p className="text-[11px] font-semibold tracking-[0.2em] text-forest-300 uppercase dark:text-forest-200">
              {step}
            </p>
          )}
          <h3 className="mt-0.5 text-lg text-foreground">{title}</h3>
          {description && (
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {headerAside && <div className="shrink-0">{headerAside}</div>}
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}
