import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVanAdmin } from "@/lib/van/admin-guard";

/**
 * Organisations were the one piece of van reference data with no admin screen,
 * so the only way to add one was a seed run against the database. This is that
 * screen's back end.
 *
 * Two invariants it exists to protect, both of which a plain CRUD would break:
 *
 * `isCatchAll` is not editable from here at all. Exactly one row carries it,
 * the trip flow keys off it ("Other organisation", where the driver types the
 * borrower's name), and both a second one and none at all break that flow — so
 * it is neither settable on create nor clearable on update.
 *
 * Nothing is deleted. Vehicles, trips and driver profiles all point at an
 * organisation, so a delete either fails on the foreign key or takes history
 * with it. Retiring hides it from every picker and leaves the record intact.
 */

const nameField = z.string().trim().min(2).max(80);

const createSchema = z.object({
  name: nameField,
  isInternal: z.boolean().default(false),
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: nameField.optional(),
  isInternal: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/** Active, and not the catch-all: the ones a van or a driver can belong to. */
const SELECTABLE = { isActive: true, isCatchAll: false } as const;

export async function POST(request: Request) {
  const guard = await requireVanAdmin();
  if (guard.denied) return guard.denied;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Give it a name of at least two characters." },
      { status: 400 }
    );
  }

  try {
    const organisation = await prisma.organisation.create({
      data: { ...parsed.data, isCatchAll: false },
    });
    return NextResponse.json({ organisation }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "An organisation with that name already exists." },
      { status: 409 }
    );
  }
}

export async function PATCH(request: Request) {
  const guard = await requireVanAdmin();
  if (guard.denied) return guard.denied;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid change." }, { status: 400 });
  }
  const { id, ...fields } = parsed.data;

  const existing = await prisma.organisation.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "No such organisation." }, { status: 404 });
  }

  if (fields.isActive === false) {
    // Retiring the catch-all would leave a driver with a van out for a one-off
    // borrower nowhere to record who had it.
    if (existing.isCatchAll) {
      return NextResponse.json(
        { error: "This one holds the one-off borrowers. It cannot be retired." },
        { status: 400 }
      );
    }
    // The last one standing owns every van and every driver. Retiring it would
    // empty the "Belongs to" picker — the exact dead end this screen is for.
    const selectable = await prisma.organisation.count({ where: SELECTABLE });
    if (selectable <= 1) {
      return NextResponse.json(
        { error: "Vans and drivers need at least one organisation to belong to." },
        { status: 400 }
      );
    }
  }

  try {
    await prisma.organisation.update({ where: { id }, data: fields });
  } catch {
    return NextResponse.json(
      { error: "An organisation with that name already exists." },
      { status: 409 }
    );
  }

  const organisations = await prisma.organisation.findMany({
    orderBy: [{ isInternal: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ organisations });
}
