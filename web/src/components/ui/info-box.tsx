import * as React from "react";
import { cn } from "@/lib/utils";

export interface InfoBoxProps {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "blue" | "green" | "amber" | "red";
  className?: string;
  testId?: string;
}

const variantStyles = {
  blue: {
    container: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50",
    icon: "text-blue-600 dark:text-blue-400",
    title: "text-blue-900 dark:text-blue-100",
    content: "text-blue-700 dark:text-blue-300",
  },
  green: {
    container: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/50",
    icon: "text-green-600 dark:text-green-400",
    title: "text-green-900 dark:text-green-100",
    content: "text-green-700 dark:text-green-300",
  },
  amber: {
    container: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50",
    icon: "text-amber-600 dark:text-amber-400",
    title: "text-amber-900 dark:text-amber-100",
    content: "text-amber-700 dark:text-amber-300",
  },
  red: {
    container: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50",
    icon: "text-red-600 dark:text-red-400",
    title: "text-red-900 dark:text-red-100",
    content: "text-red-700 dark:text-red-300",
  },
};

export function InfoBox({
  title,
  children,
  icon = <span className="text-lg">ℹ️</span>,
  variant = "blue",
  className,
  testId,
}: InfoBoxProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        styles.container,
        className
      )}
      data-testid={testId}
    >
      <div className="flex items-start gap-2">
        <span className={styles.icon}>
          {icon}
        </span>
        <div className="text-sm">
          <p className={cn("font-medium mb-1", styles.title)}>
            {title}
          </p>
          <div className={styles.content}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}