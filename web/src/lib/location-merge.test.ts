import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn() } }));

import { prisma } from "@/lib/prisma";
import { ALL_REPORT_FIELDS } from "@/lib/day-reports";
import {
  applyLocationMerge,
  partitionShiftsForMerge,
  planMealCollision,
  shiftMergeKey,
} from "./location-merge";

type MockFn = ReturnType<typeof vi.fn>;

/**
 * A stand-in transaction client: every `model.method` is a lazily created
 * mock returning an empty result (no rows, zero counts), so a test only has
 * to stub the tables it is about.
 */
function mockDb() {
  const fns: Record<string, MockFn> = {};
  const empty = (method: string) => {
    if (method === "findMany") return [];
    if (method === "count") return 0;
    if (method.startsWith("find")) return null;
    return { count: 0 };
  };
  const fn = (model: string, method: string) =>
    (fns[`${model}.${method}`] ??= vi.fn(async () => empty(method)));
  const db = new Proxy(
    { $executeRaw: vi.fn(async () => 0) } as Record<string, unknown>,
    {
      get: (target, model: string) =>
        target[model] ??
        new Proxy({}, { get: (_, method: string) => fn(model, method) }),
    }
  );
  return { db, fn };
}

function shift(
  id: string,
  start: string,
  { signups = 0, placeholders = 0, type = "type-1" } = {}
) {
  return {
    id,
    shiftTypeId: type,
    start: new Date(start),
    end: new Date(new Date(start).getTime() + 4 * 60 * 60 * 1000),
    _count: { signups, placeholders },
  };
}

describe("partitionShiftsForMerge", () => {
  it("deletes empty shifts that have an identical twin at the target", () => {
    const twin = shift("target", "2026-08-10T05:00:00Z");
    const empty = shift("dup", "2026-08-10T05:00:00Z");
    const { toDelete, toRepoint, twinWarnings } = partitionShiftsForMerge(
      [empty],
      new Set([shiftMergeKey(twin)])
    );
    expect(toDelete.map((s) => s.id)).toEqual(["dup"]);
    expect(toRepoint).toEqual([]);
    expect(twinWarnings).toEqual([]);
  });

  it("repoints and flags twins that still hold signups or walk-ins", () => {
    const twin = shift("target", "2026-08-10T05:00:00Z");
    const busy = shift("busy", "2026-08-10T05:00:00Z", { signups: 2 });
    const walkIns = shift("walkins", "2026-08-10T05:00:00Z", {
      placeholders: 1,
    });
    const { toDelete, toRepoint, twinWarnings } = partitionShiftsForMerge(
      [busy, walkIns],
      new Set([shiftMergeKey(twin)])
    );
    expect(toDelete).toEqual([]);
    expect(toRepoint.map((s) => s.id)).toEqual(["busy", "walkins"]);
    expect(twinWarnings.map((s) => s.id)).toEqual(["busy", "walkins"]);
  });

  it("repoints shifts without a twin, empty or not", () => {
    const unique = shift("unique", "2026-08-12T05:00:00Z");
    const { toDelete, toRepoint, twinWarnings } = partitionShiftsForMerge(
      [unique],
      new Set()
    );
    expect(toDelete).toEqual([]);
    expect(toRepoint.map((s) => s.id)).toEqual(["unique"]);
    expect(twinWarnings).toEqual([]);
  });

  it("treats a different shift type or time as a different shift", () => {
    const twin = shift("target", "2026-08-10T05:00:00Z");
    const otherType = shift("other-type", "2026-08-10T05:00:00Z", {
      type: "type-2",
    });
    const otherTime = shift("other-time", "2026-08-10T06:00:00Z");
    const { toDelete, toRepoint } = partitionShiftsForMerge(
      [otherType, otherTime],
      new Set([shiftMergeKey(twin)])
    );
    expect(toDelete).toEqual([]);
    expect(toRepoint.map((s) => s.id)).toEqual(["other-type", "other-time"]);
  });
});

describe("applyLocationMerge day themes", () => {
  const day = (key: string) => new Date(`${key}T00:00:00.000Z`);

  it("repoints themes, keeping the target's theme on a same-day collision", async () => {
    const { db, fn } = mockDb();
    fn("location", "findUnique").mockImplementation(async ({ where }) =>
      where.name === "Wellington" ? { id: "loc-wgtn" } : null
    );
    fn("shiftDayTheme", "findMany").mockImplementation(async ({ where }) =>
      where.location === "Wellington (old)"
        ? [
            { id: "theme-dup", date: day("2026-12-23") },
            { id: "theme-only", date: day("2026-12-28") },
          ]
        : [{ date: day("2026-12-23") }]
    );
    (prisma.$transaction as unknown as MockFn).mockImplementation(
      async (run: (tx: unknown) => unknown) => run(db)
    );

    const plan = await applyLocationMerge("Wellington (old)", "Wellington");

    expect(plan.dayThemes).toEqual({
      total: 2,
      collisionDates: ["23 Dec 2026"],
    });
    const deleteMany = fn("shiftDayTheme", "deleteMany");
    const updateMany = fn("shiftDayTheme", "updateMany");
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["theme-dup"] } },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { location: "Wellington (old)" },
      data: { location: "Wellington" },
    });
    // The duplicate has to go before the repoint, or the (location, date)
    // unique constraint rejects it.
    expect(deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      updateMany.mock.invocationCallOrder[0]
    );
  });
});

describe("planMealCollision", () => {
  // A row as Prisma returns it: every column present, blank ones null.
  const blank: Record<string, unknown> = Object.fromEntries(
    [...ALL_REPORT_FIELDS, "mealsServed", "notes", "newVolunteers"].map(
      (field) => [field, null]
    )
  );
  const lines = (
    income: [number, number] = [0, 0],
    expenses: [number, number] = [0, 0]
  ) => ({
    income: { into: income[0], from: income[1] },
    expenses: { into: expenses[0], from: expenses[1] },
  });
  const none = lines();

  it("back-fills blanks within one report type", () => {
    const { data, move } = planMealCollision(
      { ...blank, reportType: "SERVICE_NIGHT", cash: 100 },
      { ...blank, reportType: "SERVICE_NIGHT", cash: 5, eftpos: 200, notes: "x" },
      none
    );
    expect(data).toEqual({ notes: "x", eftpos: 200 });
    expect(move).toEqual({ income: false, expenses: false });
  });

  it("never turns cafe takings into koha", () => {
    const { data } = planMealCollision(
      { ...blank, reportType: "SERVICE_NIGHT", cash: 100 },
      { ...blank, reportType: "CAFE", cash: 50, eftpos: 70, mealsServed: 30 },
      none
    );
    expect(data).toEqual({ mealsServed: 30 });
  });

  it("gives a blank survivor the duplicate's whole event, lines included", () => {
    const { data, move } = planMealCollision(
      { ...blank, reportType: "SERVICE_NIGHT", notes: "kept" },
      { ...blank, reportType: "EVENT", eventName: "Gala", notes: "dropped" },
      lines([0, 3], [0, 2])
    );
    expect(data).toEqual({ reportType: "EVENT", eventName: "Gala" });
    expect(move).toEqual({ income: true, expenses: true });
  });

  it("keeps the survivor's own event income and expenses", () => {
    expect(
      planMealCollision(
        { ...blank, reportType: "EVENT" },
        { ...blank, reportType: "EVENT" },
        lines([2, 3], [1, 4])
      ).move
    ).toEqual({ income: false, expenses: false });
  });

  it("fills in whichever kind of event line the survivor is missing", () => {
    expect(
      planMealCollision(
        { ...blank, reportType: "EVENT" },
        { ...blank, reportType: "EVENT" },
        lines([2, 3], [0, 4])
      ).move
    ).toEqual({ income: false, expenses: true });
  });
});
