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

  // Enhanced fallback: if no dark mode classes were added, try to parse and add them
  if (!result.includes('dark:')) {
    // Extract all color information from the string
    const bgMatch = result.match(/bg-(\w+)-(\d+)/);
    const textMatch = result.match(/text-(\w+)-(\d+)/);
    const borderMatch = result.match(/border-(\w+)-(\d+)/);
    const hoverMatch = result.match(/hover:bg-(\w+)-(\d+)/);

    let darkModeClasses = [];

    if (bgMatch) {
      const [, color, shade] = bgMatch;
      if (shade === '50') {
        darkModeClasses.push(`dark:bg-${color}-950/20`);
      }
    }

    if (textMatch) {
      const [, color, shade] = textMatch;
      if (shade === '700') {
        darkModeClasses.push(`dark:text-${color}-400`);
      }
    }

    if (borderMatch) {
      const [, color, shade] = borderMatch;
      if (shade === '200') {
        darkModeClasses.push(`dark:border-${color}-800`);
      }
    }

    if (hoverMatch) {
      const [, color, shade] = hoverMatch;
      if (shade === '100') {
        darkModeClasses.push(`dark:hover:bg-${color}-950/30`);
      }
    }

    // If we found any matches, add the dark mode classes
    if (darkModeClasses.length > 0) {
      result = `${result} ${darkModeClasses.join(' ')}`;
    }
  }

  return result.trim();
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