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
    color: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
    description: "Standard volunteer with basic access",
    icon: "🟢",
  },
  YELLOW: {
    label: "Experienced", 
    color: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
    description: "Experienced volunteer with additional privileges",
    icon: "🟡",
  },
  PINK: {
    label: "Shift Leader",
    color: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100", 
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