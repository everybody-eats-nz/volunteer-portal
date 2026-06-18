import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  applySignupAction,
  SignupActionError,
  type SignupAction,
} from "@/lib/services/signup-actions";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  const { id: signupId } = await params;

  try {
    const body = await req.json();
    const { action, sendEmail, skipNotification } = body as {
      action: SignupAction;
      sendEmail?: boolean;
      skipNotification?: boolean;
    };

    const result = await applySignupAction({
      signupId,
      action,
      sendEmail,
      skipNotification,
    });

    return NextResponse.json({ ...result.signup, message: result.message });
  } catch (error) {
    if (error instanceof SignupActionError) {
      return NextResponse.json(
        { error: error.message, ...(error.extra ?? {}) },
        { status: error.status }
      );
    }
    console.error("Admin signup action error:", error);
    return NextResponse.json(
      { error: "Failed to process signup action" },
      { status: 500 }
    );
  }
}
