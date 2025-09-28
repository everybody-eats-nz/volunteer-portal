import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type CustomLabel } from "@prisma/client";

interface CustomLabelBadgeProps {
  label: CustomLabel;
  size?: "sm" | "default" | "lg";
  showIcon?: boolean;
  className?: string;
}

// Automatically convert old color formats to include dark mode support
function addDarkModeSupport(originalColor: string): string {
  // If the color already has dark mode classes, return as-is
  if (originalColor.includes('dark:')) {
    return originalColor;
  }

  // Parse and convert color classes dynamically
  return originalColor.replace(/(\w+)-(\w+)-(\d+)/g, (match, prefix, color, shade) => {
    switch (prefix) {
      case 'bg':
        // Convert bg-{color}-50 to bg-{color}-50 dark:bg-{color}-950/20
        if (shade === '50') {
          return `${match} dark:bg-${color}-950/20`;
        }
        // Convert bg-{color}-100 to bg-{color}-100 dark:bg-{color}-950/30 (hover states)
        if (shade === '100') {
          return `${match} dark:bg-${color}-950/30`;
        }
        break;
      case 'text':
        // Convert text-{color}-700 to text-{color}-700 dark:text-{color}-400
        if (shade === '700') {
          return `${match} dark:text-${color}-400`;
        }
        break;
      case 'border':
        // Convert border-{color}-200 to border-{color}-200 dark:border-{color}-800
        if (shade === '200') {
          return `${match} dark:border-${color}-800`;
        }
        break;
    }
    return match;
  });
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

  const enhancedColor = addDarkModeSupport(label.color);

  return (
    <Badge
      variant="outline"
      className={cn(
        enhancedColor,
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