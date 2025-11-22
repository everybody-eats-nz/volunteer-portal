import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type VolunteerGrade } from "@prisma/client";
import { getVolunteerGradeInfo } from "@/lib/volunteer-grades";

interface VolunteerGradeBadgeProps {
  grade: VolunteerGrade;
  size?: "sm" | "default" | "lg";
  showIcon?: boolean;
  className?: string;
}

export function VolunteerGradeBadge({
  grade,
  size = "default",
  showIcon = true,
  className,
}: VolunteerGradeBadgeProps) {
  const info = getVolunteerGradeInfo(grade);

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    default: "text-xs px-2 py-1",
    lg: "text-sm px-2.5 py-1.5",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        info.color,
        sizeClasses[size],
        "font-medium shadow-sm",
        className
      )}
      data-testid="volunteer-grade-badge"
    >
      {showIcon && <span className="mr-1">{info.icon}</span>}
      {info.label}
    </Badge>
  );
}
