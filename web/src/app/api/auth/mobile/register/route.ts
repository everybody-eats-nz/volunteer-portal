import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/email-verification";
import { getEmailService } from "@/lib/email-service";
import { syncNewsletterSubscriptions } from "@/lib/newsletter-sync";
import { validatePassword } from "@/lib/utils/password-validation";
import { getBaseUrl } from "@/lib/utils";
import { isProfileComplete } from "@/lib/profile-completion";
import { signMobileToken, toMobileUser } from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Mobile registration.
 *
 * This mirrors `/api/auth/register` but is a dedicated mobile route for two
 * reasons:
 *  1. The web route is gated by Cloudflare Turnstile, and the native app can't
 *     produce a Turnstile token. We rate-limit by IP here instead.
 *  2. The app needs a session immediately, so we sign and return a mobile JWT
 *     (same shape as `/api/auth/mobile/login`) rather than relying on the
 *     email-verification flow.
 *
 * Email verification is still sent — mobile login simply doesn't block on it.
 */
const registerSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    password: z.string().refine((password) => validatePassword(password).isValid, {
      message:
        "Password must be at least 6 characters long and contain uppercase, lowercase letter, and number",
    }),
    confirmPassword: z.string(),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phone: z.string().optional(),
    emailNewsletterSubscription: z.boolean().optional(),
    volunteerAgreementAccepted: z.boolean(),
    healthSafetyPolicyAccepted: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

// 5 sign-ups per IP per hour — generous for shared networks, tight enough to
// blunt scripted abuse now that Turnstile no longer guards this path.
const limiter = rateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 5 });

export async function POST(req: Request) {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
    const limit = limiter(`mobile-register:${ip}`);
    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many sign-up attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const data = registerSchema.parse(body);

    if (!data.volunteerAgreementAccepted || !data.healthSafetyPolicyAccepted) {
      return NextResponse.json(
        { error: "Please accept all required agreements to continue" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const newsletterOptIn = data.emailNewsletterSubscription ?? true;

    const user = await prisma.user.create({
      data: {
        email: data.email,
        hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        name: `${data.firstName} ${data.lastName}`.trim(),
        phone: data.phone || null,
        role: "VOLUNTEER" as const,
        emailNewsletterSubscription: newsletterOptIn,
        newsletterLists: [],
        notificationPreference: "EMAIL",
        volunteerAgreementAccepted: data.volunteerAgreementAccepted,
        healthSafetyPolicyAccepted: data.healthSafetyPolicyAccepted,
        requiresParentalConsent: false,
        parentalConsentReceived: false,
        // Whether the sign-up supplied every required profile field. The shift
        // signup endpoint gates on this flag.
        profileCompleted: isProfileComplete({
          firstName: data.firstName,
          phone: data.phone,
          dateOfBirth: undefined,
          emergencyContactName: undefined,
          emergencyContactPhone: undefined,
          volunteerAgreementAccepted: data.volunteerAgreementAccepted,
          healthSafetyPolicyAccepted: data.healthSafetyPolicyAccepted,
        }),
        // Stamp the mobile marker so admin tooling can tell this account came
        // in via the app.
        lastMobileLoginAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePhotoUrl: true,
        profileCompleted: true,
        firstName: true,
        lastName: true,
        phone: true,
        dateOfBirth: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        volunteerAgreementAccepted: true,
        healthSafetyPolicyAccepted: true,
      },
    });

    // Send the verification email — best-effort, never blocks sign-up.
    try {
      const verificationToken = await createVerificationToken(user.id);
      const verificationLink = `${getBaseUrl()}/verify-email?token=${verificationToken}`;
      await getEmailService().sendEmailVerification({
        to: user.email,
        firstName: data.firstName,
        verificationLink,
      });
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
    }

    // Campaign Monitor newsletter sync — opt-in only. Failures are swallowed
    // inside the helper.
    await syncNewsletterSubscriptions({
      email: user.email,
      name: user.name || `${data.firstName} ${data.lastName}`.trim(),
      oldLists: [],
      newLists: [],
      emailNewsletterSubscription: newsletterOptIn,
    });

    const token = await signMobileToken(user.id, user.email);

    return NextResponse.json(
      { token, user: toMobileUser(user) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Mobile registration error:", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
