import { NextResponse } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth";
import { getDriverProfile } from "@/lib/van/drivers";

/**
 * GET /api/mobile/van/driver
 *
 * Whether this person may take a van out. The Drive tab's existence hangs on
 * this one answer, so it stays deliberately small — every signed-in user asks
 * it at launch, including the great majority who never drive.
 *
 * It answers for any signed-in user rather than only approved drivers: a
 * pending or suspended driver needs to be told where they stand, and a 403
 * cannot say that.
 */
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getDriverProfile(auth.userId);
  return NextResponse.json({
    status: profile?.status ?? null,
    statusNote: profile?.statusNote ?? null,
    canDrive: profile?.status === "APPROVED",
  });
}
