import { describe, it, expect } from "vitest";
import {
  requiresGuardianName,
  noteContainsGuardianName,
  validateGuardianRequirement,
} from "./guardian-validation";
import { GUARDIAN_REQUIRED_AGE } from "./utils";

/**
 * A date of birth that makes the volunteer exactly `years` old today
 * (their birthday was yesterday, so the age is unambiguous).
 */
function dateOfBirthForAge(years: number): Date {
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - years);
  dob.setDate(dob.getDate() - 1);
  return dob;
}

describe("requiresGuardianName", () => {
  it("requires a guardian at the threshold age", () => {
    expect(requiresGuardianName(dateOfBirthForAge(GUARDIAN_REQUIRED_AGE))).toBe(
      true
    );
  });

  it("requires a guardian below the threshold age", () => {
    expect(requiresGuardianName(dateOfBirthForAge(12))).toBe(true);
  });

  it("does not require a guardian just above the threshold age", () => {
    expect(
      requiresGuardianName(dateOfBirthForAge(GUARDIAN_REQUIRED_AGE + 1))
    ).toBe(false);
  });

  it("does not require a guardian for adults", () => {
    expect(requiresGuardianName(dateOfBirthForAge(30))).toBe(false);
  });

  it("passes when date of birth is missing (profile completion owns DOB)", () => {
    expect(requiresGuardianName(null)).toBe(false);
    expect(requiresGuardianName(undefined)).toBe(false);
  });
});

describe("noteContainsGuardianName", () => {
  it("accepts the standard client format", () => {
    expect(noteContainsGuardianName("Guardian: Jane Smith")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(noteContainsGuardianName("my GUARDIAN is Jane")).toBe(true);
  });

  it("accepts a guardian mention appended to another note", () => {
    expect(
      noteContainsGuardianName("First shift!\n\nGuardian: Jane Smith")
    ).toBe(true);
  });

  it("rejects notes without a guardian mention", () => {
    expect(noteContainsGuardianName("Looking forward to it")).toBe(false);
  });

  it("rejects missing or empty notes", () => {
    expect(noteContainsGuardianName(null)).toBe(false);
    expect(noteContainsGuardianName(undefined)).toBe(false);
    expect(noteContainsGuardianName("")).toBe(false);
  });
});

describe("validateGuardianRequirement", () => {
  const underageDob = dateOfBirthForAge(GUARDIAN_REQUIRED_AGE);

  it("rejects an underage signup with no note at all", () => {
    const result = validateGuardianRequirement(underageDob, null);
    expect(result).not.toBeNull();
    expect(result?.error).toBe("Guardian name required");
    expect(result?.message).toContain("guardian");
  });

  it("rejects an underage signup whose note does not name a guardian", () => {
    const result = validateGuardianRequirement(underageDob, "Excited to help");
    expect(result?.error).toBe("Guardian name required");
  });

  it("allows an underage signup whose note names a guardian", () => {
    expect(
      validateGuardianRequirement(underageDob, "Guardian: Jane Smith")
    ).toBeNull();
  });

  it("allows signups from volunteers above the threshold age without a note", () => {
    expect(
      validateGuardianRequirement(
        dateOfBirthForAge(GUARDIAN_REQUIRED_AGE + 1),
        null
      )
    ).toBeNull();
  });

  it("allows signups when date of birth is missing", () => {
    expect(validateGuardianRequirement(null, null)).toBeNull();
  });
});
