import { describe, it, expect } from "vitest";
import {
  FIRST_SHIFT_BADGE,
  NEW_VOLUNTEER_BADGE,
  VOLUNTEER_GRADE_INFO,
  getDisplayGradeInfo,
  isNewVolunteer,
} from "./volunteer-grades";

describe("getDisplayGradeInfo", () => {
  it("shows First shift before anything is completed", () => {
    expect(getDisplayGradeInfo("GREEN", 0)).toBe(FIRST_SHIFT_BADGE);
  });

  it("shows New volunteer on the 2nd and 3rd shifts only", () => {
    expect(getDisplayGradeInfo("GREEN", 1)).toBe(NEW_VOLUNTEER_BADGE);
    expect(getDisplayGradeInfo("PINK", 2)).toBe(NEW_VOLUNTEER_BADGE);
  });

  it("shows the real grade from the 4th shift on", () => {
    expect(getDisplayGradeInfo("YELLOW", 3)).toBe(VOLUNTEER_GRADE_INFO.YELLOW);
    expect(getDisplayGradeInfo("GREEN", 40)).toBe(VOLUNTEER_GRADE_INFO.GREEN);
  });
});

describe("isNewVolunteer", () => {
  it("covers exactly the First shift and New volunteer badges", () => {
    expect([0, 1, 2, 3].map(isNewVolunteer)).toEqual([true, true, true, false]);
  });
});
