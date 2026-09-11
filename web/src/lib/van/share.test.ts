import { describe, it, expect } from "vitest";
import {
  assignShareHues,
  OTHER_HUE,
  OTHER_KEY,
  shareOf,
  SHARE_HUES,
} from "./share";

interface Row {
  org: string;
  label: string;
  distanceKm: number | null;
}

const row = (org: string, distanceKm: number | null): Row => ({
  org,
  label: org,
  distanceKm,
});

const keyOf = (r: Row) => r.org;
const labelOf = (r: Row) => r.label;

describe("assignShareHues", () => {
  it("gives the hues to the largest entities, in the ramp's fixed order", () => {
    const hues = assignShareHues(
      [row("small", 10), row("big", 500), row("mid", 100)],
      keyOf,
      labelOf
    );
    expect(hues.get("big")?.color).toBe(SHARE_HUES[0]);
    expect(hues.get("mid")?.color).toBe(SHARE_HUES[1]);
    expect(hues.get("small")?.color).toBe(SHARE_HUES[2]);
  });

  it("names at most as many entities as there are hues", () => {
    const rows = ["a", "b", "c", "d", "e", "f", "g"].map((o, i) =>
      row(o, 100 - i)
    );
    expect(assignShareHues(rows, keyOf, labelOf).size).toBe(SHARE_HUES.length);
  });

  it("breaks ties on the label, so the assignment is the same on every load", () => {
    const first = assignShareHues([row("zed", 50), row("abe", 50)], keyOf, labelOf);
    const second = assignShareHues([row("abe", 50), row("zed", 50)], keyOf, labelOf);
    expect(first.get("abe")?.color).toBe(SHARE_HUES[0]);
    expect(second.get("abe")?.color).toBe(SHARE_HUES[0]);
  });
});

describe("shareOf", () => {
  const all = [
    row("ee", 600),
    row("trust", 300),
    row("hopper", 100),
    row("tiny", 5),
  ];
  const hues = assignShareHues(all, keyOf, labelOf);

  it("totals kilometres and trips per entity, largest first", () => {
    const segments = shareOf(
      [row("ee", 100), row("ee", 200), row("trust", 400)],
      keyOf,
      labelOf,
      hues
    );
    expect(segments.map((s) => [s.label, s.km, s.trips])).toEqual([
      ["trust", 400, 1],
      ["ee", 300, 2],
    ]);
  });

  it("works out each share as a percentage of what is shown", () => {
    const segments = shareOf([row("ee", 750), row("trust", 250)], keyOf, labelOf, hues);
    expect(segments.map((s) => s.percent)).toEqual([75, 25]);
  });

  it("keeps an entity's colour when a filter removes the ones above it", () => {
    // Colour follows the entity, never its rank: narrowing to one van must not
    // repaint the organisations that survived.
    const wide = shareOf(all, keyOf, labelOf, hues);
    const narrow = shareOf([row("hopper", 100), row("tiny", 5)], keyOf, labelOf, hues);
    const colourOf = (segs: typeof wide, label: string) =>
      segs.find((s) => s.label === label)?.color;
    expect(colourOf(narrow, "hopper")).toBe(colourOf(wide, "hopper"));
    expect(colourOf(narrow, "hopper")).not.toBe(colourOf(narrow, "tiny"));
  });

  it("folds anything without a hue into one neutral remainder, always last", () => {
    const many = ["a", "b", "c", "d", "e", "f", "g"].map((o, i) => row(o, 100 - i));
    const segments = shareOf(many, keyOf, labelOf, assignShareHues(many, keyOf, labelOf));
    const last = segments[segments.length - 1];
    expect(last.key).toBe(OTHER_KEY);
    expect(last.color).toBe(OTHER_HUE);
    expect(last.trips).toBe(2);
    expect(last.km).toBe(95 + 94);
  });

  it("treats an open trip as no distance rather than dropping it", () => {
    const segments = shareOf([row("ee", null), row("ee", 40)], keyOf, labelOf, hues);
    expect(segments[0]).toMatchObject({ km: 40, trips: 2 });
  });

  it("returns no shares, not a divide by zero, when nothing has distance", () => {
    const segments = shareOf([row("ee", null)], keyOf, labelOf, hues);
    expect(segments[0].percent).toBe(0);
  });

  it("has nothing to show for no rows", () => {
    expect(shareOf([], keyOf, labelOf, hues)).toEqual([]);
  });
});
