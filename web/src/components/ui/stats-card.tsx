import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

export interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "green" | "blue" | "purple" | "amber" | "red" | "primary";
  className?: string;
  testId?: string;
}

/* Brand-cohesive stat cards (new.everybodyeats.nz): a single cream/white paper
   surface with a forest hairline, grain and a thin forest top-accent bar — the
   same card treatment as the shifts flow. The variant only tints the icon tile,
   so a grid of stats reads as one calm family rather than a rainbow. Forest is
   the default accent; "amber" maps to the sun accent for a single warm pop;
   "red" stays semantic for genuine warnings. */
type AccentStyle = { iconBg: string; iconColor: string; bar: string };

const forestAccent: AccentStyle = {
  iconBg:
    "bg-forest-500/10 ring-1 ring-forest-500/10 dark:bg-cream-50/10 dark:ring-cream-50/10",
  iconColor: "text-forest-600 dark:text-cream-50/80",
  bar: "from-forest-500 to-forest-300 dark:from-forest-400 dark:to-forest-300",
};

const sunAccent: AccentStyle = {
  iconBg:
    "bg-sun-200 ring-1 ring-forest-500/10 dark:bg-sun-200/20 dark:ring-cream-50/10",
  iconColor: "text-forest-700 dark:text-sun-200",
  bar: "from-sun-300 to-sun-200 dark:from-sun-300 dark:to-sun-200",
};

const redAccent: AccentStyle = {
  iconBg: "bg-red-500/10 ring-1 ring-red-500/15 dark:bg-red-500/15",
  iconColor: "text-red-600 dark:text-red-400",
  bar: "from-red-500 to-red-400",
};

const variantAccents: Record<NonNullable<StatsCardProps["variant"]>, AccentStyle> = {
  green: forestAccent,
  blue: forestAccent,
  purple: forestAccent,
  primary: forestAccent,
  amber: sunAccent,
  red: redAccent,
};

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "primary",
  className,
  testId,
}: StatsCardProps) {
  const accent = variantAccents[variant];

  return (
    <Card
      className={cn(
        "grain relative overflow-hidden rounded-2xl border border-forest-500/10 bg-card p-5 shadow-sm dark:border-cream-50/10",
        className
      )}
      data-testid={testId}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
          accent.bar
        )}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-3xl font-bold tracking-tight font-accent tabular-nums text-forest-700 dark:text-cream-50"
            data-testid={testId ? `${testId}-count` : undefined}
          >
            {value}
          </div>
          <div className="text-sm font-medium mt-0.5 text-forest-700/70 dark:text-cream-50/70">
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-forest-500/70 dark:text-cream-50/55 mt-1">
              {subtitle}
            </div>
          )}
        </div>
        <div className={cn("p-2.5 rounded-xl shrink-0", accent.iconBg)}>
          <Icon className={cn("h-6 w-6", accent.iconColor)} />
        </div>
      </div>
    </Card>
  );
}