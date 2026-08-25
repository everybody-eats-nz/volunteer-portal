import {
  getMissingProfileFieldDetails,
  isProfileComplete,
  type MissingProfileField,
  type ProfileCompletionInput,
} from "@/lib/profile-completion";

/**
 * Answer "may this volunteer sign up" from the required fields, and bring the
 * cached `profileCompleted` flag back in line when the two have drifted.
 *
 * Both signup routes gate on this. Reading the flag directly is what left
 * volunteers blocked by a message they could not act on: the flag said
 * incomplete while every field was filled in, so nothing could name what was
 * missing.
 */
export async function syncProfileCompletedFlag(
  user: ProfileCompletionInput & { id: string; profileCompleted: boolean }
): Promise<boolean> {
  const complete = isProfileComplete(user);

  if (user.profileCompleted !== complete) {
    const { prisma } = await import("@/lib/prisma");
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
  profileCompleted: true,
  requiresParentalConsent: true,
  parentalConsentReceived: true,
} as const;

export async function checkProfileCompletion(
  userId: string,
  /**
   * Write back a `profileCompleted` flag that disagrees with the fields.
   * Callers that run during a render pass `false` to stay read-only; the
   * signup gates repair it so the drift does not outlive one attempt.
   */
  { repairStaleFlag = true }: { repairStaleFlag?: boolean } = {}
): Promise<ProfileCompletionStatus> {
  const { prisma } = await import("@/lib/prisma");

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

    // The fields win. A stale flag used to block volunteers who had nothing
    // left to fill in, with no way to tell what was wrong.
    if (repairStaleFlag && user.profileCompleted !== profileComplete) {
      await prisma.user.update({
        where: { id: userId },
        data: { profileCompleted: profileComplete },
      });
    }

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
