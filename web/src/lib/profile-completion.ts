/**
 * Helper functions to check user profile completion status
 */

export interface ProfileCompletionStatus {
  isComplete: boolean;
  missingFields: string[];
  needsParentalConsent?: boolean;
  canSignUpForShifts: boolean;
}

export async function checkProfileCompletion(userId: string): Promise<ProfileCompletionStatus> {
  const { prisma } = await import("@/lib/prisma");
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        phone: true,
        dateOfBirth: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        volunteerAgreementAccepted: true,
        healthSafetyPolicyAccepted: true,
        requiresParentalConsent: true,
        parentalConsentReceived: true,
      },
    });

    if (!user) {
      return {
        isComplete: false,
        missingFields: ["User profile not found"],
        canSignUpForShifts: false,
      };
    }

    const missingFields = [];
    
    if (!user.phone) missingFields.push("Mobile number");
    if (!user.dateOfBirth) missingFields.push("Date of birth");
    if (!user.emergencyContactName) missingFields.push("Emergency contact name");
    if (!user.emergencyContactPhone) missingFields.push("Emergency contact phone");
    if (!user.volunteerAgreementAccepted) missingFields.push("Volunteer agreement");
    if (!user.healthSafetyPolicyAccepted) missingFields.push("Health & safety policy");

    const isProfileComplete = missingFields.length === 0;
    const needsParentalConsent = user.requiresParentalConsent && !user.parentalConsentReceived;
    const canSignUpForShifts = isProfileComplete && !needsParentalConsent;

    return {
      isComplete: isProfileComplete,
      missingFields,
      needsParentalConsent,
      canSignUpForShifts,
    };
  } catch (error) {
    console.error("Error checking profile completion:", error);
    return {
      isComplete: false,
      missingFields: ["Error checking profile"],
      canSignUpForShifts: false,
    };
  }
}