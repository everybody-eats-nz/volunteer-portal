import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { MAX_PLAUSIBLE_KM } from "./plausibility";
import { previewEndTrip, TripError, wouldWarn } from "./trips";

vi.mock("@/lib/prisma", () => ({
  prisma: { trip: { findUnique: vi.fn() } },
}));

const findUnique = vi.mocked(prisma.trip.findUnique);

const NOW = new Date("2026-09-08T02:00:00.000Z");
const HOUR = 3_600_000;

function openTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: "trip-1",
    driverId: "driver-1",
    status: "OPEN",
    startOdo: 100_000,
    startedAt: new Date(NOW.getTime() - 2 * HOUR),
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("previewEndTrip", () => {
  it("says nothing about an ordinary reading", async () => {
    findUnique.mockResolvedValue(openTrip() as never);

    await expect(
      previewEndTrip({
        tripId: "trip-1",
        userId: "driver-1",
        isAdmin: false,
        endOdo: 100_040,
        now: NOW,
      })
    ).resolves.toEqual({
      startOdo: 100_000,
      startedAt: openTrip().startedAt,
      distanceKm: 40,
      warning: null,
    });
  });

  it("returns the same sentence the office's exception list shows", async () => {
    findUnique.mockResolvedValue(openTrip() as never);

    const result = await previewEndTrip({
      tripId: "trip-1",
      userId: "driver-1",
      isAdmin: false,
      endOdo: 100_000 + MAX_PLAUSIBLE_KM + 1,
      now: NOW,
    });

    expect(result.warning).toContain("km/h");
    // The driver's warning and the admin exception must agree, always.
    expect(wouldWarn(openTrip(), 100_000 + MAX_PLAUSIBLE_KM + 1, NOW)).toBe(true);
  });

  it("refuses a reading at or below the start — the one hard stop", async () => {
    findUnique.mockResolvedValue(openTrip() as never);

    await expect(
      previewEndTrip({
        tripId: "trip-1",
        userId: "driver-1",
        isAdmin: false,
        endOdo: 100_000,
        now: NOW,
      })
    ).rejects.toMatchObject({ code: "END_BELOW_START" });
  });

  it("refuses somebody else's trip", async () => {
    findUnique.mockResolvedValue(openTrip() as never);

    await expect(
      previewEndTrip({
        tripId: "trip-1",
        userId: "someone-else",
        isAdmin: false,
        endOdo: 100_040,
        now: NOW,
      })
    ).rejects.toMatchObject({ code: "NOT_YOUR_TRIP" });
  });

  it("lets an admin close a trip they did not drive", async () => {
    findUnique.mockResolvedValue(openTrip() as never);

    await expect(
      previewEndTrip({
        tripId: "trip-1",
        userId: "an-admin",
        isAdmin: true,
        endOdo: 100_040,
        now: NOW,
      })
    ).resolves.toMatchObject({ warning: null });
  });

  it("refuses a trip that is already closed", async () => {
    findUnique.mockResolvedValue(openTrip({ status: "CLOSED" }) as never);

    await expect(
      previewEndTrip({
        tripId: "trip-1",
        userId: "driver-1",
        isAdmin: false,
        endOdo: 100_040,
        now: NOW,
      })
    ).rejects.toBeInstanceOf(TripError);
  });
});
