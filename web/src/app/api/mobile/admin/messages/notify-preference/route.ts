import { NextResponse } from "next/server";
import { requireMobileAdmin } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET/PUT /api/mobile/admin/messages/notify-preference
 *
 * Per-admin opt-in for "push me when a volunteer messages the team". Stored on
 * the user (`adminMessageNotifications`) so it follows the account across
 * devices. Off by default. Toggled from the mobile admin messages screen.
 */
export async function GET(req: Request) {
  const auth = await requireMobileAdmin(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { adminMessageNotifications: true },
  });

  return NextResponse.json({ enabled: user?.adminMessageNotifications ?? false });
}

export async function PUT(req: Request) {
  const auth = await requireMobileAdmin(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let enabled: boolean;
  try {
    const json = (await req.json()) as { enabled?: unknown };
    if (typeof json.enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled (boolean) is required" },
        { status: 400 }
      );
    }
    enabled = json.enabled;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: auth.userId },
    data: { adminMessageNotifications: enabled },
  });

  return NextResponse.json({ enabled });
}
