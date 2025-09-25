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

const variantStyles = {
  green: {
    card: "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800/50",
    value: "text-green-700 dark:text-green-300",
    title: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-100 dark:bg-green-900/50",
    iconColor: "text-green-600 dark:text-green-400",
  },
  blue: {
    card: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800/50",
    value: "text-blue-700 dark:text-blue-300",
    title: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-900/50",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  purple: {
    card: "bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 border-purple-200 dark:border-purple-800/50",
    value: "text-purple-700 dark:text-purple-300",
    title: "text-purple-600 dark:text-purple-400",
    iconBg: "bg-purple-100 dark:bg-purple-900/50",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  amber: {
    card: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800/50",
    value: "text-amber-700 dark:text-amber-300",
    title: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-900/50",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  red: {
    card: "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 border-red-200 dark:border-red-800/50",
    value: "text-red-700 dark:text-red-300",
    title: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-900/50",
    iconColor: "text-red-600 dark:text-red-400",
  },
  primary: {
    card: "bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 border-primary/20 dark:border-primary/30",
    value: "text-primary dark:text-primary",
    title: "text-primary/80 dark:text-primary/90",
    iconBg: "bg-primary/10 dark:bg-primary/20",
    iconColor: "text-primary dark:text-primary",
  },
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
  const styles = variantStyles[variant];

  return (
    <Card
      className={cn("p-4", styles.card, className)}
      data-testid={testId}
    >
      <div className="flex items-center justify-between">
        <div>
          <div
            className={cn("text-2xl font-bold", styles.value)}
            data-testid={testId ? `${testId}-count` : undefined}
          >
            {value}
          </div>
          <div className={cn("text-sm font-medium", styles.title)}>
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-muted-foreground mt-1">
              {subtitle}
            </div>
          )}
        </div>
        <div className={cn("p-2 rounded-lg", styles.iconBg)}>
          <Icon className={cn("h-5 w-5", styles.iconColor)} />
        </div>
      </div>
    </Card>
  );
}