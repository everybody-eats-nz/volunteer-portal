import { type VolunteerGrade } from "@prisma/client";

export interface VolunteerGradeInfo {
  label: string;
  color: string;
  description: string;
  icon: string;
}

export const VOLUNTEER_GRADE_INFO: Record<VolunteerGrade, VolunteerGradeInfo> = {
  GREEN: {
    label: "Standard",
    color: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/30",
    description: "Standard volunteer with basic access",
    icon: "🟢",
  },
  YELLOW: {
    label: "Experienced",
    color: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/30",
    description: "Experienced volunteer with additional privileges",
    icon: "🟡",
  },
  PINK: {
    label: "Shift Leader",
    color: "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-950/30",
    description: "Shift leader with team management capabilities",
    icon: "🩷",
  },
} as const;

export const VOLUNTEER_GRADE_OPTIONS = Object.entries(VOLUNTEER_GRADE_INFO).map(
  ([grade, info]) => ({
    value: grade as VolunteerGrade,
    label: info.label,
    description: info.description,
    icon: info.icon,
  })
);

// Helper function for getting grade info safely
export function getVolunteerGradeInfo(grade: VolunteerGrade): VolunteerGradeInfo {
  return VOLUNTEER_GRADE_INFO[grade];
}