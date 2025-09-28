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

  // Enhanced regex to handle more patterns including hover states
  let result = originalColor;

  // Handle regular color patterns: bg-{color}-{shade}, text-{color}-{shade}, border-{color}-{shade}
  result = result.replace(/(\w+)-(\w+)-(\d+)/g, (match, prefix, color, shade) => {
    switch (prefix) {
      case 'bg':
        if (shade === '50') {
          return `${match} dark:bg-${color}-950/20`;
        }
        if (shade === '100') {
          return `${match} dark:bg-${color}-950/30`;
        }
        break;
      case 'text':
        if (shade === '700') {
          return `${match} dark:text-${color}-400`;
        }
        break;
      case 'border':
        if (shade === '200') {
          return `${match} dark:border-${color}-800`;
        }
        break;
    }
    return match;
  });

  // Handle hover states: hover:bg-{color}-{shade}
  result = result.replace(/hover:bg-(\w+)-(\d+)/g, (match, color, shade) => {
    if (shade === '100') {
      return `${match} dark:hover:bg-${color}-950/30`;
    }
    return match;
  });

  // Handle focus states: focus:bg-{color}-{shade}
  result = result.replace(/focus:bg-(\w+)-(\d+)/g, (match, color, shade) => {
    if (shade === '100') {
      return `${match} dark:focus:bg-${color}-950/30`;
    }
    return match;
  });

  // Fallback: if no dark mode classes were added and we have common patterns, add basic dark mode support
  if (!result.includes('dark:') && result.includes('bg-') && result.includes('text-') && result.includes('border-')) {
    // Extract the primary color from the first color class we find
    const colorMatch = result.match(/(?:bg|text|border)-(\w+)-\d+/);
    if (colorMatch) {
      const primaryColor = colorMatch[1];
      // Add basic dark mode classes if none were added
      if (!result.includes(`dark:bg-${primaryColor}`)) {
        result += ` dark:bg-${primaryColor}-950/20 dark:text-${primaryColor}-400 dark:border-${primaryColor}-800 dark:hover:bg-${primaryColor}-950/30`;
      }
    }
  }

  return result;
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