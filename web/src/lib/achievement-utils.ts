/**
 * Client-safe achievement utilities
 * This file contains helper functions that can be used in both client and server components
 */

// Type-only, so it is erased at build time and keeps Prisma out of client
// bundles.
import type { UserProgress } from "@/lib/achievements";

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

/**
 * Valid criteria type values for validation
 * Extracted from ACHIEVEMENT_CRITERIA_TYPES for use in API validation
 */
export const VALID_CRITERIA_TYPES = ACHIEVEMENT_CRITERIA_TYPES.map(
  (type) => type.value
);

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

/** The fields of an achievement's criteria JSON, or null if it can't be read. */
export function parseAchievementCriteria(
  criteria: string
): { type: string; value: number; shiftType?: string } | null {
  try {
    const parsed = JSON.parse(criteria);
    if (typeof parsed.type === "string" && typeof parsed.value === "number") {
      return {
        type: parsed.type,
        value: parsed.value,
        shiftType:
          typeof parsed.shiftType === "string" ? parsed.shiftType : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * How far a volunteer is towards an achievement's goal, in the goal's own
 * units, or undefined for a criteria type that has no progress value.
 */
export function achievementCurrentValue(
  parsed: { type: string; value: number; shiftType?: string },
  progress: UserProgress
): number | undefined {
  if (parsed.type === "specific_shift_type") {
    return parsed.shiftType
      ? progress.shift_type_counts[parsed.shiftType] ?? 0
      : undefined;
  }
  if (!(parsed.type in progress)) return undefined;
  const current = progress[parsed.type as keyof UserProgress];
  return typeof current === "number" ? current : undefined;
}

/** The goal in plain units, e.g. "10 shifts" or "3 Kitchen shifts". */
export function achievementTargetLabel(
  parsed: { type: string; value: number; shiftType?: string } | null,
  shiftTypeName: string | undefined
): string | undefined {
  if (!parsed) return undefined;
  switch (parsed.type) {
    case "shifts_completed":
      return `${parsed.value} shift${parsed.value !== 1 ? "s" : ""}`;
    case "hours_volunteered":
      return `${parsed.value} hour${parsed.value !== 1 ? "s" : ""}`;
    case "consecutive_months":
      return `${parsed.value} month${parsed.value !== 1 ? "s" : ""}`;
    case "years_volunteering":
      return `${parsed.value} year${parsed.value !== 1 ? "s" : ""}`;
    case "community_impact":
      return `${parsed.value} meal${parsed.value !== 1 ? "s" : ""}`;
    case "friends_count":
      return `${parsed.value} friend${parsed.value !== 1 ? "s" : ""}`;
    case "passkeys_added":
      return `${parsed.value} passkey${parsed.value !== 1 ? "s" : ""}`;
    case "specific_shift_type":
      return shiftTypeName
        ? `${parsed.value} ${shiftTypeName} shift${parsed.value !== 1 ? "s" : ""}`
        : `${parsed.value} shift${parsed.value !== 1 ? "s" : ""}`;
    default:
      return undefined;
  }
}
