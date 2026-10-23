import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shiftTypePhoto, type Photo } from "./shift-photos";

describe("shiftTypePhoto", () => {
  it("matches the app's photo for its named shift types", () => {
    expect(shiftTypePhoto("Kitchen Prep")).toBe("kitchen-prep");
    expect(shiftTypePhoto("Kitchen Service & Pack Down")).toBe("service-pass");
    expect(shiftTypePhoto("FOH Set-Up & Service")).toBe("foh-serving");
    expect(shiftTypePhoto("Dishwasher")).toBe("dishwasher");
    expect(shiftTypePhoto("Media Role")).toBe("community-table");
  });

  it("falls back to the app's keywords for location-prefixed names", () => {
    expect(shiftTypePhoto("Glen Innes Kitchen Prep")).toBe("kitchen-prep");
    expect(shiftTypePhoto("Glen Innes Dishwasher")).toBe("dishwasher");
    expect(shiftTypePhoto("Glen Innes Front of House")).toBe("foh-portrait");
    expect(shiftTypePhoto("Glen Innes Kitchen Service & Pack Down")).toBe(
      "kitchen-team"
    );
  });

  it("checks keywords in the app's order", () => {
    // "Kitchen Prep Open Access" is prep before it is kitchen.
    expect(shiftTypePhoto("Kitchen Prep Open Access")).toBe("kitchen-prep");
    expect(shiftTypePhoto("Front-of-House Helper")).toBe("foh-portrait");
  });

  it("uses the dining room for anything else", () => {
    expect(shiftTypePhoto("Kai Van")).toBe("dining-room");
  });

  it("has a file for every photo it can pick", () => {
    const photos: Photo[] = [
      "dining-room",
      "service-pass",
      "community-table",
      "dishwasher",
      "kitchen-prep",
      "kitchen-team",
      "chef-plating",
      "foh-serving",
      "foh-portrait",
      "crew-plates",
      "catering-spread",
      "serving-plates",
      "cafe-helpers",
    ];
    for (const photo of photos) {
      const file = path.join(
        __dirname,
        "../../../public/year-in-review",
        `${photo}.jpg`
      );
      expect(existsSync(file), file).toBe(true);
    }
  });
});
