import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyEmailToken } from "@/lib/email-verification";

const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

/**
 * POST /api/auth/verify-email
 * Verifies an email using the provided token
 *
 * @example
 * ```tsx
 * const response = await fetch("/api/auth/verify-email", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({
 *     token: "abc123def456..."
 *   })
 * });
 * ```
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validatedData = verifyEmailSchema.parse(body);

    const result = await verifyEmailToken(validatedData.token);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: result.message,
        userId: result.userId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Email verification error:", error);

    if (error instanceof z.ZodError) {
      const firstError = error.issues[0];
      return NextResponse.json({ error: firstError.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Email verification failed. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/verify-email?token=...
 * Verifies an email using the provided token (for email links)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Verification token is required" },
        { status: 400 }
      );
    }

    const result = await verifyEmailToken(token);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: result.message,
        userId: result.userId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Email verification error:", error);

    return NextResponse.json(
      { error: "Email verification failed. Please try again." },
      { status: 500 }
    );
  }
}