import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/services/expo-push";
import {
  QUIET_HOURS,
  remindLeftOpenTrips,
  withinSendingHours,
} from "./reminders";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trip: { findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/services/expo-push", () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));

const findMany = vi.mocked(prisma.trip.findMany);
const update = vi.mocked(prisma.trip.update);
const push = vi.mocked(sendPushToUser);

/** 10am NZ on a Wednesday — inside the sending window. */
const NOW = new Date("2026-09-09T22:00:00.000Z");
const HOUR = 3_600_000;

function openTrip(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "trip-1",
    vehicleId: "van-1",
    driverId: "driver-1",
    startedAt: new Date(NOW.getTime() - 20 * HOUR),
    endedAt: null,
    startOdo: 1000,
    endOdo: null,
    startOdoPhotoUrl: "https://example.test/odo.jpg",
    endOdoPhotoUrl: null,
    distanceKm: null,
    status: "OPEN",
    endedByUserId: null,
    reminderSentAt: null,
    vehicle: { id: "van-1", name: "Kōwhai" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  update.mockResolvedValue({} as never);
});

describe("withinSendingHours", () => {
  it("sends during the NZ day and stays quiet overnight", () => {
    // 10am NZ.
    expect(withinSendingHours(NOW)).toBe(true);
    // 11pm NZ — the hour a trip started at 9am crosses the left-open line.
    expect(withinSendingHours(new Date("2026-09-09T11:00:00.000Z"))).toBe(false);
    // 3am NZ.
    expect(withinSendingHours(new Date("2026-09-09T15:00:00.000Z"))).toBe(false);
  });
});

describe("remindLeftOpenTrips", () => {
  it("nudges the driver of a trip the left-open rule names", async () => {
    findMany.mockResolvedValue([openTrip()] as never);

    const result = await remindLeftOpenTrips(NOW);

    expect(result).toEqual({ found: 1, sent: 1, skipped: null });
    expect(push).toHaveBeenCalledWith(
      "driver-1",
      expect.objectContaining({
        title: expect.stringContaining("Kōwhai"),
        data: { actionUrl: "/drive/trip/trip-1" },
      })
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: "trip-1" },
      data: { reminderSentAt: NOW },
    });
  });

  it("leaves a trip that is only a few hours old alone", async () => {
    findMany.mockResolvedValue([
      openTrip({ startedAt: new Date(NOW.getTime() - 2 * HOUR) }),
    ] as never);

    const result = await remindLeftOpenTrips(NOW);

    expect(result).toEqual({ found: 0, sent: 0, skipped: null });
    expect(push).not.toHaveBeenCalled();
  });

  it("does not nudge twice inside the quiet window", async () => {
    findMany.mockResolvedValue([
      openTrip({ reminderSentAt: new Date(NOW.getTime() - 1 * HOUR) }),
    ] as never);

    const result = await remindLeftOpenTrips(NOW);

    expect(result).toEqual({ found: 1, sent: 0, skipped: null });
    expect(push).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("nudges again once the quiet window has passed", async () => {
    findMany.mockResolvedValue([
      openTrip({
        reminderSentAt: new Date(NOW.getTime() - (QUIET_HOURS + 1) * HOUR),
      }),
    ] as never);

    const result = await remindLeftOpenTrips(NOW);

    expect(result).toEqual({ found: 1, sent: 1, skipped: null });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("finds the trip but holds the push overnight", async () => {
    findMany.mockResolvedValue([openTrip()] as never);

    const result = await remindLeftOpenTrips(
      new Date("2026-09-09T14:00:00.000Z") // 2am NZ
    );

    expect(result).toEqual({
      found: 1,
      sent: 0,
      skipped: "outside-sending-hours",
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("does nothing when no van is out", async () => {
    findMany.mockResolvedValue([] as never);
    await expect(remindLeftOpenTrips(NOW)).resolves.toEqual({
      found: 0,
      sent: 0,
      skipped: null,
    });
  });
});
