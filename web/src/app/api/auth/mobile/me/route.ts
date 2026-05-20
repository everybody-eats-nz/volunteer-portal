import { NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";
import { archiveAndAnonymizeUser } from "@/lib/user-service";

export async function GET(request: Request) {
  const user = await getMobileUser(request);

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // The mobile app calls this on cold start to restore the session — so this
  // is the most reliable "is this user actively on mobile?" signal we have.
  // Fire-and-forget so a flaky write never breaks app startup.
  void prisma.user
    .update({
      where: { id: user.id },
      data: { lastMobileLoginAt: new Date() },
    })
    .catch((err) =>
      console.error(
        "Failed to stamp lastMobileLoginAt on session restore:",
        err
      )
    );

  return NextResponse.json(user);
}

export async function DELETE(request: Request) {
  const user = await getMobileUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admins can't self-delete from mobile — admin records power audit trails
  // (createdBy on notes, rules, templates, etc.) and deleting an admin breaks
  // those references. Another admin must handle admin removal via the web UI.
  if (user.role === "ADMIN") {
    return NextResponse.json(
      {
        error:
          "Admin accounts can't be deleted from the app. Please contact another admin.",
      },
      { status: 403 }
    );
  }

  try {
    await archiveAndAnonymizeUser(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mobile account self-delete failed:", error);
    return NextResponse.json(
      { error: "Could not delete account. Please try again or contact support." },
      { status: 500 }
    );
  }
}
