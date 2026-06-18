import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mealsServed: { findMany: vi.fn(), aggregate: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

import { getPublicImpactStory } from "./impact-story";
import { prisma } from "./prisma";

const mockedFindMany = prisma.mealsServed.findMany as unknown as ReturnType<
  typeof vi.fn
>;
const mockedAggregate = prisma.mealsServed.aggregate as unknown as ReturnType<
  typeof vi.fn
>;
const mockedQueryRaw = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>;

type Row = {
  date: Date;
  location: string;
  mealsServed: number | null;
  nonPayingCount: number | null;
  newVolunteers: number | null;
  cash: number | null;
  eftpos: number | null;
  stripe: number | null;
};

function row(date: string, overrides: Partial<Row> = {}): Row {
  return {
    date: new Date(date),
    location: "Wellington",
    mealsServed: 100,
    nonPayingCount: 0,
    newVolunteers: 0,
    cash: 0,
    eftpos: 0,
    stripe: 0,
    ...overrides,
  };
}

/**
 * `getPublicImpactStory` issues three distinct `$queryRaw` calls (headline
 * hours sum, milestone ladder, distinct volunteer count). Route each by the
 * SQL it contains so a single mock can serve all three.
 */
function mockStory(opts: {
  rows: Row[];
  mealsSum?: number | null;
  hoursSeconds?: number | null;
  shiftCounts?: number[];
  volunteerCount?: number;
}) {
  mockedFindMany.mockResolvedValue(opts.rows);
  mockedAggregate.mockResolvedValue({
    _sum: { mealsServed: opts.mealsSum ?? null },
  });
  mockedQueryRaw.mockImplementation((strings: TemplateStringsArray) => {
    const sql = strings.join("");
    if (sql.includes("EXTRACT(EPOCH")) {
      return Promise.resolve([{ seconds: opts.hoursSeconds ?? 0 }]);
    }
    if (sql.includes("COUNT(DISTINCT")) {
      return Promise.resolve([
        { count: BigInt(opts.volunteerCount ?? 0) },
      ]);
    }
    // Milestone ladder: one { shifts } row per volunteer.
    return Promise.resolve((opts.shiftCounts ?? []).map((shifts) => ({ shifts })));
  });
}

describe("getPublicImpactStory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty aggregates when there is no data", async () => {
    mockStory({ rows: [] });

    const story = await getPublicImpactStory();

    expect(story.totals.nights).toBe(0);
    expect(story.totals.koha).toBe(0);
    expect(story.totals.perHead).toBeNull();
    expect(story.totals.firstNight).toBeNull();
    expect(story.totals.lastNight).toBeNull();
    expect(story.yearly).toEqual([]);
    expect(story.locations).toEqual([]);
    expect(story.weekday).toEqual([]);
  });

  it("aggregates a single service night", async () => {
    mockStory({
      rows: [
        row("2025-06-01T00:00:00.000Z", {
          mealsServed: 120,
          cash: 100,
          eftpos: 200,
          stripe: 300,
        }),
      ],
      mealsSum: 120,
    });

    const story = await getPublicImpactStory();

    expect(story.totals.nights).toBe(1);
    expect(story.totals.koha).toBe(600); // cash + eftpos + stripe
    expect(story.totals.meals).toBe(120); // from headline aggregate
    expect(story.totals.perHead).toBe(5); // 600 / 120
    expect(story.yearly).toHaveLength(1);
    expect(story.yearly[0].year).toBe(2025);
  });

  it("buckets a service night by its NZ calendar date, not UTC", async () => {
    // 2024-12-31T11:00:00Z is midnight Jan 1 2025 in NZ (NZDT, UTC+13) — the
    // way MealsServed.date is stored. A UTC slice would mis-bucket this into
    // 2024 / Tuesday; NZ time correctly yields 2025 / Wednesday.
    mockStory({
      rows: [
        row("2024-12-31T11:00:00.000Z", { mealsServed: 50, cash: 500 }),
      ],
      mealsSum: 50,
    });

    const story = await getPublicImpactStory();

    expect(story.yearly).toHaveLength(1);
    expect(story.yearly[0].year).toBe(2025);
    expect(story.totals.firstNight).toBe("2025-01-01");
    expect(story.totals.lastNight).toBe("2025-01-01");
    // Jan 1 2025 falls on a Wednesday (day index 3) in NZ.
    expect(story.weekday).toHaveLength(1);
    expect(story.weekday[0].day).toBe(3);
    expect(story.weekday[0].label).toBe("Wed");
  });

  it("computes perPaying and nonPaying% from non-paying customers", async () => {
    mockStory({
      rows: [
        row("2025-03-05T00:00:00.000Z", {
          mealsServed: 100,
          nonPayingCount: 20,
          cash: 800,
        }),
      ],
      mealsSum: 100,
    });

    const story = await getPublicImpactStory();

    expect(story.totals.perHead).toBe(8); // 800 / 100 customers
    expect(story.totals.perPaying).toBe(10); // 800 / (100 - 20) paying
    expect(story.totals.nonPayingPercent).toBe(20); // 20 / 100
  });

  it("reports the payment-tender mix as percentages of koha", async () => {
    mockStory({
      rows: [
        row("2025-02-01T00:00:00.000Z", {
          mealsServed: 100,
          cash: 500,
          eftpos: 300,
          stripe: 200,
        }),
      ],
      mealsSum: 100,
    });

    const story = await getPublicImpactStory();
    const year = story.yearly[0];

    expect(year.cashPercent).toBe(50);
    expect(year.eftposPercent).toBe(30);
    expect(year.digitalPercent).toBe(20);
  });

  it("counts volunteers at or above each milestone rung", async () => {
    mockStory({
      rows: [],
      // Volunteers with 5, 12, 30, 100, 250 completed shifts.
      shiftCounts: [5, 12, 30, 100, 250],
    });

    const story = await getPublicImpactStory();
    const byThreshold = Object.fromEntries(
      story.milestones.map((m) => [m.threshold, m.volunteers])
    );

    expect(byThreshold[10]).toBe(4); // 12, 30, 100, 250
    expect(byThreshold[25]).toBe(3); // 30, 100, 250
    expect(byThreshold[50]).toBe(2); // 100, 250
    expect(byThreshold[100]).toBe(2); // 100, 250
    expect(byThreshold[200]).toBe(1); // 250
  });

  it("ranks locations by customers served and tracks first year", async () => {
    mockStory({
      rows: [
        row("2023-05-01T00:00:00.000Z", { location: "Wellington", mealsServed: 50 }),
        row("2025-05-01T00:00:00.000Z", { location: "Auckland", mealsServed: 200 }),
        row("2024-05-01T00:00:00.000Z", { location: "Wellington", mealsServed: 60 }),
      ],
      mealsSum: 310,
    });

    const story = await getPublicImpactStory();

    expect(story.locations[0].name).toBe("Auckland"); // 200 > 110
    expect(story.locations[1].name).toBe("Wellington");
    const wellington = story.locations.find((l) => l.name === "Wellington")!;
    expect(wellington.firstYear).toBe(2023);
    expect(wellington.customers).toBe(110);
  });

  it("stamps the payload with an ISO generatedAt timestamp", async () => {
    mockStory({ rows: [] });

    const story = await getPublicImpactStory();

    expect(new Date(story.generatedAt).toISOString()).toBe(story.generatedAt);
  });
});
