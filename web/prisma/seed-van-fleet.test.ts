import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  seedVanFleet,
  VAN_FLEET,
  VAN_ORGANISATIONS,
  VAN_TRIP_PURPOSES,
} from "./seed-van-fleet";
import type { PrismaClient } from "../src/generated/client";

/**
 * The bug these cover: the van log shipped after every existing database
 * already had its restaurant locations, so seeding it behind a shared
 * "is this a brand new database" flag meant the reference data never landed
 * there — no organisations, and so an admin could not add a van at all.
 *
 * What matters is therefore not that the seed writes rows, but *when* it
 * declines to: it has to fill a gap on a live database without overwriting
 * anything an admin has since changed.
 */

/** Counts stand in for a database; every write is recorded, none are applied. */
function fakePrisma(counts: {
  organisation: number;
  tripPurpose: number;
  vehicle: number;
  /** Organisations the fallback lookup can see, if any. */
  selectable?: Array<{ id: string; name: string }>;
}) {
  const selectable = counts.selectable ?? [];
  return {
    organisation: {
      count: vi.fn().mockResolvedValue(counts.organisation),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
      findFirst: vi.fn().mockResolvedValue(selectable[0] ?? null),
      findUnique: vi.fn(({ where }: { where: { name: string } }) =>
        Promise.resolve(selectable.find((o) => o.name === where.name) ?? null)
      ),
    },
    tripPurpose: {
      count: vi.fn().mockResolvedValue(counts.tripPurpose),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    vehicle: {
      count: vi.fn().mockResolvedValue(counts.vehicle),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

type FakePrisma = ReturnType<typeof fakePrisma>;
const asClient = (fake: FakePrisma) => fake as unknown as PrismaClient;

/** The van rows a run handed to createMany, flattened out of the call args. */
const vansWritten = (fake: FakePrisma): Array<{ ownerOrgId: string }> =>
  fake.vehicle.createMany.mock.calls.flatMap((call) => call[0].data);

const SEEDED_ORGS = VAN_ORGANISATIONS.map((o) => ({
  id: `id-${o.name}`,
  name: o.name,
}));

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("seedVanFleet", () => {
  it("fills every table on a database that has none of it", async () => {
    const prisma = fakePrisma({
      organisation: 0,
      tripPurpose: 0,
      vehicle: 0,
      selectable: SEEDED_ORGS,
    });

    await seedVanFleet(asClient(prisma));

    expect(prisma.organisation.createMany).toHaveBeenCalledOnce();
    expect(prisma.tripPurpose.createMany).toHaveBeenCalledOnce();
    expect(vansWritten(prisma)).toHaveLength(VAN_FLEET.length);
  });

  it("fills only the table that is empty, so a partial database catches up", async () => {
    // The shape an existing deployment is actually in: organisations arrived
    // with an earlier seed, the fleet never did.
    const prisma = fakePrisma({
      organisation: VAN_ORGANISATIONS.length,
      tripPurpose: VAN_TRIP_PURPOSES.length,
      vehicle: 0,
      selectable: SEEDED_ORGS,
    });

    await seedVanFleet(asClient(prisma));

    expect(prisma.organisation.createMany).not.toHaveBeenCalled();
    expect(prisma.tripPurpose.createMany).not.toHaveBeenCalled();
    expect(vansWritten(prisma)).toHaveLength(VAN_FLEET.length);
  });

  it("writes nothing on a database that already has the lot", async () => {
    const prisma = fakePrisma({
      organisation: VAN_ORGANISATIONS.length,
      tripPurpose: VAN_TRIP_PURPOSES.length,
      vehicle: VAN_FLEET.length,
      selectable: SEEDED_ORGS,
    });

    await seedVanFleet(asClient(prisma));

    expect(prisma.organisation.createMany).not.toHaveBeenCalled();
    expect(prisma.tripPurpose.createMany).not.toHaveBeenCalled();
    expect(prisma.vehicle.createMany).not.toHaveBeenCalled();
  });

  it("skips duplicate organisations rather than dying, if two seeds race", async () => {
    // The count and the insert are two statements, not one transaction.
    const prisma = fakePrisma({ organisation: 0, tripPurpose: 0, vehicle: 1 });

    await seedVanFleet(asClient(prisma));

    expect(prisma.organisation.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
  });

  it("skips duplicate vans too, which is where the race actually lands", async () => {
    // Proven against a real database: with only the organisations guarded, a
    // second seed gets past them and dies on the unique registration instead.
    const prisma = fakePrisma({
      organisation: 0,
      tripPurpose: 0,
      vehicle: 0,
      selectable: SEEDED_ORGS,
    });

    await seedVanFleet(asClient(prisma));

    expect(prisma.vehicle.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
  });

  it("parks the fleet under whatever organisation exists when the named one does not", async () => {
    // An admin renamed "Everybody Eats" away. The seed must not throw: a van
    // under the wrong owner is one dropdown away from correct.
    const renamed = [{ id: "id-renamed", name: "EE Charitable Trust" }];
    const prisma = fakePrisma({
      organisation: 1,
      tripPurpose: 1,
      vehicle: 0,
      selectable: renamed,
    });

    await seedVanFleet(asClient(prisma));

    const written = vansWritten(prisma);
    expect(written).toHaveLength(VAN_FLEET.length);
    for (const van of written) {
      expect(van.ownerOrgId).toBe("id-renamed");
    }
  });

  it("leaves the fleet alone rather than throwing when no organisation can own it", async () => {
    // Every organisation is retired or is the catch-all, so none may own a van.
    const prisma = fakePrisma({ organisation: 1, tripPurpose: 1, vehicle: 0 });

    await expect(seedVanFleet(asClient(prisma))).resolves.toBeUndefined();
    expect(prisma.vehicle.createMany).not.toHaveBeenCalled();
  });
});
