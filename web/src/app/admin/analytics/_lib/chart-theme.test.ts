import { describe, expect, it } from "vitest";
import { UNSPECIFIED_LOCATION } from "@/lib/recruitment-types";
import {
  chartTokens,
  colorForLocation,
  ordinalScale,
  plural,
  readableInk,
  segmentLabel,
  sequentialBins,
} from "./chart-theme";

describe("chart-theme", () => {
  const light = chartTokens("light");
  const dark = chartTokens("dark");

  describe("colorForLocation", () => {
    it("gives each known restaurant its own fixed slot", () => {
      const names = ["Wellington", "Glen Innes", "Onehunga", "Special Event Venue"];
      const colors = names.map((n) => colorForLocation(n, light));
      expect(new Set(colors).size).toBe(names.length);
      expect(colorForLocation("Wellington", light)).toBe(light.series[0]);
    });

    it("keeps a restaurant on the same slot in both modes", () => {
      const slot = (name: string, t = light) =>
        t.series.indexOf(colorForLocation(name, t));
      for (const name of ["Wellington", "Onehunga", "Somewhere New"]) {
        expect(slot(name, light)).toBe(slot(name, dark));
      }
    });

    it("is stable by name, not by position", () => {
      expect(colorForLocation("Somewhere New", light)).toBe(
        colorForLocation("Somewhere New", light)
      );
      expect(light.series).toContain(colorForLocation("Somewhere New", light));
    });

    it("keeps Unspecified neutral", () => {
      expect(colorForLocation(UNSPECIFIED_LOCATION, light)).toBe(
        light.palette.neutral
      );
      expect(light.series).not.toContain(light.palette.neutral);
    });
  });

  it("uses theme-aware grids instead of the old light-only #e5e7eb", () => {
    expect(light.grid).not.toBe(dark.grid);
    expect([light.grid, dark.grid]).not.toContain("#e5e7eb");
  });

  it("returns ordinal steps without repeats", () => {
    for (const n of [2, 4, 6]) {
      const steps = ordinalScale(n, light);
      expect(steps).toHaveLength(n);
      expect(new Set(steps).size).toBe(n);
    }
  });

  it("picks a readable ink for every heatmap bin", () => {
    expect(readableInk("#ffffff")).toBe("#14181c");
    expect(readableInk("#0e2a1c")).toBe("#ffffff");
    const bins = sequentialBins(light);
    expect(readableInk(bins[0])).toBe("#14181c");
    expect(readableInk(bins[bins.length - 1])).toBe("#ffffff");
  });

  it("hides labels on segments too small to hold them", () => {
    const format = segmentLabel([100, 40, 5]);
    expect(format(78)).toBe("78");
    expect(format(5)).toBe("");
    expect(format(0)).toBe("");
  });

  it("formats counts in en-NZ with singular and plural nouns", () => {
    expect(plural(1, "volunteer")).toBe("1 volunteer");
    expect(plural(1204, "volunteer")).toBe("1,204 volunteers");
  });
});
