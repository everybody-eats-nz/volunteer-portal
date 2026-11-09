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
 * matches the web admin exactly. One difference: `sendEmail` defaults to true
 * here, so a decline from the app always tells the volunteer.
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
    // The app's decline has no "notify the volunteer" checkbox like the web
    // dialog does, so it sends no flag at all. Treat that as "tell them":
    // declining someone without a word leaves them waiting on a shift they
    // will never get. Defaulting here rather than in the app also fixes store
    // builds that are already out.
    sendEmail = body.sendEmail ?? true;
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
      actorId: auth.userId,
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
