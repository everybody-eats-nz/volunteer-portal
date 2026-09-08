import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { addDriverAsAdmin, isSelectableOrganisation } from "./drivers";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    driverProfile: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    organisation: { findUnique: vi.fn() },
  },
}));

const findUnique = vi.mocked(prisma.driverProfile.findUnique);
const upsert = vi.mocked(prisma.driverProfile.upsert);
const findOrg = vi.mocked(prisma.organisation.findUnique);

beforeEach(() => {
  vi.clearAllMocks();
  upsert.mockResolvedValue({ status: "APPROVED" } as never);
});

const input = {
  userId: "user-1",
  organisationId: "org-1",
  licenceClass: null,
  licenceExpiry: null,
  adminUserId: "admin-1",
};

describe("addDriverAsAdmin", () => {
  it("creates an approved profile stamped with the admin who added them", async () => {
    findUnique.mockResolvedValue(null as never);

    const { outcome } = await addDriverAsAdmin(input);

    expect(outcome).toBe("created");
    const call = upsert.mock.calls[0][0];
    expect(call.create).toMatchObject({
      userId: "user-1",
      organisationId: "org-1",
      status: "APPROVED",
      // Who vouched for a driver has to be answerable whichever door they came
      // through, so this is stamped exactly like an approval from the queue.
      approvedById: "admin-1",
    });
  });

  it("leaves a driver who is already approved exactly as they are", async () => {
    findUnique.mockResolvedValue({ status: "APPROVED" } as never);

    const { outcome } = await addDriverAsAdmin({
      ...input,
      organisationId: "some-other-org",
    });

    expect(outcome).toBe("already-approved");
    // Re-adding somebody by mistake must not rewrite who approved them or move
    // them to another organisation.
    expect(upsert).not.toHaveBeenCalled();
  });

  it("approves somebody who is waiting, and lets a suspended driver back", async () => {
    for (const status of ["PENDING", "SUSPENDED"] as const) {
      vi.clearAllMocks();
      upsert.mockResolvedValue({ status: "APPROVED" } as never);
      findUnique.mockResolvedValue({ status } as never);

      const { outcome } = await addDriverAsAdmin(input);

      expect(outcome).toBe("approved");
      expect(upsert.mock.calls[0][0].update).toMatchObject({
        status: "APPROVED",
        approvedById: "admin-1",
        // Whatever the decline or hold said is answered by this decision.
        statusNote: null,
      });
    }
  });

  it("keeps the licence the driver sent when the office did not retype it", async () => {
    findUnique.mockResolvedValue({ status: "PENDING" } as never);

    await addDriverAsAdmin(input);

    const update = upsert.mock.calls[0][0].update as Record<string, unknown>;
    expect(update).not.toHaveProperty("licenceClass");
    expect(update).not.toHaveProperty("licenceExpiry");
  });

  it("records a licence the office does have", async () => {
    findUnique.mockResolvedValue({ status: "PENDING" } as never);
    const expiry = new Date("2028-03-01T00:00:00.000Z");

    await addDriverAsAdmin({ ...input, licenceClass: "2", licenceExpiry: expiry });

    expect(upsert.mock.calls[0][0].update).toMatchObject({
      licenceClass: "2",
      licenceExpiry: expiry,
    });
  });
});

describe("isSelectableOrganisation", () => {
  it("accepts an active organisation", async () => {
    findOrg.mockResolvedValue({ isActive: true, isCatchAll: false } as never);
    await expect(isSelectableOrganisation("org-1")).resolves.toBe(true);
  });

  it("rejects the catch-all, which is a bucket rather than somewhere to belong", async () => {
    findOrg.mockResolvedValue({ isActive: true, isCatchAll: true } as never);
    await expect(isSelectableOrganisation("org-1")).resolves.toBe(false);
  });

  it("rejects a retired organisation and one that does not exist", async () => {
    findOrg.mockResolvedValue({ isActive: false, isCatchAll: false } as never);
    await expect(isSelectableOrganisation("org-1")).resolves.toBe(false);

    findOrg.mockResolvedValue(null as never);
    await expect(isSelectableOrganisation("nope")).resolves.toBe(false);
  });
});
