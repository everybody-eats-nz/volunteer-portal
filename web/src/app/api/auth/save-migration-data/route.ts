import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeParseAvailability } from "@/lib/parse-availability";

/**
 * Save migration form data before OAuth sign-in
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, data } = body;

    if (!token || !data) {
      return NextResponse.json(
        { error: "Token and data are required" },
        { status: 400 }
      );
    }

    // Find the migration user
    const migrationUser = await prisma.user.findFirst({
      where: {
        migrationInvitationToken: token,
        migrationTokenExpiresAt: { gt: new Date() },
        profileCompleted: false,
        role: "VOLUNTEER",
        isMigrated: true,
      },
    });

    if (!migrationUser) {
      return NextResponse.json(
        { error: "Invalid or expired migration token" },
        { status: 404 }
      );
    }

    // Parse availability data
    const availableDaysArray = safeParseAvailability(
      Array.isArray(data.availableDays) ? data.availableDays.join(",") : data.availableDays
    );
    const availableLocationsArray = safeParseAvailability(
      Array.isArray(data.availableLocations) ? data.availableLocations.join(",") : data.availableLocations
    );

    // Update the migration user with form data
    await prisma.user.update({
      where: { id: migrationUser.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        name: `${data.firstName} ${data.lastName}`.trim(),
        phone: data.phone,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        pronouns: data.pronouns,
        emergencyContactName: data.emergencyContactName,
        emergencyContactRelationship: data.emergencyContactRelationship,
        emergencyContactPhone: data.emergencyContactPhone,
        medicalConditions: data.medicalConditions,
        willingToProvideReference: data.willingToProvideReference,
        howDidYouHearAboutUs: data.howDidYouHearAboutUs,
        availableDays: availableDaysArray.join(","),
        availableLocations: availableLocationsArray.join(","),
        emailNewsletterSubscription: data.emailNewsletterSubscription,
        notificationPreference: data.notificationPreference,
        receiveShortageNotifications: data.receiveShortageNotifications,
        excludedShortageNotificationTypes: Array.isArray(data.excludedShortageNotificationTypes) 
          ? data.excludedShortageNotificationTypes 
          : data.excludedShortageNotificationTypes ? [data.excludedShortageNotificationTypes] : [],
        volunteerAgreementAccepted: data.volunteerAgreementAccepted,
        healthSafetyPolicyAccepted: data.healthSafetyPolicyAccepted,
        profilePhotoUrl: data.profilePhotoUrl,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving migration data:", error);
    return NextResponse.json(
      { error: "Failed to save migration data" },
      { status: 500 }
    );
  }
}