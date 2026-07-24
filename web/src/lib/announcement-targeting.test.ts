import { describe, it, expect } from "vitest";
import {
  hasActivityTargeting,
  parseTargetingFromRequest,
  userMatchesActivityTargeting,
  type ActivityTargeting,
} from "./announcement-targeting";

/** Shorthand for building activity targeting in the tests below. */
function activity(overrides: Partial<ActivityTargeting> = {}): ActivityTargeting {
  return {
    targetActivityLocations: [],
    targetActivityFrom: null,
    targetActivityTo: null,
    targetActivityMinShifts: 1,
    ...overrides,
  };
}

describe("announcement-targeting", () => {
  describe("parseTargetingFromRequest", () => {
    it("leaves the activity dimension off when no minimum is given", () => {
      const t = parseTargetingFromRequest({ targetLocations: ["Onehunga"] });

      expect(t.targetActivityMinShifts).toBeNull();
      expect(hasActivityTargeting(t)).toBe(false);
    });

    it("anchors the from date to midnight of that NZ calendar day", () => {
      // 24 April is outside NZ daylight saving, so NZST = UTC+12 and local
      // midnight is 12:00 UTC the day before.
      const t = parseTargetingFromRequest({
        targetActivityFrom: "2026-04-24",
        targetActivityMinShifts: 1,
      });

      expect(t.targetActivityFrom?.toISOString()).toBe(
        "2026-04-23T12:00:00.000Z"
      );
    });

    it("anchors the to date to the end of that NZ calendar day", () => {
      // 24 January is inside daylight saving, so NZDT = UTC+13.
      const t = parseTargetingFromRequest({
        targetActivityTo: "2026-01-24",
        targetActivityMinShifts: 1,
      });

      expect(t.targetActivityTo?.toISOString()).toBe(
        "2026-01-24T10:59:59.000Z"
      );
    });

    it("drops malformed dates rather than throwing mid-send", () => {
      const t = parseTargetingFromRequest({
        targetActivityFrom: "last April",
        targetActivityTo: 1234,
        targetActivityMinShifts: 1,
      });

      expect(t.targetActivityFrom).toBeNull();
      expect(t.targetActivityTo).toBeNull();
    });

    it("rejects well-formed but impossible dates instead of rolling them over", () => {
      // The date constructor happily turns these into real dates in a later
      // month. Accepting that would silently shift a window bound.
      const t = parseTargetingFromRequest({
        targetActivityFrom: "2026-13-99",
        targetActivityTo: "2026-02-31",
        targetActivityMinShifts: 1,
      });

      expect(t.targetActivityFrom).toBeNull();
      expect(t.targetActivityTo).toBeNull();
    });

    it("keeps a real leap day", () => {
      const t = parseTargetingFromRequest({
        targetActivityFrom: "2028-02-29",
        targetActivityMinShifts: 1,
      });

      expect(t.targetActivityFrom).not.toBeNull();
    });

    it("rejects a leap day in a non-leap year", () => {
      const t = parseTargetingFromRequest({
        targetActivityFrom: "2027-02-29",
        targetActivityMinShifts: 1,
      });

      expect(t.targetActivityFrom).toBeNull();
    });

    it("rejects a zero month or day", () => {
      // The shape regex allows these; they roll backwards into the previous
      // year rather than failing, so only the round-trip check catches them.
      expect(
        parseTargetingFromRequest({
          targetActivityFrom: "2026-00-01",
          targetActivityMinShifts: 1,
        }).targetActivityFrom
      ).toBeNull();
      expect(
        parseTargetingFromRequest({
          targetActivityFrom: "2026-01-00",
          targetActivityMinShifts: 1,
        }).targetActivityFrom
      ).toBeNull();
    });

    it("clamps the minimum shift count into a sane range", () => {
      expect(
        parseTargetingFromRequest({ targetActivityMinShifts: 0 })
          .targetActivityMinShifts
      ).toBe(1);
      expect(
        parseTargetingFromRequest({ targetActivityMinShifts: -5 })
          .targetActivityMinShifts
      ).toBe(1);
      expect(
        parseTargetingFromRequest({ targetActivityMinShifts: 10_000 })
          .targetActivityMinShifts
      ).toBe(999);
      expect(
        parseTargetingFromRequest({ targetActivityMinShifts: 2.7 })
          .targetActivityMinShifts
      ).toBe(2);
    });

    it("ignores non-string entries in the targeting arrays", () => {
      const t = parseTargetingFromRequest({
        targetLocations: ["Onehunga", 42, null],
        targetActivityLocations: "Onehunga",
      });

      expect(t.targetLocations).toEqual(["Onehunga"]);
      expect(t.targetActivityLocations).toEqual([]);
    });
  });

  describe("userMatchesActivityTargeting", () => {
    const onehungaApril = { location: "Onehunga", end: new Date("2026-04-30") };
    const onehungaJune = { location: "Onehunga", end: new Date("2026-06-15") };
    const wellingtonJune = {
      location: "Wellington",
      end: new Date("2026-06-15"),
    };

    it("matches everyone when the dimension is off", () => {
      expect(
        userMatchesActivityTargeting(
          [],
          activity({ targetActivityMinShifts: null })
        )
      ).toBe(true);
    });

    it("requires at least one worked shift when switched on", () => {
      expect(userMatchesActivityTargeting([], activity())).toBe(false);
      expect(userMatchesActivityTargeting([onehungaJune], activity())).toBe(
        true
      );
    });

    it("counts only shifts at the targeted locations", () => {
      const target = activity({ targetActivityLocations: ["Onehunga"] });

      expect(userMatchesActivityTargeting([wellingtonJune], target)).toBe(false);
      expect(userMatchesActivityTargeting([onehungaJune], target)).toBe(true);
    });

    it("excludes shifts with no location when locations are targeted", () => {
      expect(
        userMatchesActivityTargeting(
          [{ location: null, end: new Date("2026-06-15") }],
          activity({ targetActivityLocations: ["Onehunga"] })
        )
      ).toBe(false);
    });

    it("counts shifts at any location when none are targeted", () => {
      expect(
        userMatchesActivityTargeting([wellingtonJune], activity())
      ).toBe(true);
    });

    it("applies the date window to the shift end time, inclusively", () => {
      const target = activity({
        targetActivityFrom: new Date("2026-05-01"),
        targetActivityTo: new Date("2026-07-01"),
      });

      expect(userMatchesActivityTargeting([onehungaApril], target)).toBe(false);
      expect(userMatchesActivityTargeting([onehungaJune], target)).toBe(true);
      expect(
        userMatchesActivityTargeting(
          [{ location: "Onehunga", end: new Date("2026-05-01") }],
          target
        )
      ).toBe(true);
    });

    it("requires the full minimum across matching shifts only", () => {
      const target = activity({
        targetActivityLocations: ["Onehunga"],
        targetActivityMinShifts: 2,
      });

      expect(
        userMatchesActivityTargeting([onehungaJune, wellingtonJune], target)
      ).toBe(false);
      expect(
        userMatchesActivityTargeting([onehungaJune, onehungaApril], target)
      ).toBe(true);
    });
  });
});
