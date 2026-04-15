import { describe, it, expect } from "vitest";
import { filterContent } from "./content-filter";

describe("filterContent", () => {
  it("returns null for clean text", () => {
    expect(filterContent("Great shift tonight, ka pai everyone!")).toBeNull();
    expect(filterContent("Looking forward to volunteering on Friday.")).toBeNull();
    expect(filterContent("")).toBeNull();
  });

  it("rejects text containing profanity", () => {
    expect(filterContent("what the fuck")).not.toBeNull();
    expect(filterContent("you piece of shit")).not.toBeNull();
    expect(filterContent("asshole")).not.toBeNull();
  });

  it("returns the user-facing error message string", () => {
    const result = filterContent("fucking hell");
    expect(typeof result).toBe("string");
    expect(result).toContain("not allowed");
  });

  it("catches mixed-case variations", () => {
    expect(filterContent("FUCK this")).not.toBeNull();
    expect(filterContent("Shit")).not.toBeNull();
  });

  it("does not flag common words that contain filter substrings", () => {
    // e.g. "classic", "cocktail", "assignment", "scrap" should be fine
    expect(filterContent("classic cocktail evening")).toBeNull();
    expect(filterContent("assignment completed")).toBeNull();
  });
});
