import { describe, expect, it } from "vitest";

import { countUnnamedVolunteers, normalizeSignupStatus } from "./signup-status";

describe("normalizeSignupStatus", () => {
  it("folds REGULAR_PENDING into PENDING", () => {
    expect(normalizeSignupStatus("REGULAR_PENDING")).toBe("PENDING");
    expect(normalizeSignupStatus("PENDING")).toBe("PENDING");
  });

  it("keeps confirmed and waitlisted as they are", () => {
    expect(normalizeSignupStatus("CONFIRMED")).toBe("CONFIRMED");
    expect(normalizeSignupStatus("WAITLISTED")).toBe("WAITLISTED");
  });

  it("treats a missing status as confirmed, for older API builds", () => {
    expect(normalizeSignupStatus(undefined)).toBe("CONFIRMED");
    expect(normalizeSignupStatus(null)).toBe("CONFIRMED");
  });
});

describe("countUnnamedVolunteers", () => {
  const statuses = [
    "CONFIRMED",
    "CONFIRMED",
    "CONFIRMED",
    "PENDING",
    "PENDING",
    "WAITLISTED",
  ] as const;

  it("subtracts the volunteers already listed by name", () => {
    expect(
      countUnnamedVolunteers({
        status: "CONFIRMED",
        signupStatuses: [...statuses],
        myStatus: null,
        namedCount: 1,
      })
    ).toBe(2);
  });

  it("subtracts the current user when they hold that status", () => {
    expect(
      countUnnamedVolunteers({
        status: "CONFIRMED",
        signupStatuses: [...statuses],
        myStatus: "CONFIRMED",
        namedCount: 1,
      })
    ).toBe(1);
  });

  it("does not subtract the current user from a status they don't hold", () => {
    expect(
      countUnnamedVolunteers({
        status: "PENDING",
        signupStatuses: [...statuses],
        myStatus: "CONFIRMED",
        namedCount: 0,
      })
    ).toBe(2);
  });

  it("counts pending and confirmed separately, ignoring the waitlist", () => {
    expect(
      countUnnamedVolunteers({
        status: "PENDING",
        signupStatuses: [...statuses],
        myStatus: "PENDING",
        namedCount: 1,
      })
    ).toBe(0);
  });

  it("never goes negative when more names are shown than the list holds", () => {
    expect(
      countUnnamedVolunteers({
        status: "CONFIRMED",
        signupStatuses: ["CONFIRMED"],
        myStatus: "CONFIRMED",
        namedCount: 2,
      })
    ).toBe(0);
  });
});
