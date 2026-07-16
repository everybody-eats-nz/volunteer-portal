import { GUARDIAN_REQUIRED_AGE, calculateAge } from "@/lib/utils";

/** 400 payload returned when the guardian requirement is not met. */
export type GuardianValidationError = {
  error: string;
  message: string;
};

/**
 * Whether a volunteer with this date of birth must name a parent/guardian
 * when signing up for a shift (aged GUARDIAN_REQUIRED_AGE or under).
 *
 * A missing date of birth passes: profile completion enforces DOB before a
 * signup ever reaches the guardian check.
 */
export function requiresGuardianName(
  dateOfBirth: Date | null | undefined
): boolean {
  if (!dateOfBirth) return false;
  return calculateAge(dateOfBirth) <= GUARDIAN_REQUIRED_AGE;
}

/**
 * The guardian name travels in the signup note (clients send
 * "Guardian: <name>"), so server-side we accept any note that mentions
 * "guardian".
 */
export function noteContainsGuardianName(
  note: string | null | undefined
): boolean {
  return Boolean(note && note.toLowerCase().includes("guardian"));
}

/**
 * Validates the guardian requirement for a shift signup. Shared by the web
 * and mobile signup routes so the rule cannot drift between them.
 *
 * Returns the 400 response payload when a volunteer aged
 * GUARDIAN_REQUIRED_AGE or under has not supplied a guardian name in the
 * signup note, or null when the signup may proceed.
 */
export function validateGuardianRequirement(
  dateOfBirth: Date | null | undefined,
  note: string | null | undefined
): GuardianValidationError | null {
  if (!requiresGuardianName(dateOfBirth)) return null;
  if (noteContainsGuardianName(note)) return null;

  return {
    error: "Guardian name required",
    message: `Volunteers aged ${GUARDIAN_REQUIRED_AGE} and under must provide a parent or guardian's name when signing up. Please add "Guardian: <name>" to your signup note.`,
  };
}
