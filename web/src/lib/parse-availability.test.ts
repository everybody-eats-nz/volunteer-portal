import { describe, it, expect } from "vitest";
import {
  renameLocationInStoredList,
  safeParseLocations,
} from "./parse-availability";

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

describe("renameLocationInStoredList", () => {
  it("renames an entry in a JSON array list", () => {
    expect(
      renameLocationInStoredList(
        '["Wellington","Glen Innes"]',
        "Wellington",
        "Te Aro"
      )
    ).toBe('["Te Aro","Glen Innes"]');
  });

  it("normalizes legacy comma-separated lists to JSON while renaming", () => {
    expect(
      renameLocationInStoredList(
        "Wellington, Glen Innes",
        "Glen Innes",
        "Tāmaki"
      )
    ).toBe('["Wellington","Tāmaki"]');
  });

  it("returns null when the list doesn't reference the old name", () => {
    expect(
      renameLocationInStoredList(
        '["Glen Innes"]',
        "Wellington",
        "Te Aro"
      )
    ).toBeNull();
    expect(renameLocationInStoredList(null, "Wellington", "Te Aro")).toBeNull();
  });

  it("only matches whole entries, not substrings of other locations", () => {
    expect(
      renameLocationInStoredList(
        '["Wellington City"]',
        "Wellington",
        "Te Aro"
      )
    ).toBeNull();
  });

  it("dedupes when the new name was already in the list", () => {
    expect(
      renameLocationInStoredList(
        '["Wellington","Te Aro"]',
        "Wellington",
        "Te Aro"
      )
    ).toBe('["Te Aro"]');
  });
});
