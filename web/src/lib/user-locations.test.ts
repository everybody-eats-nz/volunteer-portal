import { describe, it, expect } from "vitest";
import {
  getUserLocations,
  userMatchesTargetLocations,
} from "./user-locations";

describe("getUserLocations", () => {
  it("combines default location and available locations", () => {
    expect(
      getUserLocations({
        defaultLocation: "Wellington",
        availableLocations: JSON.stringify(["Wellington", "Glen Innes"]),
      })
    ).toEqual(["Wellington", "Glen Innes"]);
  });

  it("includes a default location missing from availableLocations", () => {
    expect(
      getUserLocations({
        defaultLocation: "Onehunga",
        availableLocations: JSON.stringify(["Wellington"]),
      })
    ).toEqual(["Wellington", "Onehunga"]);
  });

  it("handles a null availableLocations column", () => {
    expect(
      getUserLocations({
        defaultLocation: "Wellington",
        availableLocations: null,
      })
    ).toEqual(["Wellington"]);
  });

  it("handles a user with no locations at all", () => {
    expect(
      getUserLocations({ defaultLocation: null, availableLocations: null })
    ).toEqual([]);
  });

  it("tolerates legacy non-JSON availableLocations values", () => {
    expect(
      getUserLocations({
        defaultLocation: "Wellington",
        availableLocations: "Glen Innes",
      })
    ).toEqual(["Glen Innes", "Wellington"]);
  });

  it("preserves multi-word names in legacy comma-separated values", () => {
    expect(
      getUserLocations({
        defaultLocation: null,
        availableLocations: "Wellington, Glen Innes",
      })
    ).toEqual(["Wellington", "Glen Innes"]);
  });
});

describe("userMatchesTargetLocations", () => {
  const user = {
    defaultLocation: "Wellington",
    availableLocations: JSON.stringify(["Wellington", "Glen Innes"]),
  };

  it("treats an empty target list as all locations", () => {
    expect(userMatchesTargetLocations(user, [])).toBe(true);
  });

  it("matches on the default location", () => {
    expect(userMatchesTargetLocations(user, ["Wellington"])).toBe(true);
  });

  it("matches on a non-default available location", () => {
    expect(userMatchesTargetLocations(user, ["Glen Innes"])).toBe(true);
  });

  it("does not match a location the user isn't associated with", () => {
    expect(userMatchesTargetLocations(user, ["Onehunga"])).toBe(false);
  });

  it("does not match users with no locations against a targeted list", () => {
    expect(
      userMatchesTargetLocations(
        { defaultLocation: null, availableLocations: null },
        ["Wellington"]
      )
    ).toBe(false);
  });
});
