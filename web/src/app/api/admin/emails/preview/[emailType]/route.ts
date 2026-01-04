import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getEmailService } from "@/lib/email-service";

type EmailType =
  | "shortage"
  | "cancellation"
  | "confirmation"
  | "volunteerCancellation"
  | "volunteerNotNeeded"
  | "emailVerification"
  | "parentalConsentApproval"
  | "userInvitation"
  | "profileCompletion"
  | "migration";

const validEmailTypes: EmailType[] = [
  "shortage",
  "cancellation",
  "confirmation",
  "volunteerCancellation",
  "volunteerNotNeeded",
  "emailVerification",
  "parentalConsentApproval",
  "userInvitation",
  "profileCompletion",
  "migration",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ emailType: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { emailType } = await params;

  if (!validEmailTypes.includes(emailType as EmailType)) {
    return NextResponse.json({ error: "Invalid email type" }, { status: 400 });
  }

  try {
    const emailService = getEmailService();
    const preview = await emailService.getEmailPreview(emailType as EmailType);

    if (!preview.success) {
      return NextResponse.json({ error: preview.message }, { status: 500 });
    }

    return NextResponse.json(preview.data);
  } catch (error) {
    console.error("Error fetching email preview:", error);
    return NextResponse.json(
      { error: "Failed to fetch email preview" },
      { status: 500 }
    );
  }
}
