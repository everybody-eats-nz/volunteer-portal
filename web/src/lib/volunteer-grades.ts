import { type VolunteerGrade } from "@/generated/client";

export interface VolunteerGradeInfo {
  label: string;
  color: string;
  description: string;
  icon: string;
}

export const VOLUNTEER_GRADE_INFO: Record<VolunteerGrade, VolunteerGradeInfo> =
  {
    GREEN: {
      label: "Standard",
      color:
        "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/30",
      description: "Standard volunteer with basic access",
      icon: "🟢",
    },
    YELLOW: {
      label: "Experienced",
      color:
        "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/30",
      description: "Experienced volunteer with additional privileges",
      icon: "🟡",
    },
    PINK: {
      label: "Shift Leader",
      color:
        "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-950/30",
      description: "Shift leader with team management capabilities",
      icon: "🩷",
    },
  } as const;

// First Shift badge info for volunteers with 0 completed shifts
export const FIRST_SHIFT_BADGE: VolunteerGradeInfo = {
  label: "First shift",
  color:
    "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-950/30",
  description: "Completing their very first shift",
  icon: "🌟",
};

/**
 * The "New volunteer" badge covers a volunteer's 2nd and 3rd shifts (1-2
 * completed). Together with "First shift" that labels exactly their first
 * three shifts, which is how long the team wants them flagged on the roster.
 */
export const NEW_VOLUNTEER_MAX_COMPLETED_SHIFTS = 2;

/**
 * Is this volunteer still in their first few shifts - showing the "First
 * shift" or "New volunteer" badge? Admin-waitlisted new volunteers get offered
 * waitlist places even though the auto-approval rules would not take them.
 */
export function isNewVolunteer(completedShifts: number): boolean {
  return completedShifts <= NEW_VOLUNTEER_MAX_COMPLETED_SHIFTS;
}

// New Volunteer badge info for volunteers on their 2nd and 3rd shifts
export const NEW_VOLUNTEER_BADGE: VolunteerGradeInfo = {
  label: "New volunteer",
  color:
    "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/30",
  description: "New volunteer completing their first shifts",
  icon: "✨",
};

export const VOLUNTEER_GRADE_OPTIONS = Object.entries(VOLUNTEER_GRADE_INFO).map(
  ([grade, info]) => ({
    value: grade as VolunteerGrade,
    label: info.label,
    description: info.description,
    icon: info.icon,
  })
);

// Helper function for getting grade info safely
export function getVolunteerGradeInfo(
  grade: VolunteerGrade
): VolunteerGradeInfo {
  return VOLUNTEER_GRADE_INFO[grade];
}

/**
 * Get the display grade info for a volunteer based on their completed shifts.
 * - 0 shifts: "First shift" badge
 * - 1-2 shifts: "New volunteer" badge (overrides database grade)
 * - 3+ shifts: Actual volunteer grade (GREEN, YELLOW, PINK)
 */
export function getDisplayGradeInfo(
  grade: VolunteerGrade,
  completedShifts: number
): VolunteerGradeInfo | null {
  // Show "First shift" badge for volunteers completing their very first shift
  if (completedShifts === 0) {
    return FIRST_SHIFT_BADGE;
  }

  // Override with "New volunteer" badge for their 2nd and 3rd shifts
  if (isNewVolunteer(completedShifts)) {
    return NEW_VOLUNTEER_BADGE;
  }

  // From their 4th shift on, show actual database grade
  return VOLUNTEER_GRADE_INFO[grade];
}
