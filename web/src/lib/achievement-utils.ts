/**
 * Client-safe achievement utilities
 * This file contains helper functions that can be used in both client and server components
 */

export interface AchievementCriteria {
  type:
    | "shifts_completed"
    | "hours_volunteered"
    | "consecutive_months"
    | "specific_shift_type"
    | "years_volunteering"
    | "community_impact"
    | "friends_count"
    | "passkeys_added";
  value: number;
  shiftType?: string;
  timeframe?: "month" | "year" | "all_time";
}

/**
 * Criteria types with labels for UI components
 * Single source of truth for achievement criteria types
 */
export const ACHIEVEMENT_CRITERIA_TYPES = [
  { value: "shifts_completed", label: "Shifts Completed" },
  { value: "hours_volunteered", label: "Hours Volunteered" },
  { value: "consecutive_months", label: "Consecutive Months" },
  { value: "years_volunteering", label: "Years Volunteering" },
  { value: "community_impact", label: "Community Impact (Meals)" },
  { value: "friends_count", label: "Friends Count" },
  { value: "passkeys_added", label: "Passkeys Added" },
  { value: "specific_shift_type", label: "Specific Shift Type" },
] as const;

export function formatAchievementCriteria(
  criteriaJson: string,
  shiftTypeName?: string
): string {
  try {
    const criteria: AchievementCriteria = JSON.parse(criteriaJson);
    const value = criteria.value;

    switch (criteria.type) {
      case "shifts_completed":
        return `Complete ${value} volunteer shift${value !== 1 ? "s" : ""}`;
      case "hours_volunteered":
        return `Volunteer for ${value} hour${value !== 1 ? "s" : ""}`;
      case "consecutive_months":
        return `Volunteer for ${value} consecutive month${
          value !== 1 ? "s" : ""
        }`;
      case "years_volunteering":
        return `Volunteer for ${value} year${value !== 1 ? "s" : ""}`;
      case "community_impact":
        return `Help prepare an estimated ${value} meal${
          value !== 1 ? "s" : ""
        }`;
      case "friends_count":
        return `Make ${value} friend${
          value !== 1 ? "s" : ""
        } in the volunteer community`;
      case "passkeys_added":
        return `Add ${value} passkey${value !== 1 ? "s" : ""} to your account`;
      case "specific_shift_type":
        return shiftTypeName
          ? `Complete ${value} "${shiftTypeName}" shift${
              value !== 1 ? "s" : ""
            }`
          : `Complete ${value} shift${
              value !== 1 ? "s" : ""
            } of a specific type`;
      default:
        return "Unknown criteria";
    }
  } catch {
    return "Invalid criteria";
  }
}
