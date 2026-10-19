"use client";

import { Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Building blocks shared by the day report forms (service night, event, cafe)
 * so all three read as one report.
 */

const FEATURED_TONES = {
  amber: {
    box: "border-amber-300/70 bg-amber-50/80 dark:border-amber-800/60 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
  },
  violet: {
    box: "border-violet-300/70 bg-violet-50/80 dark:border-violet-800/60 dark:bg-violet-950/30",
    text: "text-violet-700 dark:text-violet-300",
  },
  sky: {
    box: "border-sky-300/70 bg-sky-50/80 dark:border-sky-800/60 dark:bg-sky-950/30",
    text: "text-sky-700 dark:text-sky-300",
  },
} as const;

export function HeroStat({
  label,
  value,
  featured = false,
  tone = "amber",
  hint,
  className,
  testId,
}: {
  label: string;
  value: string;
  featured?: boolean;
  tone?: keyof typeof FEATURED_TONES;
  hint?: string;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-2.5",
        featured ? FEATURED_TONES[tone].box : "border-border/70 bg-card/70",
        className
      )}
    >
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "font-accent font-semibold tabular-nums leading-tight",
          featured
            ? cn("text-2xl", FEATURED_TONES[tone].text)
            : "text-xl text-foreground"
        )}
        data-testid={testId}
      >
        {value}
      </dd>
      {hint && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export const TONES = {
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
} as const;

export function SectionCard({
  icon: Icon,
  title,
  tone,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tone: keyof typeof TONES;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-card/40 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg",
              TONES[tone]
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </h3>
        {action}
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

export function Field({
  htmlFor,
  label,
  hint,
  action,
  children,
}: {
  htmlFor?: string;
  label: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label
          htmlFor={htmlFor}
          className="text-xs font-medium text-foreground/80"
        >
          {label}
        </Label>
        {action}
      </div>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function CountField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <Field htmlFor={id} label={label} hint={hint}>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tabular-nums"
      />
    </Field>
  );
}

export function DerivedField({
  id,
  label,
  value,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Field htmlFor={id} label={label} hint={hint}>
      <div
        id={id}
        className="flex h-9 items-center gap-2 rounded-md border border-dashed border-input bg-muted/40 px-3 text-sm tabular-nums text-foreground"
      >
        <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
        {value}
      </div>
    </Field>
  );
}

export function MoneyField({
  id,
  label,
  value,
  onChange,
  action,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  action?: React.ReactNode;
}) {
  return (
    <Field htmlFor={id} label={label} action={action}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="pl-7 tabular-nums"
        />
      </div>
    </Field>
  );
}
