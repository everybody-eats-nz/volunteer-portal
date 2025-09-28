import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type CustomLabel } from "@prisma/client";

interface CustomLabelBadgeProps {
  label: CustomLabel;
  size?: "sm" | "default" | "lg";
  showIcon?: boolean;
  className?: string;
}

// Color mapping for existing labels to add dark mode support
const COLOR_MIGRATION_MAP: Record<string, string> = {
  "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100":
    "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-950/30",
  "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100":
    "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/30",
  "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100":
    "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/30",
  "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100":
    "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/30",
  "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100":
    "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-950/30",
  "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100":
    "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-950/30",
  "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100":
    "bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-950/30",
  "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100":
    "bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-950/30",
};

function getMigratedColor(originalColor: string): string {
  // If the color already has dark mode classes, return as-is
  if (originalColor.includes('dark:')) {
    return originalColor;
  }

  // Otherwise, try to find a migrated version
  return COLOR_MIGRATION_MAP[originalColor] || originalColor;
}

export function CustomLabelBadge({
  label,
  size = "default",
  showIcon = true,
  className,
}: CustomLabelBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    default: "text-xs px-2 py-1",
    lg: "text-sm px-2.5 py-1.5",
  };

  const migratedColor = getMigratedColor(label.color);

  return (
    <Badge
      variant="outline"
      className={cn(
        migratedColor,
        sizeClasses[size],
        "font-medium shadow-sm",
        className
      )}
      data-testid="custom-label-badge"
    >
      {showIcon && label.icon && <span className="mr-1">{label.icon}</span>}
      {label.name}
    </Badge>
  );
}