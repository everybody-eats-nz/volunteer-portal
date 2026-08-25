import { prisma } from "@/lib/prisma";
import {
  getMissingProfileFieldDetails,
  isProfileComplete,
  type MissingProfileField,
  type ProfileCompletionInput,
} from "@/lib/profile-completion";

/**
 * Database-backed profile completion checks.
 *
 * This module is server-only, which is why it can import Prisma at the top
 * level. The rules themselves live in `profile-completion.ts`, which client
 * components import and which must therefore stay free of database imports.
 */

/**
 * Answer "may this volunteer sign up" from the required fields, and bring the
 * cached `profileCompleted` flag back in line when the two have drifted.
 *
 * Both signup routes gate on this. Reading the flag directly is what left
 * volunteers blocked by a message they could not act on: the flag said
 * incomplete while every field was filled in, so nothing could name what was
 * missing.
 *
 * This is the only place that writes the flag as a repair. Read paths derive
 * completeness from the fields and leave the flag alone, so rendering a page
 * never triggers a write.
 */
export async function syncProfileCompletedFlag(
  user: ProfileCompletionInput & { id: string; profileCompleted: boolean }
): Promise<boolean> {
  const complete = isProfileComplete(user);

  if (user.profileCompleted !== complete) {
    await prisma.user.update({
      where: { id: user.id },
      data: { profileCompleted: complete },
    });
  }

  return complete;
}

export interface ProfileCompletionStatus {
  isComplete: boolean;
  missingFields: string[];
  /** Same fields as `missingFields`, with the edit section that owns each. */
  missingFieldDetails: MissingProfileField[];
  needsParentalConsent?: boolean;
  canSignUpForShifts: boolean;
}

/** Fields `checkProfileCompletion` needs in order to answer. */
export const profileCompletionSelect = {
  firstName: true,
  phone: true,
  dateOfBirth: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  volunteerAgreementAccepted: true,
  healthSafetyPolicyAccepted: true,
  requiresParentalConsent: true,
  parentalConsentReceived: true,
} as const;

/**
 * Read-only: what a volunteer still has to fill in, derived from the fields.
 * The `profileCompleted` flag is deliberately not consulted and not written -
 * callers are render paths, and repairing drift belongs to the signup gates.
 */
export async function checkProfileCompletion(
  userId: string
): Promise<ProfileCompletionStatus> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: profileCompletionSelect,
    });

    if (!user) {
      return {
        isComplete: false,
        missingFields: ["User profile not found"],
        missingFieldDetails: [],
        canSignUpForShifts: false,
      };
    }

    const missingFieldDetails = getMissingProfileFieldDetails(user);
    const profileComplete = isProfileComplete(user);

    const needsParentalConsent =
      user.requiresParentalConsent && !user.parentalConsentReceived;
    const canSignUpForShifts = profileComplete && !needsParentalConsent;

    return {
      isComplete: profileComplete,
      missingFields: missingFieldDetails.map((field) => field.label),
      missingFieldDetails,
      needsParentalConsent,
      canSignUpForShifts,
    };
  } catch (error) {
    console.error("Error checking profile completion:", error);
    return {
      isComplete: false,
      missingFields: ["Error checking profile"],
      missingFieldDetails: [],
      canSignUpForShifts: false,
    };
  }
}
