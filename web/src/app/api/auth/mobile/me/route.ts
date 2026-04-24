import { NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { archiveAndAnonymizeUser } from "@/lib/user-service";

export async function GET(request: Request) {
  const user = await getMobileUser(request);

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

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
