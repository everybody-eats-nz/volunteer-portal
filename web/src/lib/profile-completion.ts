/**
 * Profile completion rules, shared by the server gates and by client
 * components that render what is still missing.
 *
 * The required fields below are the single source of truth for "is this
 * profile complete". `User.profileCompleted` is only a cache of that answer:
 * it is written at registration and whenever the profile is updated, but it
 * can drift (older mobile clients, admin edits, OAuth users created without a
 * name). Every gate should ask this module rather than reading the flag, or a
 * volunteer ends up blocked with nothing to fix.
 *
 * Keep this module free of database imports — the signup dialog and the
 * profile editor are client components, and a `@/lib/prisma` reference here
 * (even a dynamic one) pulls the Prisma client into the browser bundle.
 * The database-backed check lives in `profile-completion.server.ts`.
 */

/** Section id on /profile/edit that owns a required field. */
export type ProfileEditStep = "personal" | "emergency" | "communication";

export interface MissingProfileField {
  /** Human-readable label, e.g. "Date of birth". */
  label: string;
  /** Which /profile/edit section the volunteer needs to open to fix it. */
  step: ProfileEditStep;
}

/**
 * Required fields for a "complete" profile. Source of truth used by
 * registration (sets the flag at creation), profile updates (flips the flag
 * when missing fields are filled in), and the shift signup gate.
 */
export type ProfileCompletionInput = {
  firstName?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  volunteerAgreementAccepted?: boolean | null;
  healthSafetyPolicyAccepted?: boolean | null;
};

export type CompletedProfile = {
  firstName: string;
  phone: string;
  dateOfBirth: NonNullable<ProfileCompletionInput["dateOfBirth"]>;
  emergencyContactName: string;
  emergencyContactPhone: string;
  volunteerAgreementAccepted: true;
  healthSafetyPolicyAccepted: true;
};

/**
 * Every field a volunteer must fill in before signing up, in display order,
 * paired with the /profile/edit section that owns it. Adding a required field
 * here updates the signup gates, the banners and the deep links at once.
 */
const REQUIRED_FIELDS: ReadonlyArray<{
  key: keyof ProfileCompletionInput;
  label: string;
  step: ProfileEditStep;
}> = [
  { key: "firstName", label: "First name", step: "personal" },
  { key: "phone", label: "Mobile number", step: "personal" },
  { key: "dateOfBirth", label: "Date of birth", step: "personal" },
  {
    key: "emergencyContactName",
    label: "Emergency contact name",
    step: "emergency",
  },
  {
    key: "emergencyContactPhone",
    label: "Emergency contact phone",
    step: "emergency",
  },
  {
    key: "volunteerAgreementAccepted",
    label: "Volunteer agreement",
    step: "communication",
  },
  {
    key: "healthSafetyPolicyAccepted",
    label: "Health & safety policy",
    step: "communication",
  },
];

export function isProfileComplete<T extends ProfileCompletionInput>(
  input: T
): input is T & CompletedProfile {
  return REQUIRED_FIELDS.every((field) => Boolean(input[field.key]));
}

/**
 * Required fields that are still missing, with the edit section that owns
 * each one so the caller can link the volunteer straight to it.
 */
export function getMissingProfileFieldDetails(
  input: ProfileCompletionInput
): MissingProfileField[] {
  return REQUIRED_FIELDS.filter((field) => !input[field.key]).map(
    ({ label, step }) => ({ label, step })
  );
}

/**
 * Human-readable labels for each required field that is still missing,
 * in display order. Shared by the profile-completion status check and the
 * shift signup gates so the labels never drift between surfaces.
 */
export function getMissingProfileFields(
  input: ProfileCompletionInput
): string[] {
  return getMissingProfileFieldDetails(input).map((field) => field.label);
}

/**
 * Link to the /profile/edit section holding the first missing field, so
 * "Complete Profile" lands on the step that actually needs attention rather
 * than the start of the wizard.
 */
export function getProfileEditHref(
  missingFields: ReadonlyArray<MissingProfileField | string>
): string {
  const first = missingFields[0];
  if (!first) return "/profile/edit";
  const step =
    typeof first === "string"
      ? REQUIRED_FIELDS.find((field) => field.label === first)?.step
      : first.step;
  return step ? `/profile/edit?step=${step}` : "/profile/edit";
}
