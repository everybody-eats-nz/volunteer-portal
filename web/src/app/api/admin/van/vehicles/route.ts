import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVanAdmin } from "@/lib/van/admin-guard";

const vehicleFields = {
  name: z.string().trim().min(2).max(60),
  rego: z.string().trim().min(2).max(10),
  homeCity: z.string().trim().min(2).max(60),
  photoUrl: z.string().trim().max(500).nullable(),
  ownerOrgId: z.string().min(1),
};

const createSchema = z.object(vehicleFields);
const updateSchema = z
  .object({ id: z.string().min(1), isActive: z.boolean().optional() })
  .extend({
    name: vehicleFields.name.optional(),
    rego: vehicleFields.rego.optional(),
    homeCity: vehicleFields.homeCity.optional(),
    photoUrl: vehicleFields.photoUrl.optional(),
    ownerOrgId: vehicleFields.ownerOrgId.optional(),
  });

/** Registrations are compared without spaces or case; NZ plates are neither. */
const normaliseRego = (rego: string) => rego.replace(/\s+/g, "").toUpperCase();

export async function POST(request: Request) {
  const guard = await requireVanAdmin();
  if (guard.denied) return guard.denied;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Fill in the name, rego and city." },
      { status: 400 }
    );
  }

  try {
    const vehicle = await prisma.vehicle.create({
      data: { ...parsed.data, rego: normaliseRego(parsed.data.rego) },
    });
    return NextResponse.json({ vehicle }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "A van with that rego already exists." },
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

  // Retiring a van it is still out in would strand the open trip and the
  // driver holding it.
  if (fields.isActive === false) {
    const open = await prisma.trip.count({
      where: { vehicleId: id, status: "OPEN" },
    });
    if (open > 0) {
      return NextResponse.json(
        { error: "That van is out. End its trip before retiring it." },
        { status: 400 }
      );
    }
  }

  try {
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: fields.rego
        ? { ...fields, rego: normaliseRego(fields.rego) }
        : fields,
    });
    return NextResponse.json({ vehicle });
  } catch {
    return NextResponse.json(
      { error: "Could not save. That rego may already be taken." },
      { status: 409 }
    );
  }
}
