import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVanAdmin } from "@/lib/van/admin-guard";
import {
  addDriverAsAdmin,
  isSelectableOrganisation,
  setDriverStatus,
} from "@/lib/van/drivers";

const decisionSchema = z.object({
  profileId: z.string().min(1),
  status: z.enum(["PENDING", "APPROVED", "SUSPENDED"]),
  statusNote: z.string().trim().max(500).nullable().default(null),
});

const addDriverSchema = z.object({
  userId: z.string().min(1),
  organisationId: z.string().min(1),
  licenceClass: z.string().trim().min(1).max(20).nullable().default(null),
  licenceExpiry: z.string().datetime().nullable().default(null),
});

/**
 * POST /api/admin/van/drivers
 *
 * Add somebody to the allowed list without waiting for them to fill in the
 * driver form. Most drivers still arrive by scanning the sticker; this is the
 * door for the person who is at the desk or on the phone.
 *
 * It is the same decision as approving from the queue and is recorded the same
 * way — an admin's id against the profile — so who vouched for a driver is
 * always answerable, whichever door they came through.
 */
export async function POST(request: Request) {
  const guard = await requireVanAdmin();
  if (guard.denied) return guard.denied;

  const parsed = addDriverSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the details and try again." },
      { status: 400 }
    );
  }

  // An archived account cannot be handed a van key. The user search already
  // excludes them, so this catches a stale dialog rather than a normal path.
  const user = await prisma.user.findFirst({
    where: { id: parsed.data.userId, archivedAt: null },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json(
      { error: "That account no longer exists." },
      { status: 404 }
    );
  }

  if (!(await isSelectableOrganisation(parsed.data.organisationId))) {
    return NextResponse.json(
      { error: "Pick an organisation from the list." },
      { status: 400 }
    );
  }

  const { profile, outcome } = await addDriverAsAdmin({
    userId: parsed.data.userId,
    organisationId: parsed.data.organisationId,
    licenceClass: parsed.data.licenceClass,
    licenceExpiry: parsed.data.licenceExpiry
      ? new Date(parsed.data.licenceExpiry)
      : null,
    adminUserId: guard.userId,
  });

  return NextResponse.json({ status: profile.status, outcome });
}

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
