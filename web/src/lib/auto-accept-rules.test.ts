import { describe, it, expect } from "vitest";
import { evaluateRule, UserWithStats } from "./auto-accept-rules";
import type { AutoAcceptRule, Shift, ShiftType } from "@/generated/client";

// Helper to create a base user with stats
function createUserWithStats(
  overrides: Partial<UserWithStats> = {}
): UserWithStats {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    volunteerGrade: "GREEN",
    createdAt: new Date("2024-01-01"),
    completedShifts: 10,
    canceledShifts: 0,
    attendanceRate: 100,
    hasShiftTypeExperience: true,
    age: 25,
    ...overrides,
  };
}

// Helper to create a base shift with shift type
function createShift(
  overrides: Partial<Shift & { shiftType: ShiftType }> = {}
): Shift & { shiftType: ShiftType } {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    id: "shift-1",
    shiftTypeId: "shift-type-1",
    start: tomorrow,
    end: new Date(tomorrow.getTime() + 4 * 60 * 60 * 1000),
    capacity: 5,
    signedUp: 0,
    confirmedCount: 0,
    notes: null,
    location: "Auckland",
    createdAt: now,
    updatedAt: now,
    emoji: null,
    shiftType: {
      id: "shift-type-1",
      name: "Kitchen",
      description: "Kitchen duties",
      color: "#FF0000",
      createdAt: now,
      updatedAt: now,
      archived: false,
      requiredGrade: "GREEN",
    },
    ...overrides,
  } as Shift & { shiftType: ShiftType };
}

// Helper to create a base rule
function createRule(overrides: Partial<AutoAcceptRule> = {}): AutoAcceptRule {
  const now = new Date();
  return {
    id: "rule-1",
    name: "Test Rule",
    description: null,
    enabled: true,
    priority: 0,
    global: true,
    shiftTypeId: null,
    location: null,
    minVolunteerGrade: null,
    minCompletedShifts: null,
    minAttendanceRate: null,
    minAccountAgeDays: null,
    maxDaysInAdvance: null,
    requireShiftTypeExperience: false,
    minVolunteerAge: null,
    criteriaLogic: "AND",
    stopOnMatch: true,
    createdAt: now,
    updatedAt: now,
    createdBy: "admin-1",
    ...overrides,
  } as AutoAcceptRule;
}

describe("auto-accept-rules", () => {
  describe("evaluateRule", () => {
    describe("age criterion", () => {
      it("should approve when volunteer meets minimum age", () => {
        const rule = createRule({ minVolunteerAge: 18 });
        const user = createUserWithStats({ age: 25 });
        const shift = createShift();

        const result = evaluateRule(rule, user, shift);

        expect(result).toBe(true);
      });

      it("should approve when volunteer age exactly matches minimum", () => {
        const rule = createRule({ minVolunteerAge: 18 });
        const user = createUserWithStats({ age: 18 });
        const shift = createShift();

        const result = evaluateRule(rule, user, shift);

        expect(result).toBe(true);
      });

      it("should reject when volunteer is below minimum age", () => {
        const rule = createRule({ minVolunteerAge: 18 });
        const user = createUserWithStats({ age: 16 });
        const shift = createShift();

        const result = evaluateRule(rule, user, shift);

        expect(result).toBe(false);
      });

      it("should reject when volunteer has no date of birth", () => {
        const rule = createRule({ minVolunteerAge: 18 });
        const user = createUserWithStats({ age: null });
        const shift = createShift();

        const result = evaluateRule(rule, user, shift);

        expect(result).toBe(false);
      });

      it("should work with AND logic combining age with other criteria - all pass", () => {
        const rule = createRule({
          minVolunteerAge: 18,
          minCompletedShifts: 5,
          criteriaLogic: "AND",
        });
        const user = createUserWithStats({ age: 25, completedShifts: 10 });
        const shift = createShift();

        const result = evaluateRule(rule, user, shift);

        expect(result).toBe(true);
      });

      it("should work with AND logic combining age with other criteria - age fails", () => {
        const rule = createRule({
          minVolunteerAge: 18,
          minCompletedShifts: 5,
          criteriaLogic: "AND",
        });
        const user = createUserWithStats({ age: 16, completedShifts: 10 });
        const shift = createShift();

        const result = evaluateRule(rule, user, shift);

        expect(result).toBe(false);
      });

      it("should work with AND logic combining age with other criteria - other criteria fails", () => {
        const rule = createRule({
          minVolunteerAge: 18,
          minCompletedShifts: 5,
          criteriaLogic: "AND",
        });
        const user = createUserWithStats({ age: 25, completedShifts: 2 });
        const shift = createShift();

        const result = evaluateRule(rule, user, shift);

        expect(result).toBe(false);
      });

      it("should work with OR logic combining age with other criteria - age passes", () => {
        const rule = createRule({
          minVolunteerAge: 18,
          minCompletedShifts: 100,
          criteriaLogic: "OR",
        });
        const user = createUserWithStats({ age: 25, completedShifts: 5 });
        const shift = createShift();

        const result = evaluateRule(rule, user, shift);

        expect(result).toBe(true);
      });

      it("should work with OR logic combining age with other criteria - other passes", () => {
        const rule = createRule({
          minVolunteerAge: 30,
          minCompletedShifts: 5,
          criteriaLogic: "OR",
        });
        const user = createUserWithStats({ age: 25, completedShifts: 10 });
        const shift = createShift();

        const result = evaluateRule(rule, user, shift);

        expect(result).toBe(true);
      });

      it("should work with OR logic combining age with other criteria - none pass", () => {
        const rule = createRule({
          minVolunteerAge: 30,
          minCompletedShifts: 100,
          criteriaLogic: "OR",
        });
        const user = createUserWithStats({ age: 25, completedShifts: 5 });
        const shift = createShift();

        const result = evaluateRule(rule, user, shift);

        expect(result).toBe(false);
      });
    });

    describe("rule with no age criterion", () => {
      it("should not consider age when minVolunteerAge is null", () => {
        const rule = createRule({
          minVolunteerAge: null,
          minCompletedShifts: 5,
        });
        const user = createUserWithStats({ age: 16, completedShifts: 10 });
        const shift = createShift();

        const result = evaluateRule(rule, user, shift);

        // Should pass because only minCompletedShifts is checked, not age
        expect(result).toBe(true);
      });

      it("should work with null age when age criterion is not set", () => {
        const rule = createRule({
          minVolunteerAge: null,
          minCompletedShifts: 5,
        });
        const user = createUserWithStats({ age: null, completedShifts: 10 });
        const shift = createShift();

        const result = evaluateRule(rule, user, shift);

        // Should pass because age is not a criterion
        expect(result).toBe(true);
      });
    });

    describe("rule with no criteria", () => {
      it("should return false when no criteria are set", () => {
        const rule = createRule({});
        const user = createUserWithStats();
        const shift = createShift();

        const result = evaluateRule(rule, user, shift);

        expect(result).toBe(false);
      });
    });
  });
});
