import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getBudgetTracking } from "./budget-tracking";
import { resolveBudgetPeriod } from "./budget-periods";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    location: { findMany: vi.fn() },
    locationBudget: { findMany: vi.fn() },
    mealsServed: { aggregate: vi.fn(), findMany: vi.fn() },
  },
}));

const locations = vi.mocked(prisma.location.findMany);
const budgetYears = vi.mocked(prisma.locationBudget.findMany);
const aggregate = vi.mocked(prisma.mealsServed.aggregate);
const nights = vi.mocked(prisma.mealsServed.findMany);

const TODAY = "2026-11-26";

/** A service night on an NZ date (NZDT, UTC+13, until 5 Apr 2026). */
function night(date: string, koha: number | null) {
  const [y, m, d] = date.split("-").map(Number);
  return {
    date: new Date(Date.UTC(y, m - 1, d) - 13 * 60 * 60 * 1000),
    location: "Wellington",
    mealsServed: 60,
    cash: koha,
    eftpos: null,
    stripe: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Wellington has a 2026/27 budget ($550 a night) but none for 2025/26.
  locations.mockResolvedValue([
    {
      id: "loc-1",
      name: "Wellington",
      budgets: [
        {
          year: 2027,
          annualTarget: 110_000,
          plannedServiceNights: 200,
          updatedAt: new Date("2026-04-01T00:00:00Z"),
        },
      ],
    },
  ] as never);
  budgetYears.mockResolvedValue([{ year: 2027 }] as never);
  aggregate.mockResolvedValue({ _min: { date: null } } as never);
  nights.mockResolvedValue([
    night("2026-03-31", 400), // 2025/26: no budget, banked but not scored
    night("2026-04-02", 600), // 2026/27: $550 target
    night("2026-04-03", null), // guests recorded, koha not banked yet
  ] as never);
});

describe("getBudgetTracking for a range crossing 1 April", () => {
  const period = resolveBudgetPeriod(
    { period: "week", date: "2026-04-01" },
    TODAY
  );

  it("scores each night against its own financial year's budget", async () => {
    const data = await getBudgetTracking(period, "Wellington");
    const selected = data.selected!;

    expect(selected.nights.map((n) => [n.date, n.target])).toEqual([
      ["2026-03-31", null],
      ["2026-04-02", 550],
      ["2026-04-03", 550],
    ]);
    expect(selected.range).toMatchObject({
      nightsHeld: 2,
      actual: 1000,
      scoredNights: 1,
      scoredActual: 600,
      target: 550,
      status: "green",
    });
    expect(selected.pendingNights).toBe(1);
  });

  it("keeps year-to-date figures to the year in view", async () => {
    const data = await getBudgetTracking(period, "Wellington");
    expect(data.year).toBe(2027);
    expect(data.selected!.progress).toMatchObject({
      nightsHeld: 1,
      ytdActual: 600,
      ytdTarget: 550,
    });
    expect(data.rangeTotals).toMatchObject({
      budgetedLocations: 1,
      actual: 1000,
      target: 550,
    });
  });

  it("loads budgets for every year the range touches", async () => {
    await getBudgetTracking(period, null);
    const where = locations.mock.calls[0][0]!.where!;
    expect(where.OR).toContainEqual({
      budgets: { some: { year: { in: [2027, 2026] } } },
    });
  });

  it("fetches only the period and the year in view", async () => {
    await getBudgetTracking(period, null);
    const where = nights.mock.calls[0][0]!.where! as {
      OR: Array<{ date: { gte: Date; lt: Date } }>;
    };
    expect(
      where.OR.map((w) => [w.date.gte.toISOString(), w.date.lt.toISOString()])
    ).toEqual([
      // Mon 30 Mar - Sun 5 Apr 2026 (DST ends on the 5th)
      ["2026-03-29T11:00:00.000Z", "2026-04-05T12:00:00.000Z"],
      // Financial year 2026/27
      ["2026-03-31T11:00:00.000Z", "2027-03-31T11:00:00.000Z"],
    ]);
  });
});

describe("getBudgetTracking for a financial year", () => {
  it("fetches the year once and computes no range", async () => {
    const data = await getBudgetTracking(
      resolveBudgetPeriod({ year: "2027" }, TODAY),
      "Wellington"
    );
    const where = nights.mock.calls[0][0]!.where! as { OR: unknown[] };
    expect(where.OR).toHaveLength(1);
    expect(data.rangeTotals).toBeNull();
    expect(data.selected!.range).toBeNull();
    expect(data.selected!.nights.map((n) => n.date)).toEqual([
      "2026-04-02",
      "2026-04-03",
    ]);
  });
});
