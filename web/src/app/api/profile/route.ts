import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { safeParseAvailability } from "@/lib/parse-availability";
import { autoLabelUnder16User } from "@/lib/auto-label-utils";
import { checkForBot } from "@/lib/bot-protection";

const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Invalid email format").optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  pronouns: z.string().optional(),
  profilePhotoUrl: z.string().nullable().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  medicalConditions: z.string().optional(),
  willingToProvideReference: z.boolean().optional(),
  howDidYouHearAboutUs: z.string().optional(),
  customHowDidYouHearAboutUs: z.string().optional(),
  availableDays: z.array(z.string()).optional(),
  availableLocations: z.array(z.string()).optional(),
  emailNewsletterSubscription: z.boolean().optional(),
  notificationPreference: z.enum(["EMAIL", "SMS", "BOTH", "NONE"]).optional(),
  receiveShortageNotifications: z.boolean().optional(),
  excludedShortageNotificationTypes: z.array(z.string()).optional(),
  volunteerAgreementAccepted: z.boolean().optional(),
  healthSafetyPolicyAccepted: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      pronouns: true,
      profilePhotoUrl: true,
      role: true,
      emergencyContactName: true,
      emergencyContactRelationship: true,
      emergencyContactPhone: true,
      medicalConditions: true,
      willingToProvideReference: true,
      howDidYouHearAboutUs: true,
      availableDays: true,
      availableLocations: true,
      emailNewsletterSubscription: true,
      notificationPreference: true,
      receiveShortageNotifications: true,
      excludedShortageNotificationTypes: true,
      volunteerAgreementAccepted: true,
      healthSafetyPolicyAccepted: true,
      requiresParentalConsent: true,
      parentalConsentReceived: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Parse JSON fields safely (handles both JSON arrays and plain text from migration)
  const userWithParsedFields = {
    ...user,
    availableDays: safeParseAvailability(user.availableDays),
    availableLocations: safeParseAvailability(user.availableLocations),
  };

  return NextResponse.json(userWithParsedFields);
}

export async function PUT(req: Request) {
  // Check for bot traffic first
  const botResponse = await checkForBot("Profile update blocked due to automated activity detection.");
  if (botResponse) {
    return botResponse;
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    console.log("Received profile update:", body);
    const validatedData = updateProfileSchema.parse(body);

    // Check if user is admin
    const isAdmin = user.role === "ADMIN";

    // Prepare update data
    const updateData: Prisma.UserUpdateInput = {};

    // Handle simple string/boolean fields
    if (validatedData.firstName !== undefined)
      updateData.firstName = validatedData.firstName || null;
    if (validatedData.lastName !== undefined)
      updateData.lastName = validatedData.lastName || null;

    // Email can only be changed by admins if already set
    if (validatedData.email !== undefined) {
      if (user.email && !isAdmin && validatedData.email !== user.email) {
        return NextResponse.json(
          { error: "Only administrators can change email addresses once set" },
          { status: 403 }
        );
      }
      updateData.email = validatedData.email;
    }

    if (validatedData.phone !== undefined)
      updateData.phone = validatedData.phone || null;
    if (validatedData.pronouns !== undefined)
      updateData.pronouns = validatedData.pronouns || null;
    if (validatedData.profilePhotoUrl !== undefined)
      updateData.profilePhotoUrl = validatedData.profilePhotoUrl || null;
    if (validatedData.emergencyContactName !== undefined)
      updateData.emergencyContactName =
        validatedData.emergencyContactName || null;
    if (validatedData.emergencyContactRelationship !== undefined)
      updateData.emergencyContactRelationship =
        validatedData.emergencyContactRelationship || null;
    if (validatedData.emergencyContactPhone !== undefined)
      updateData.emergencyContactPhone =
        validatedData.emergencyContactPhone || null;
    if (validatedData.medicalConditions !== undefined)
      updateData.medicalConditions = validatedData.medicalConditions || null;
    if (validatedData.willingToProvideReference !== undefined)
      updateData.willingToProvideReference =
        validatedData.willingToProvideReference;
    if (validatedData.howDidYouHearAboutUs !== undefined)
      updateData.howDidYouHearAboutUs =
        validatedData.howDidYouHearAboutUs === "other"
          ? validatedData.customHowDidYouHearAboutUs || null
          : validatedData.howDidYouHearAboutUs || null;
    if (validatedData.emailNewsletterSubscription !== undefined)
      updateData.emailNewsletterSubscription =
        validatedData.emailNewsletterSubscription;
    if (validatedData.notificationPreference !== undefined)
      updateData.notificationPreference = validatedData.notificationPreference;
    if (validatedData.volunteerAgreementAccepted !== undefined)
      updateData.volunteerAgreementAccepted =
        validatedData.volunteerAgreementAccepted;
    if (validatedData.healthSafetyPolicyAccepted !== undefined)
      updateData.healthSafetyPolicyAccepted =
        validatedData.healthSafetyPolicyAccepted;
    if (validatedData.receiveShortageNotifications !== undefined)
      updateData.receiveShortageNotifications =
        validatedData.receiveShortageNotifications;
    if (validatedData.excludedShortageNotificationTypes !== undefined)
      updateData.excludedShortageNotificationTypes =
        validatedData.excludedShortageNotificationTypes;

    // Handle date field - can only be changed by admins if already set
    if (validatedData.dateOfBirth !== undefined) {
      const newDateOfBirth = validatedData.dateOfBirth
        ? new Date(validatedData.dateOfBirth).toISOString().split("T")[0]
        : null;
      const currentDateOfBirth = user.dateOfBirth
        ? new Date(user.dateOfBirth).toISOString().split("T")[0]
        : null;

      if (currentDateOfBirth && !isAdmin && newDateOfBirth !== currentDateOfBirth) {
        return NextResponse.json(
          { error: "Only administrators can change date of birth once set" },
          { status: 403 }
        );
      }

      updateData.dateOfBirth = validatedData.dateOfBirth
        ? new Date(validatedData.dateOfBirth)
        : null;
    }

    // Handle array fields (stored as JSON)
    if (validatedData.availableDays !== undefined) {
      updateData.availableDays =
        validatedData.availableDays.length > 0
          ? JSON.stringify(validatedData.availableDays)
          : null;
    }
    if (validatedData.availableLocations !== undefined) {
      updateData.availableLocations =
        validatedData.availableLocations.length > 0
          ? JSON.stringify(validatedData.availableLocations)
          : null;
    }

    // Update the derived name field if first/last names are provided
    if (
      validatedData.firstName !== undefined ||
      validatedData.lastName !== undefined
    ) {
      const firstName = validatedData.firstName || user.firstName || "";
      const lastName = validatedData.lastName || user.lastName || "";
      updateData.name = `${firstName} ${lastName}`.trim() || null;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        phone: true,
        dateOfBirth: true,
        pronouns: true,
        profilePhotoUrl: true,
        role: true,
        emergencyContactName: true,
        emergencyContactRelationship: true,
        emergencyContactPhone: true,
        medicalConditions: true,
        willingToProvideReference: true,
        howDidYouHearAboutUs: true,
        availableDays: true,
        availableLocations: true,
        emailNewsletterSubscription: true,
        notificationPreference: true,
        receiveShortageNotifications: true,
        excludedShortageNotificationTypes: true,
        volunteerAgreementAccepted: true,
        healthSafetyPolicyAccepted: true,
        requiresParentalConsent: true,
        parentalConsentReceived: true,
      },
    });

    // Auto-label users under 16 if date of birth was updated
    if (validatedData.dateOfBirth !== undefined) {
      const dateOfBirth = validatedData.dateOfBirth ? new Date(validatedData.dateOfBirth) : null;
      await autoLabelUnder16User(user.id, dateOfBirth);
    }

    // Parse JSON fields for response safely
    const responseUser = {
      ...updatedUser,
      availableDays: safeParseAvailability(updatedUser.availableDays),
      availableLocations: safeParseAvailability(updatedUser.availableLocations),
    };

    return NextResponse.json(responseUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Validation error:", error.issues);
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
