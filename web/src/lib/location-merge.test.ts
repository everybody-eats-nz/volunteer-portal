import { describe, it, expect } from "vitest";
import { partitionShiftsForMerge, shiftMergeKey } from "./location-merge";

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
