import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVanAdmin } from "@/lib/van/admin-guard";
import { setDriverStatus } from "@/lib/van/drivers";

const decisionSchema = z.object({
  profileId: z.string().min(1),
  status: z.enum(["PENDING", "APPROVED", "SUSPENDED"]),
  statusNote: z.string().trim().max(500).nullable().default(null),
});

/**
 * PATCH /api/admin/van/drivers
 *
 * Approve, decline or suspend a driver. This is the client's stated security
 * requirement — "I don't just want anybody drives a van" — and it is the only
 * thing standing between an account and a van key, so it stays a deliberate
 * admin action with a name attached to it.
 */
export async function PATCH(request: Request) {
  const guard = await requireVanAdmin();
  if (guard.denied) return guard.denied;

  const parsed = decisionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
  }

  const profile = await setDriverStatus(
    parsed.data.profileId,
    parsed.data.status,
    guard.userId,
    parsed.data.statusNote
  );
  return NextResponse.json({ status: profile.status });
}
