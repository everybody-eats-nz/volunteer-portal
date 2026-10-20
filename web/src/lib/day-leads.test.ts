import { describe, it, expect } from "vitest";
import {
  DAY_LEAD_NAME_MAX_LENGTH,
  dayLeadOverrideSchema,
  dayLeadRosterSchema,
  dayOfWeekForDayKey,
  normalizeLeadName,
  resolveDayLeads,
} from "./day-leads";

const day = (key: string) => new Date(`${key}T00:00:00.000Z`);

describe("dayOfWeekForDayKey", () => {
  it("reads the weekday of the NZ day itself, not of an instant", () => {
    // 2026-10-27 is a Tuesday; 2026-11-01 a Sunday.
    expect(dayOfWeekForDayKey("2026-10-27")).toBe(2);
    expect(dayOfWeekForDayKey("2026-11-01")).toBe(0);
    expect(dayOfWeekForDayKey("2026-10-31")).toBe(6);
  });
});

describe("normalizeLeadName", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeLeadName("  Mere \n Tui ")).toBe("Mere Tui");
    expect(normalizeLeadName("   ")).toBe("");
  });
});

describe("resolveDayLeads", () => {
  const rosters = [
    // Tuesdays and Wednesdays in Wellington
    { location: "Wellington", dayOfWeek: 2, chef: "Sam", fohManager: "Alex" },
    { location: "Wellington", dayOfWeek: 3, chef: "Mere", fohManager: null },
    { location: "Onehunga", dayOfWeek: 2, chef: "Hemi", fohManager: "Tui" },
  ];

  it("fills each day from its location's standard roster", () => {
    const map = resolveDayLeads(
      [
        { location: "Wellington", dayKey: "2026-10-27" },
        { location: "Wellington", dayKey: "2026-10-28" },
        { location: "Onehunga", dayKey: "2026-10-27" },
      ],
      rosters,
      []
    );
    expect(map).toEqual({
      Wellington: {
        "2026-10-27": { chef: "Sam", fohManager: "Alex" },
        "2026-10-28": { chef: "Mere", fohManager: null },
      },
      Onehunga: { "2026-10-27": { chef: "Hemi", fohManager: "Tui" } },
    });
  });

  it("lets an override replace one role and keep the other standard", () => {
    const map = resolveDayLeads(
      [
        { location: "Wellington", dayKey: "2026-10-27" },
        { location: "Wellington", dayKey: "2026-11-03" },
      ],
      rosters,
      [
        {
          location: "Wellington",
          date: day("2026-10-27"),
          chef: "Kiri",
          fohManager: null,
        },
      ]
    );
    expect(map.Wellington).toEqual({
      "2026-10-27": { chef: "Kiri", fohManager: "Alex" },
      // The next Tuesday is back on the standard roster
      "2026-11-03": { chef: "Sam", fohManager: "Alex" },
    });
  });

  it("names leads on days without a standard roster through an override", () => {
    const map = resolveDayLeads(
      [{ location: "Wellington", dayKey: "2026-10-30" }],
      rosters,
      [
        {
          location: "Wellington",
          date: day("2026-10-30"),
          chef: null,
          fohManager: "Ana",
        },
      ]
    );
    expect(map).toEqual({
      Wellington: { "2026-10-30": { chef: null, fohManager: "Ana" } },
    });
  });

  it("leaves out days with nobody listed and ignores other locations' rows", () => {
    const map = resolveDayLeads(
      [
        { location: "Wellington", dayKey: "2026-10-30" },
        { location: "Glen Innes", dayKey: "2026-10-27" },
      ],
      rosters,
      [
        {
          location: "Onehunga",
          date: day("2026-10-30"),
          chef: "Hemi",
          fohManager: null,
        },
      ]
    );
    expect(map).toEqual({});
  });
});

describe("dayLeadOverrideSchema", () => {
  it("normalizes names and keeps empty ones as 'use the standard roster'", () => {
    const parsed = dayLeadOverrideSchema.parse({
      date: "2026-10-27",
      location: " Wellington ",
      chef: "  Kiri  ",
      fohManager: "",
    });
    expect(parsed).toEqual({
      date: "2026-10-27",
      location: "Wellington",
      chef: "Kiri",
      fohManager: "",
    });
  });

  it("rejects invalid days and over-long names", () => {
    expect(
      dayLeadOverrideSchema.safeParse({
        date: "2026-02-30",
        location: "Wellington",
        chef: "",
        fohManager: "",
      }).success
    ).toBe(false);
    const long = dayLeadOverrideSchema.safeParse({
      date: "2026-10-27",
      location: "Wellington",
      chef: "x".repeat(DAY_LEAD_NAME_MAX_LENGTH + 1),
      fohManager: "",
    });
    expect(long.success).toBe(false);
  });
});

describe("dayLeadRosterSchema", () => {
  it("rejects a weekday listed twice and out-of-range weekdays", () => {
    const twice = dayLeadRosterSchema.safeParse({
      location: "Wellington",
      days: [
        { dayOfWeek: 2, chef: "Sam", fohManager: "" },
        { dayOfWeek: 2, chef: "Mere", fohManager: "" },
      ],
    });
    expect(twice.success).toBe(false);
    const outOfRange = dayLeadRosterSchema.safeParse({
      location: "Wellington",
      days: [{ dayOfWeek: 7, chef: "Sam", fohManager: "" }],
    });
    expect(outOfRange.success).toBe(false);
  });
});
