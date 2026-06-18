import { NextResponse } from "next/server";
import { requireMobileAdmin } from "@/lib/mobile-auth";
import {
  applySignupAction,
  SignupActionError,
  type SignupAction,
} from "@/lib/services/signup-actions";

/**
 * POST /api/mobile/admin/signups/[id]
 *
 * JWT-authed mirror of the web admin signup action route. Body:
 * { action, sendEmail?, skipNotification? }. Delegates to the shared
 * signup-action service so behaviour (emails, notifications, waitlisting)
 * matches the web admin exactly.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileAdmin(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: signupId } = await params;

  let action: SignupAction;
  let sendEmail: boolean | undefined;
  let skipNotification: boolean | undefined;
  try {
    const body = (await req.json()) as {
      action?: SignupAction;
      sendEmail?: boolean;
      skipNotification?: boolean;
    };
    if (!body.action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }
    action = body.action;
    sendEmail = body.sendEmail;
    skipNotification = body.skipNotification;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await applySignupAction({
      signupId,
      action,
      sendEmail,
      skipNotification,
    });
    return NextResponse.json({
      ...result.signup,
      message: result.message,
    });
  } catch (error) {
    if (error instanceof SignupActionError) {
      return NextResponse.json(
        { error: error.message, ...(error.extra ?? {}) },
        { status: error.status }
      );
    }
    console.error("[mobile/admin/signups action]", error);
    return NextResponse.json(
      { error: "Failed to process signup action" },
      { status: 500 }
    );
  }
}
