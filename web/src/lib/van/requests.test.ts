import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { checkStartTripRequest, startTripSchema } from "./requests";

vi.mock("@/lib/prisma", () => ({
  prisma: { organisation: { findUnique: vi.fn() } },
}));

const findUnique = vi.mocked(prisma.organisation.findUnique);

const base = {
  vehicleId: "van-1",
  startOdo: 100_000,
  startOdoPhotoUrl: null,
  organisationId: "org-1",
  externalOrgName: null,
  purposeId: "purpose-1",
  purposeOther: null,
};

const org = (over: Record<string, unknown> = {}) =>
  ({ id: "org-1", isActive: true, isCatchAll: false, ...over }) as never;

beforeEach(() => vi.clearAllMocks());

describe("startTripSchema", () => {
  it("accepts a trip with no photo — the photo never gates the reading", () => {
    expect(startTripSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a reading that is not a positive whole number", () => {
    expect(startTripSchema.safeParse({ ...base, startOdo: -1 }).success).toBe(false);
    expect(startTripSchema.safeParse({ ...base, startOdo: 1.5 }).success).toBe(false);
  });
});

describe("checkStartTripRequest", () => {
  it("passes an ordinary internal trip", async () => {
    findUnique.mockResolvedValue(org());
    await expect(checkStartTripRequest(base)).resolves.toBeNull();
  });

  it("insists the report can say what the van was doing", async () => {
    findUnique.mockResolvedValue(org());
    await expect(
      checkStartTripRequest({ ...base, purposeId: null, purposeOther: null })
    ).resolves.toBe("Say what the van is doing.");
  });

  it("refuses a retired organisation", async () => {
    findUnique.mockResolvedValue(org({ isActive: false }));
    await expect(checkStartTripRequest(base)).resolves.toBe(
      "That organisation is not on the list."
    );
  });

  it("only the catch-all row carries a typed-in borrower name", async () => {
    findUnique.mockResolvedValue(org());
    await expect(
      checkStartTripRequest({ ...base, externalOrgName: "Someone Else" })
    ).resolves.toBe("That organisation does not take a name.");
  });

  it("insists the catch-all names its borrower", async () => {
    findUnique.mockResolvedValue(org({ isCatchAll: true }));
    await expect(checkStartTripRequest(base)).resolves.toBe(
      "Say who is borrowing the van."
    );

    await expect(
      checkStartTripRequest({ ...base, externalOrgName: "Sustainability Trust" })
    ).resolves.toBeNull();
  });
});
