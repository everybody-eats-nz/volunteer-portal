import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mealsServed: { aggregate: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

import {
  getPublicImpactStats,
  getActiveVolunteerCount,
  FOOD_SAVED_KG_PER_MEAL,
} from "./impact-stats";
import { prisma } from "./prisma";

const mockedAggregate = prisma.mealsServed.aggregate as unknown as ReturnType<
  typeof vi.fn
>;
const mockedQueryRaw = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>;

/** Mock the two parallel queries: meals aggregate + raw hours sum. */
function mockStats(opts: { mealsSum: number | null; seconds: number | null }) {
  mockedAggregate.mockResolvedValue({ _sum: { mealsServed: opts.mealsSum } });
  mockedQueryRaw.mockResolvedValue([{ seconds: opts.seconds }]);
}

describe("getPublicImpactStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero values when no data exists", async () => {
    mockStats({ mealsSum: null, seconds: 0 });

    const stats = await getPublicImpactStats();

    expect(stats.peopleServed).toBe(0);
    expect(stats.volunteerHours).toBe(0);
    expect(stats.foodSavedKg).toBe(0);
  });

  it("sums recorded meals into peopleServed", async () => {
    mockStats({ mealsSum: 279550, seconds: 0 });

    const stats = await getPublicImpactStats();

    expect(stats.peopleServed).toBe(279550);
  });

  it("derives foodSavedKg from peopleServed using the conversion factor", async () => {
    mockStats({ mealsSum: 279550, seconds: 0 });

    const stats = await getPublicImpactStats();

    expect(FOOD_SAVED_KG_PER_MEAL).toBe(0.5);
    expect(stats.foodSavedKg).toBe(
      Math.round(stats.peopleServed * FOOD_SAVED_KG_PER_MEAL)
    );
    expect(stats.foodSavedKg).toBe(139775);
    // Exposes the factor so consumers can show their own working.
    expect(stats.foodSavedKgPerMeal).toBe(FOOD_SAVED_KG_PER_MEAL);
  });

  it("converts seconds to whole hours, rounded to nearest hour", async () => {
    // 1417.5 hours -> 5_103_000 seconds, rounds up to 1418.
    mockStats({ mealsSum: 0, seconds: 1417.5 * 3600 });

    const stats = await getPublicImpactStats();

    expect(stats.volunteerHours).toBe(1418);
  });

  it("treats a null hours sum as zero", async () => {
    mockStats({ mealsSum: 0, seconds: null });

    const stats = await getPublicImpactStats();

    expect(stats.volunteerHours).toBe(0);
  });

  it("defends against an empty raw-query result set", async () => {
    mockedAggregate.mockResolvedValue({ _sum: { mealsServed: 10 } });
    mockedQueryRaw.mockResolvedValue([]);

    const stats = await getPublicImpactStats();

    expect(stats.volunteerHours).toBe(0);
    expect(stats.peopleServed).toBe(10);
  });

  it("stamps the payload with an ISO generatedAt timestamp", async () => {
    mockStats({ mealsSum: 1, seconds: 3600 });

    const stats = await getPublicImpactStats();

    expect(stats.generatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    expect(new Date(stats.generatedAt).toISOString()).toBe(stats.generatedAt);
  });
});

describe("getActiveVolunteerCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts distinct users with CONFIRMED finished shifts", async () => {
    mockedQueryRaw.mockResolvedValue([{ count: 42 }]);

    const count = await getActiveVolunteerCount(new Date());

    expect(count).toBe(42);
  });

  it("treats a null count as zero", async () => {
    mockedQueryRaw.mockResolvedValue([{ count: null }]);

    const count = await getActiveVolunteerCount(new Date());

    expect(count).toBe(0);
  });

  it("defends against an empty raw-query result set", async () => {
    mockedQueryRaw.mockResolvedValue([]);

    const count = await getActiveVolunteerCount(new Date());

    expect(count).toBe(0);
  });
});
