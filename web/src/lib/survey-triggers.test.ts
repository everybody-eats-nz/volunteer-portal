import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evaluateTrigger } from "./survey-triggers";
import type { UserProgress } from "./achievements";

describe("survey-triggers", () => {
  describe("evaluateTrigger", () => {
    const mockProgress: UserProgress = {
      shifts_completed: 10,
      hours_volunteered: 50,
      months_active: 3,
      current_streak: 2,
      longest_streak: 5,
      unique_shift_types: 2,
      shift_type_counts: { "Kitchen": 5, "Service": 5 },
    };

    const userCreatedAt = new Date("2025-01-01");

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-22"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe("SHIFTS_COMPLETED trigger", () => {
      it("should trigger when shifts completed >= target", () => {
        const result = evaluateTrigger(
          "SHIFTS_COMPLETED",
          10,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(true);
        expect(result.reason).toContain("10 shifts");
      });

      it("should trigger when shifts completed > target", () => {
        const result = evaluateTrigger(
          "SHIFTS_COMPLETED",
          5,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(true);
      });

      it("should not trigger when shifts completed < target", () => {
        const result = evaluateTrigger(
          "SHIFTS_COMPLETED",
          15,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(false);
        expect(result.reason).toBeUndefined();
      });
    });

    describe("HOURS_VOLUNTEERED trigger", () => {
      it("should trigger when hours >= target", () => {
        const result = evaluateTrigger(
          "HOURS_VOLUNTEERED",
          50,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(true);
        expect(result.reason).toContain("50 hours");
      });

      it("should not trigger when hours < target", () => {
        const result = evaluateTrigger(
          "HOURS_VOLUNTEERED",
          100,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(false);
      });
    });

    describe("FIRST_SHIFT trigger", () => {
      it("should trigger when days since first shift >= target", () => {
        const firstShiftDate = new Date("2026-01-01"); // 21 days ago
        const result = evaluateTrigger(
          "FIRST_SHIFT",
          7,
          mockProgress,
          userCreatedAt,
          firstShiftDate
        );

        expect(result.triggered).toBe(true);
        expect(result.reason).toContain("21 days since first shift");
      });

      it("should not trigger when days since first shift < target", () => {
        const firstShiftDate = new Date("2026-01-20"); // 2 days ago
        const result = evaluateTrigger(
          "FIRST_SHIFT",
          7,
          mockProgress,
          userCreatedAt,
          firstShiftDate
        );

        expect(result.triggered).toBe(false);
      });

      it("should not trigger when no first shift date", () => {
        const result = evaluateTrigger(
          "FIRST_SHIFT",
          7,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(false);
      });
    });

    describe("MANUAL trigger", () => {
      it("should never trigger automatically", () => {
        const result = evaluateTrigger(
          "MANUAL",
          0,
          mockProgress,
          userCreatedAt,
          new Date()
        );

        expect(result.triggered).toBe(false);
      });
    });

    describe("unknown trigger type", () => {
      it("should not trigger for unknown types", () => {
        const result = evaluateTrigger(
          "UNKNOWN_TYPE" as any,
          0,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(false);
      });
    });
  });
});
