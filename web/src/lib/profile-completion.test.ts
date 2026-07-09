import { describe, expect, it } from "vitest";
import {
  getMissingProfileFields,
  isProfileComplete,
  type ProfileCompletionInput,
} from "./profile-completion";

const completeProfile: ProfileCompletionInput = {
  firstName: "Aroha",
  phone: "021 123 4567",
  dateOfBirth: new Date("1994-03-12"),
  emergencyContactName: "Hemi Williams",
  emergencyContactPhone: "021 765 4321",
  volunteerAgreementAccepted: true,
  healthSafetyPolicyAccepted: true,
};

describe("isProfileComplete", () => {
  it("returns true when every required field is present", () => {
    expect(isProfileComplete(completeProfile)).toBe(true);
  });

  it("accepts an ISO string date of birth", () => {
    expect(
      isProfileComplete({ ...completeProfile, dateOfBirth: "1994-03-12" })
    ).toBe(true);
  });

  it.each([
    ["firstName", { firstName: null }],
    ["phone", { phone: "" }],
    ["dateOfBirth", { dateOfBirth: null }],
    ["emergencyContactName", { emergencyContactName: null }],
    ["emergencyContactPhone", { emergencyContactPhone: null }],
    ["volunteerAgreementAccepted", { volunteerAgreementAccepted: false }],
    ["healthSafetyPolicyAccepted", { healthSafetyPolicyAccepted: false }],
  ] as const)("returns false when %s is missing", (_field, override) => {
    expect(isProfileComplete({ ...completeProfile, ...override })).toBe(false);
  });
});

describe("getMissingProfileFields", () => {
  it("returns an empty list for a complete profile", () => {
    expect(getMissingProfileFields(completeProfile)).toEqual([]);
  });

  it("labels every missing field for an empty profile", () => {
    expect(getMissingProfileFields({})).toEqual([
      "First name",
      "Mobile number",
      "Date of birth",
      "Emergency contact name",
      "Emergency contact phone",
      "Volunteer agreement",
      "Health & safety policy",
    ]);
  });

  it("only lists the fields that are actually missing", () => {
    expect(
      getMissingProfileFields({
        ...completeProfile,
        phone: null,
        dateOfBirth: null,
      })
    ).toEqual(["Mobile number", "Date of birth"]);
  });

  it("agrees with isProfileComplete", () => {
    expect(getMissingProfileFields(completeProfile)).toHaveLength(0);
    const incomplete = { ...completeProfile, dateOfBirth: null };
    expect(isProfileComplete(incomplete)).toBe(false);
    expect(getMissingProfileFields(incomplete).length).toBeGreaterThan(0);
  });
});
