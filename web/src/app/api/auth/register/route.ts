import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { autoLabelUnder18User, autoLabelNewVolunteer } from "@/lib/auto-label-utils";
import { createVerificationToken } from "@/lib/email-verification";
import { getEmailService } from "@/lib/email-service";
import { validatePassword } from "@/lib/utils/password-validation";
import { checkForBot } from "@/lib/bot-protection";
import { calculateAge } from "@/lib/utils";

/**
 * Validation schema for user registration
 * Matches the UserProfileFormData interface from the form component
 */
const registerSchema = z
  .object({
    // Basic account info
    email: z.string().email("Invalid email address"),
    password: z.string().refine((password) => {
      const validation = validatePassword(password);
      return validation.isValid;
    }, {
      message: "Password must be at least 6 characters long and contain uppercase, lowercase letter, and number"
    }),
    confirmPassword: z.string(),

    // Personal information
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    name: z.string().optional(), // Generated from firstName + lastName
    phone: z.string().optional(),
    dateOfBirth: z.string().optional(),
    pronouns: z.string().nullable().optional(),

    // Emergency contact
    emergencyContactName: z.string().optional(),
    emergencyContactRelationship: z.string().optional(),
    emergencyContactPhone: z.string().optional(),

    // Medical & references
    medicalConditions: z.string().optional(),
    willingToProvideReference: z.boolean().optional(),
    howDidYouHearAboutUs: z.string().nullable().optional(),
    customHowDidYouHearAboutUs: z.string().optional(),

    // Availability
    availableDays: z.array(z.string()).optional(),
    availableLocations: z.array(z.string()).optional(),

    // Communication & agreements
    emailNewsletterSubscription: z.boolean().optional(),
    notificationPreference: z.enum(["EMAIL", "SMS", "BOTH", "NONE"]).optional(),
    volunteerAgreementAccepted: z.boolean(),
    healthSafetyPolicyAccepted: z.boolean(),
    
    // Profile image (required for all registrations)
    profilePhotoUrl: z.string().min(1, "Profile photo is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

/**
 * POST /api/auth/register
 * Creates a new volunteer account with comprehensive profile information
 *
 * @example
 * ```tsx
 * const response = await fetch("/api/auth/register", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({
 *     email: "volunteer@example.com",
 *     password: "password123",
 *     confirmPassword: "password123",
 *     firstName: "John",
 *     lastName: "Doe",
 *     volunteerAgreementAccepted: true,
 *     healthSafetyPolicyAccepted: true
 *   })
 * });
 * ```
 */
export async function POST(req: Request) {
  try {
    // Check for bot traffic first
    const botResponse = await checkForBot("Registration blocked due to automated activity detection.");
    if (botResponse) {
      return botResponse;
    }

    const body = await req.json();
    
    // Check if this is a migration registration
    const isMigration = body.isMigration === true;
    const userId = body.userId;
    
    // Remove migration-specific fields before validation
    const dataToValidate = { ...body };
    delete dataToValidate.isMigration;
    delete dataToValidate.userId;
    delete dataToValidate.migrationToken;
    
    const validatedData = registerSchema.parse(dataToValidate);

    // For migration, find existing user by ID; otherwise check if email exists
    if (isMigration && userId) {
      const migratingUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (!migratingUser) {
        return NextResponse.json(
          { error: "Invalid migration request" },
          { status: 400 }
        );
      }
      
      // Verify the email matches for security
      if (migratingUser.email !== validatedData.email) {
        return NextResponse.json(
          { error: "Email mismatch in migration request" },
          { status: 400 }
        );
      }
    } else {
      // Check if user already exists for new registrations
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "A user with this email already exists" },
          { status: 400 }
        );
      }
    }

    // Validate required agreements
    if (
      !validatedData.volunteerAgreementAccepted ||
      !validatedData.healthSafetyPolicyAccepted
    ) {
      return NextResponse.json(
        { error: "Please accept all required agreements to continue" },
        { status: 400 }
      );
    }

    // Profile photo is now required for all registrations (handled by schema validation)

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Calculate age and parental consent requirements
    let requiresParentalConsent = false;
    if (validatedData.dateOfBirth) {
      const birthDate = new Date(validatedData.dateOfBirth);
      const age = calculateAge(birthDate);
      requiresParentalConsent = age < 18;
    }

    // Prepare data for database insertion
    const userData = {
      email: validatedData.email,
      hashedPassword,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      name:
        validatedData.name ||
        `${validatedData.firstName} ${validatedData.lastName}`.trim(),
      phone: validatedData.phone || null,
      dateOfBirth: validatedData.dateOfBirth
        ? new Date(validatedData.dateOfBirth)
        : null,
      pronouns: validatedData.pronouns || null,
      role: "VOLUNTEER" as const,

      // Emergency contact
      emergencyContactName: validatedData.emergencyContactName || null,
      emergencyContactRelationship:
        validatedData.emergencyContactRelationship || null,
      emergencyContactPhone: validatedData.emergencyContactPhone || null,

      // Medical & references
      medicalConditions: validatedData.medicalConditions || null,
      willingToProvideReference:
        validatedData.willingToProvideReference || false,
      howDidYouHearAboutUs:
        validatedData.howDidYouHearAboutUs === "other"
          ? validatedData.customHowDidYouHearAboutUs || null
          : validatedData.howDidYouHearAboutUs || null,

      // Availability - store as JSON strings
      availableDays: validatedData.availableDays
        ? JSON.stringify(validatedData.availableDays)
        : null,
      availableLocations: validatedData.availableLocations
        ? JSON.stringify(validatedData.availableLocations)
        : null,

      // Communication & agreements
      emailNewsletterSubscription:
        validatedData.emailNewsletterSubscription ?? true,
      notificationPreference: validatedData.notificationPreference || "EMAIL",
      volunteerAgreementAccepted: validatedData.volunteerAgreementAccepted,
      healthSafetyPolicyAccepted: validatedData.healthSafetyPolicyAccepted,
      
      // Parental consent fields
      requiresParentalConsent,
      parentalConsentReceived: false, // Always false initially
      
      // Profile image (required for registration, nullable in DB for existing users)
      profilePhotoUrl: validatedData.profilePhotoUrl,
    };

    // For migration, update existing user; otherwise create new user
    let user;
    if (isMigration && userId) {
      // Update existing user with completed profile
      user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...userData,
          profileCompleted: true, // Mark profile as completed for migrated users
          isMigrated: true, // Ensure migrated flag is set
          migrationInvitationToken: null, // Clear the token after successful registration
          migrationTokenExpiresAt: null, // Clear the expiry
        },
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: userData,
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
      });
    }

    // Auto-assign labels after user creation
    if (user.id) {
      // Auto-label new volunteers (skip for migrations)
      if (!isMigration) {
        await autoLabelNewVolunteer(user.id);
      }
      
      // Auto-label users under 18 if they have a date of birth
      if (validatedData.dateOfBirth) {
        await autoLabelUnder18User(user.id, new Date(validatedData.dateOfBirth));
      }
    }

    // Send email verification for new registrations (not migrations)
    if (!isMigration && user.id) {
      try {
        const verificationToken = await createVerificationToken(user.id);
        const emailService = getEmailService();
        const verificationLink = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/verify-email?token=${verificationToken}`;
        
        await emailService.sendEmailVerification({
          to: user.email,
          firstName: validatedData.firstName,
          verificationLink,
        });
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Don't fail registration if email sending fails, just log the error
      }
    }

    return NextResponse.json(
      {
        message: isMigration ? "Migration successful" : "Registration successful",
        user,
        requiresEmailVerification: !isMigration, // Let frontend know email verification is required
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);

    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return NextResponse.json({ error: firstError.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
