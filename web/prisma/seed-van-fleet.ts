import type { PrismaClient } from "../src/generated/client";

/**
 * Reference data for the van mileage log: the organisations a van gets used
 * for, the purposes drivers pick from, and the fleet itself.
 *
 * Shared by the production and demo seeds so the fleet is defined once. Safe to
 * re-run: each group below is written only when its own table is still empty,
 * because names and regos are admin-editable and re-running a name-keyed upsert
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

  // Each group is gated on its own table being empty rather than on a shared
  // "is this a brand new database" flag. The van log shipped long after the
  // restaurant locations did, so on a database that predates it a location
  // count reads "not first boot" and this reference data never lands at all —
  // which leaves Organisation empty, and with it the "Belongs to" picker on
  // /admin/van/vehicles, so no van can be added. Gating per table lets an
  // existing database pick up what it is missing while still never
  // resurrecting a row an admin has since renamed or removed.
  if ((await prisma.organisation.count()) === 0) {
    await prisma.organisation.createMany({ data: [...VAN_ORGANISATIONS] });
    console.log(`   + ${VAN_ORGANISATIONS.length} organisations`);
  }

  if ((await prisma.tripPurpose.count()) === 0) {
    await prisma.tripPurpose.createMany({ data: [...VAN_TRIP_PURPOSES] });
    console.log(`   + ${VAN_TRIP_PURPOSES.length} trip purposes`);
  }

  if ((await prisma.vehicle.count()) === 0) {
    // Owners are resolved by name, but tolerantly: a database that already
    // carried organisations need not carry these ones, and a van parked under
    // the wrong org is a dropdown away from correct where a thrown seed is not.
    const fallbackOrg = await prisma.organisation.findFirst({
      where: { isActive: true, isCatchAll: false },
      orderBy: [{ isInternal: "desc" }, { name: "asc" }],
    });

    if (!fallbackOrg) {
      console.log("   ! No organisation to own a van — skipping the fleet");
      return;
    }

    for (const van of VAN_FLEET) {
      const owner =
        (await prisma.organisation.findUnique({
          where: { name: van.ownerOrgName },
        })) ?? fallbackOrg;

      await prisma.vehicle.create({
        data: {
          name: van.name,
          rego: van.rego,
          homeCity: van.homeCity,
          photoUrl: van.photoUrl,
          ownerOrgId: owner.id,
        },
      });
    }
    console.log(`   + ${VAN_FLEET.length} vans`);
  }

  console.log("✅ Van log reference data up to date");
}
