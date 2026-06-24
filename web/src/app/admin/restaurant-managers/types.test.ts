import { describe, it, expect } from "vitest";
import {
  computeCoverage,
  getInitials,
  getUserDisplayName,
  sortCoverageByRisk,
  type Location,
  type ManagerUser,
  type RestaurantManager,
} from "./types";

function makeUser(overrides: Partial<ManagerUser> = {}): ManagerUser {
  return {
    id: "u1",
    email: "jane@example.com",
    firstName: null,
    lastName: null,
    name: null,
    role: "ADMIN",
    ...overrides,
  };
}

function makeManager(
  id: string,
  locations: string[],
  receiveNotifications: boolean,
  user: ManagerUser = makeUser({ id })
): RestaurantManager {
  return {
    id,
    userId: user.id,
    locations,
    receiveNotifications,
    createdAt: "",
    updatedAt: "",
    user,
  };
}

const LOCATIONS: Location[] = [
  { value: "Wellington", label: "Wellington" },
  { value: "Glen Innes", label: "Glen Innes" },
  { value: "Onehunga", label: "Onehunga" },
];

describe("getUserDisplayName", () => {
  it("prefers first + last name", () => {
    expect(
      getUserDisplayName(makeUser({ firstName: "Jane", lastName: "Doe" }))
    ).toBe("Jane Doe");
  });

  it("falls back to name, then email", () => {
    expect(getUserDisplayName(makeUser({ name: "Janey" }))).toBe("Janey");
    expect(getUserDisplayName(makeUser({ email: "x@y.nz" }))).toBe("x@y.nz");
  });
});

describe("getInitials", () => {
  it("uses first + last initials when available", () => {
    expect(
      getInitials(makeUser({ firstName: "Jane", lastName: "Doe" }))
    ).toBe("JD");
  });

  it("falls back to the first two characters of name/email", () => {
    expect(getInitials(makeUser({ name: "Aroha" }))).toBe("AR");
    expect(getInitials(makeUser({ name: null, email: "zed@x.nz" }))).toBe("ZE");
  });
});

describe("computeCoverage", () => {
  it("marks a location as a gap when no manager is assigned", () => {
    const coverage = computeCoverage(LOCATIONS, []);
    expect(coverage.every((c) => c.status === "gap")).toBe(true);
  });

  it("marks a location as active when at least one assigned manager receives alerts", () => {
    const managers = [makeManager("m1", ["Wellington"], true)];
    const wgtn = computeCoverage(LOCATIONS, managers).find(
      (c) => c.location === "Wellington"
    )!;
    expect(wgtn.status).toBe("active");
    expect(wgtn.activeRecipients).toHaveLength(1);
    expect(wgtn.mutedRecipients).toHaveLength(0);
  });

  it("marks a location as muted only when every assigned manager is muted", () => {
    const managers = [makeManager("m1", ["Onehunga"], false)];
    const onehunga = computeCoverage(LOCATIONS, managers).find(
      (c) => c.location === "Onehunga"
    )!;
    expect(onehunga.status).toBe("muted");
    expect(onehunga.mutedRecipients).toHaveLength(1);
  });

  it("stays active when one recipient is muted but another is live", () => {
    const managers = [
      makeManager("m1", ["Glen Innes"], true),
      makeManager("m2", ["Glen Innes"], false),
    ];
    const gi = computeCoverage(LOCATIONS, managers).find(
      (c) => c.location === "Glen Innes"
    )!;
    expect(gi.status).toBe("active");
    expect(gi.activeRecipients).toHaveLength(1);
    expect(gi.mutedRecipients).toHaveLength(1);
  });
});

describe("sortCoverageByRisk", () => {
  it("orders gaps first, then muted, then active; alphabetical within a tier", () => {
    const managers = [
      makeManager("m1", ["Wellington"], true), // active
      makeManager("m2", ["Glen Innes"], false), // muted
      // Onehunga has none -> gap
    ];
    const sorted = sortCoverageByRisk(computeCoverage(LOCATIONS, managers));
    expect(sorted.map((c) => c.location)).toEqual([
      "Onehunga", // gap
      "Glen Innes", // muted
      "Wellington", // active
    ]);
  });
});
