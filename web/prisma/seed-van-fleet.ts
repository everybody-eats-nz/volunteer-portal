import type { PrismaClient } from "../src/generated/client";

/**
 * Reference data for the van mileage log: the organisations a van gets used
 * for, the purposes drivers pick from, and the fleet itself.
 *
 * Shared by the production and demo seeds so the fleet is defined once. Every
 * row here is upserted by natural key and safe to re-run, but — like the
 * restaurant locations — the vans and organisations are only *created* on first
 * boot. Names and regos are admin-editable, and re-running a name-keyed upsert
 * against a live database would resurrect anything an admin had renamed.
 */

export const VAN_ORGANISATIONS = [
  { name: "Everybody Eats", isInternal: true, isCatchAll: false },
  { name: "Hopper Cafe", isInternal: true, isCatchAll: false },
  { name: "Sustainability Trust", isInternal: false, isCatchAll: false },
  // Not a real organisation. Holds trips whose borrower is a genuine one-off,
  // named in Trip.externalOrgName. Never offered to drivers as itself.
  { name: "Other organisation", isInternal: false, isCatchAll: true },
] as const;

export const VAN_TRIP_PURPOSES = [
  // Order is not cosmetic: whatever sits first is a one-tap trip.
  { label: "Food Rescue", sortOrder: 1, requiresNote: false, isActive: true },
  {
    label: "Catering Delivery",
    sortOrder: 2,
    requiresNote: false,
    isActive: true,
  },
  { label: "Event Delivery", sortOrder: 3, requiresNote: false, isActive: true },
  // The one that asks for free text. Flagged by a column rather than by
  // matching the label, so renaming it does not break the prompt.
  { label: "Other", sortOrder: 4, requiresNote: true, isActive: true },
] as const;

/**
 * The two vans in service.
 *
 * PLACEHOLDER NAMES AND REGISTRATIONS. These are carried over from the design
 * prototype and are not the real plates — an admin corrects them on
 * /admin/van/vehicles before the stickers are printed, which is why that screen
 * exists. The QR sticker encodes the row id, not the rego, so fixing a name or
 * a plate never invalidates a sticker already stuck to a dashboard.
 */
export const VAN_FLEET = [
  {
    name: "Kai Van",
    rego: "GNP417",
    homeCity: "Wellington",
    ownerOrgName: "Everybody Eats",
    // No photo: the fleet list draws its own placeholder for a van that has
    // none, and seeding one in made every seeded van look like it had a
    // photograph when it did not. An admin uploads the real one.
    photoUrl: null,
  },
  {
    name: "Tāmaki Van",
    rego: "DLR906",
    homeCity: "Auckland",
    ownerOrgName: "Everybody Eats",
    photoUrl: null,
  },
] as const;

export async function seedVanFleet(prisma: PrismaClient): Promise<void> {
  console.log("🚐 Seeding van mileage log reference data...");

  for (const org of VAN_ORGANISATIONS) {
    await prisma.organisation.upsert({
      where: { name: org.name },
      update: {},
      create: org,
    });
  }

  // Purposes have no natural unique key (an admin may legitimately want two
  // similarly named ones), so match on the label of an existing row.
  for (const purpose of VAN_TRIP_PURPOSES) {
    const existing = await prisma.tripPurpose.findFirst({
      where: { label: purpose.label },
      select: { id: true },
    });
    if (!existing) await prisma.tripPurpose.create({ data: purpose });
  }

  const everybodyEats = await prisma.organisation.findUniqueOrThrow({
    where: { name: "Everybody Eats" },
  });

  for (const van of VAN_FLEET) {
    const owner =
      van.ownerOrgName === "Everybody Eats"
        ? everybodyEats
        : await prisma.organisation.findUniqueOrThrow({
            where: { name: van.ownerOrgName },
          });

    await prisma.vehicle.upsert({
      where: { rego: van.rego },
      update: {},
      create: {
        name: van.name,
        rego: van.rego,
        homeCity: van.homeCity,
        photoUrl: van.photoUrl,
        ownerOrgId: owner.id,
      },
    });
  }

  console.log(
    `✅ Van log seeded: ${VAN_FLEET.length} vans, ${VAN_ORGANISATIONS.length} organisations, ${VAN_TRIP_PURPOSES.length} purposes`
  );
}
