import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type CustomLabel } from "@prisma/client";

interface CustomLabelBadgeProps {
  label: CustomLabel;
  size?: "sm" | "default" | "lg";
  showIcon?: boolean;
  className?: string;
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

  return (
    <Badge
      variant="outline"
      className={cn(
        label.color,
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