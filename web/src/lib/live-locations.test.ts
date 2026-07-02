import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLiveLocationsUncached } from "./live-locations";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shift: { findMany: vi.fn() },
    location: { findMany: vi.fn(), updateMany: vi.fn() },
  },
}));

const shiftFindMany = vi.mocked(prisma.shift.findMany);
const locationFindMany = vi.mocked(prisma.location.findMany);
const locationUpdateMany = vi.mocked(prisma.location.updateMany);

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);

function locationRow(overrides: {
  id: string;
  name: string;
  launchedAt?: Date | null;
  isActive?: boolean;
  isPopup?: boolean;
  address?: string;
}) {
  return {
    id: overrides.id,
    name: overrides.name,
    address: overrides.address ?? `${overrides.name} address`,
    isActive: overrides.isActive ?? true,
    isPopup: overrides.isPopup ?? false,
    launchedAt: overrides.launchedAt ?? null,
  };
}

describe("getLiveLocationsUncached", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationUpdateMany.mockResolvedValue({ count: 0 });
  });

  it("hides locations that have no upcoming shifts yet", async () => {
    shiftFindMany.mockResolvedValue([{ location: "Wellington" }] as never);
    locationFindMany.mockResolvedValue([
      locationRow({ id: "1", name: "Wellington", launchedAt: daysAgo(400) }),
      locationRow({ id: "2", name: "Hamilton" }), // created ahead of its shifts
    ] as never);

    const result = await getLiveLocationsUncached();

    expect(result.map((l) => l.name)).toEqual(["Wellington"]);
    // Hamilton has no upcoming shifts, so it must not be stamped as launched.
    expect(locationUpdateMany).not.toHaveBeenCalled();
  });

  it("stamps launchedAt and flags isNew when shifts first appear", async () => {
    shiftFindMany.mockResolvedValue([
      { location: "Wellington" },
      { location: "Hamilton" },
    ] as never);
    locationFindMany.mockResolvedValue([
      locationRow({ id: "1", name: "Wellington", launchedAt: daysAgo(400) }),
      locationRow({ id: "2", name: "Hamilton" }),
    ] as never);

    const result = await getLiveLocationsUncached();

    expect(locationUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["2"] } },
      data: { launchedAt: expect.any(Date) },
    });
    expect(result).toEqual([
      expect.objectContaining({ name: "Hamilton", isNew: true }),
      expect.objectContaining({ name: "Wellington", isNew: false }),
    ]);
  });

  it("drops the New flag once the launch window has passed", async () => {
    shiftFindMany.mockResolvedValue([
      { location: "Recent" },
      { location: "Older" },
    ] as never);
    locationFindMany.mockResolvedValue([
      locationRow({ id: "1", name: "Recent", launchedAt: daysAgo(5) }),
      locationRow({ id: "2", name: "Older", launchedAt: daysAgo(45) }),
    ] as never);

    const result = await getLiveLocationsUncached();

    expect(result).toEqual([
      expect.objectContaining({ name: "Older", isNew: false }),
      expect.objectContaining({ name: "Recent", isNew: true }),
    ]);
    expect(locationUpdateMany).not.toHaveBeenCalled();
  });

  it("excludes disabled locations even when they still have upcoming shifts", async () => {
    shiftFindMany.mockResolvedValue([
      { location: "Wellington" },
      { location: "Closed Venue" },
    ] as never);
    locationFindMany.mockResolvedValue([
      locationRow({ id: "1", name: "Wellington", launchedAt: daysAgo(400) }),
      locationRow({
        id: "2",
        name: "Closed Venue",
        isActive: false,
        launchedAt: daysAgo(400),
      }),
    ] as never);

    const result = await getLiveLocationsUncached();

    expect(result.map((l) => l.name)).toEqual(["Wellington"]);
  });

  it("keeps ad-hoc shift venues without a Location row, never flagged new", async () => {
    shiftFindMany.mockResolvedValue([
      { location: "  Pop-up   Night " }, // whitespace normalized
    ] as never);
    locationFindMany.mockResolvedValue([] as never);

    const result = await getLiveLocationsUncached();

    expect(result).toEqual([
      { name: "Pop-up Night", address: null, isPopup: false, isNew: false },
    ]);
    expect(locationUpdateMany).not.toHaveBeenCalled();
  });
});
