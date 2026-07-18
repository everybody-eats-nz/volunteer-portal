import { describe, it, expect } from "vitest";
import { safeParseLocations } from "./parse-availability";

describe("safeParseLocations", () => {
  it("parses a JSON array of locations", () => {
    expect(safeParseLocations('["Wellington","Glen Innes"]')).toEqual([
      "Wellington",
      "Glen Innes",
    ]);
  });

  it("returns an empty array for null, undefined, and blank input", () => {
    expect(safeParseLocations(null)).toEqual([]);
    expect(safeParseLocations(undefined)).toEqual([]);
    expect(safeParseLocations("   ")).toEqual([]);
  });

  it("keeps a legacy single plain-text location intact", () => {
    // safeParseAvailability would split "Glen Innes" into ["Glen", "Innes"].
    expect(safeParseLocations("Glen Innes")).toEqual(["Glen Innes"]);
  });

  it("splits legacy comma-separated locations preserving casing", () => {
    expect(safeParseLocations("Wellington, Glen Innes")).toEqual([
      "Wellington",
      "Glen Innes",
    ]);
  });

  it("drops non-string and empty entries from JSON arrays", () => {
    expect(safeParseLocations('["Wellington", 42, "", null, " Onehunga "]')).toEqual([
      "Wellington",
      "Onehunga",
    ]);
  });
});
