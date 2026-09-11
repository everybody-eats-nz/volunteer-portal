import { describe, it, expect } from "vitest";
import {
  inPeriod,
  monthLabel,
  monthOf,
  monthsCovered,
  periodLabel,
  periodSlug,
  shiftMonth,
  type Period,
} from "./period";

describe("monthOf / monthLabel", () => {
  it("reads the month off a day key", () => {
    expect(monthOf("2026-09-03")).toBe("2026-09");
  });

  it("names the month for a heading", () => {
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(monthLabel("2026-01")).toBe("January 2026");
    expect(monthLabel("2026-12")).toBe("December 2026");
  });
});

describe("shiftMonth", () => {
  it("steps within a year", () => {
    expect(shiftMonth("2026-09", -1)).toBe("2026-08");
    expect(shiftMonth("2026-09", 1)).toBe("2026-10");
  });

  it("rolls the year at both ends", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("steps further than a year", () => {
    expect(shiftMonth("2026-09", -14)).toBe("2025-07");
    expect(shiftMonth("2026-09", 16)).toBe("2028-01");
  });

  it("keeps the key zero-padded, so string comparison still orders months", () => {
    expect(shiftMonth("2026-10", -2)).toBe("2026-08");
    expect(shiftMonth("2026-11", -10)).toBe("2026-01");
    expect("2026-09" > "2026-10").toBe(false);
  });
});

describe("inPeriod", () => {
  it("keeps a month to its own days", () => {
    const period: Period = { mode: "month", month: "2026-09" };
    expect(inPeriod("2026-09-01", period)).toBe(true);
    expect(inPeriod("2026-09-30", period)).toBe(true);
    expect(inPeriod("2026-08-31", period)).toBe(false);
    expect(inPeriod("2026-10-01", period)).toBe(false);
  });

  it("treats both range bounds as inclusive", () => {
    const period: Period = { mode: "range", from: "2026-09-03", to: "2026-09-05" };
    expect(inPeriod("2026-09-03", period)).toBe(true);
    expect(inPeriod("2026-09-05", period)).toBe(true);
    expect(inPeriod("2026-09-06", period)).toBe(false);
  });

  it("leaves a blank range bound open", () => {
    expect(inPeriod("1999-01-01", { mode: "range", from: "", to: "2026-09-05" })).toBe(true);
    expect(inPeriod("2099-01-01", { mode: "range", from: "2026-09-05", to: "" })).toBe(true);
  });

  it("lets everything through on all time", () => {
    expect(inPeriod("1999-01-01", { mode: "all" })).toBe(true);
  });
});

describe("periodLabel / periodSlug", () => {
  it("names each mode", () => {
    expect(periodLabel({ mode: "month", month: "2026-09" })).toBe("September 2026");
    expect(periodLabel({ mode: "all" })).toBe("All time");
    expect(periodLabel({ mode: "range", from: "2026-03-01", to: "2026-03-31" })).toBe(
      "2026-03-01 to 2026-03-31"
    );
    expect(periodLabel({ mode: "range", from: "2026-03-01", to: "" })).toBe("From 2026-03-01");
    expect(periodLabel({ mode: "range", from: "", to: "2026-03-31" })).toBe("Up to 2026-03-31");
    expect(periodLabel({ mode: "range", from: "", to: "" })).toBe("Any date");
  });

  it("makes a filename stem with no stray punctuation", () => {
    expect(periodSlug({ mode: "month", month: "2026-09" })).toBe("september-2026");
    expect(periodSlug({ mode: "all" })).toBe("all-time");
    expect(periodSlug({ mode: "range", from: "2026-03-01", to: "2026-03-31" })).toBe(
      "2026-03-01-to-2026-03-31"
    );
  });
});

describe("monthsCovered", () => {
  it("returns newest first", () => {
    expect(monthsCovered(["2026-07-04", "2026-09-01", "2026-08-20"])).toEqual([
      "2026-09",
      "2026-08",
      "2026-07",
    ]);
  });

  it("fills a month nobody logged, rather than skipping it", () => {
    // A silent month is a real answer to "what did we send Meridian in August",
    // so the picker has to be able to land on it.
    expect(monthsCovered(["2026-07-04", "2026-09-01"])).toEqual([
      "2026-09",
      "2026-08",
      "2026-07",
    ]);
  });

  it("spans a year boundary", () => {
    expect(monthsCovered(["2025-12-30", "2026-01-02"])).toEqual(["2026-01", "2025-12"]);
  });

  it("handles one trip and none at all", () => {
    expect(monthsCovered(["2026-09-03"])).toEqual(["2026-09"]);
    expect(monthsCovered([])).toEqual([]);
  });
});
