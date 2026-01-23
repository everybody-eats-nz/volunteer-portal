import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evaluateTrigger } from "./survey-triggers";
import type { UserProgress } from "./achievements";

describe("survey-triggers", () => {
  describe("evaluateTrigger", () => {
    const mockProgress: UserProgress = {
      shifts_completed: 10,
      hours_volunteered: 50,
      consecutive_months: 3,
      years_volunteering: 1,
      community_impact: 100,
      friends_count: 5,
      passkeys_added: 0,
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
      it("should trigger when shifts completed >= target (no max)", () => {
        const result = evaluateTrigger(
          "SHIFTS_COMPLETED",
          10,
          null,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(true);
        expect(result.reason).toContain("10 shifts");
        expect(result.reason).toContain("10+");
      });

      it("should trigger when shifts completed > target (no max)", () => {
        const result = evaluateTrigger(
          "SHIFTS_COMPLETED",
          5,
          null,
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
          null,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(false);
        expect(result.reason).toBeUndefined();
      });

      it("should trigger when shifts within range (min <= value <= max)", () => {
        const result = evaluateTrigger(
          "SHIFTS_COMPLETED",
          5,
          15,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(true);
        expect(result.reason).toContain("10 shifts");
        expect(result.reason).toContain("5-15");
      });

      it("should not trigger when shifts exceed max threshold", () => {
        const result = evaluateTrigger(
          "SHIFTS_COMPLETED",
          5,
          8,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(false);
      });

      it("should trigger when shifts exactly at max threshold", () => {
        const result = evaluateTrigger(
          "SHIFTS_COMPLETED",
          5,
          10,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(true);
      });
    });

    describe("HOURS_VOLUNTEERED trigger", () => {
      it("should trigger when hours >= target (no max)", () => {
        const result = evaluateTrigger(
          "HOURS_VOLUNTEERED",
          50,
          null,
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
          null,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(false);
      });

      it("should trigger when hours within range", () => {
        const result = evaluateTrigger(
          "HOURS_VOLUNTEERED",
          40,
          60,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(true);
        expect(result.reason).toContain("40-60");
      });

      it("should not trigger when hours exceed max threshold", () => {
        const result = evaluateTrigger(
          "HOURS_VOLUNTEERED",
          40,
          45,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(false);
      });
    });

    describe("FIRST_SHIFT trigger", () => {
      it("should trigger when days since first shift >= target (no max)", () => {
        const firstShiftDate = new Date("2026-01-01"); // 21 days ago
        const result = evaluateTrigger(
          "FIRST_SHIFT",
          7,
          null,
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
          null,
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
          null,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(false);
      });

      it("should trigger when days within range", () => {
        const firstShiftDate = new Date("2026-01-01"); // 21 days ago
        const result = evaluateTrigger(
          "FIRST_SHIFT",
          14,
          30,
          mockProgress,
          userCreatedAt,
          firstShiftDate
        );

        expect(result.triggered).toBe(true);
        expect(result.reason).toContain("14-30");
      });

      it("should not trigger when days exceed max threshold", () => {
        const firstShiftDate = new Date("2026-01-01"); // 21 days ago
        const result = evaluateTrigger(
          "FIRST_SHIFT",
          7,
          14,
          mockProgress,
          userCreatedAt,
          firstShiftDate
        );

        expect(result.triggered).toBe(false);
      });
    });

    describe("MANUAL trigger", () => {
      it("should never trigger automatically", () => {
        const result = evaluateTrigger(
          "MANUAL",
          0,
          null,
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "UNKNOWN_TYPE" as unknown as any,
          0,
          null,
          mockProgress,
          userCreatedAt,
          null
        );

        expect(result.triggered).toBe(false);
      });
    });
  });
});
