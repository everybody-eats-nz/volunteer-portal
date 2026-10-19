import { describe, it, expect } from "vitest";

import {
  SHIFT_DAY_THEME_MAX_LENGTH,
  dayKeyToDbDate,
  dbDateToDayKey,
  isDayKey,
  normalizeTheme,
  shiftDayThemeSchema,
  toShiftDayThemeMap,
} from "./shift-day-themes";

describe("isDayKey", () => {
  it("accepts real calendar days", () => {
    expect(isDayKey("2026-12-23")).toBe(true);
    expect(isDayKey("2028-02-29")).toBe(true); // leap day
  });

  it("rejects malformed or impossible days", () => {
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("2026-13-01")).toBe(false);
    expect(isDayKey("2026-1-5")).toBe(false);
    expect(isDayKey("2026-12-23T00:00:00Z")).toBe(false);
    expect(isDayKey("")).toBe(false);
  });
});

describe("day key <-> DATE column", () => {
  it("round-trips without drifting a day in any timezone", () => {
    const date = dayKeyToDbDate("2026-12-23");
    expect(date.toISOString()).toBe("2026-12-23T00:00:00.000Z");
    expect(dbDateToDayKey(date)).toBe("2026-12-23");
  });
});

describe("normalizeTheme", () => {
  it("trims and collapses whitespace, including pasted newlines", () => {
    expect(normalizeTheme("  Christmas \n\n  Lunch  ")).toBe("Christmas Lunch");
  });
});

describe("shiftDayThemeSchema", () => {
  const base = { date: "2026-12-23", location: "Wellington" };

  it("normalizes the theme", () => {
    const result = shiftDayThemeSchema.parse({
      ...base,
      theme: "  Pasta   Night ",
    });
    expect(result.theme).toBe("Pasta Night");
  });

  it("allows an empty theme, which clears the day", () => {
    expect(shiftDayThemeSchema.parse({ ...base, theme: "   " }).theme).toBe("");
  });

  it("enforces the length limit after normalizing", () => {
    const atLimit = "a".repeat(SHIFT_DAY_THEME_MAX_LENGTH);
    expect(
      shiftDayThemeSchema.safeParse({ ...base, theme: `  ${atLimit}  ` })
        .success
    ).toBe(true);

    const result = shiftDayThemeSchema.safeParse({
      ...base,
      theme: `${atLimit}b`,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/80 characters/);
  });

  it("rejects an invalid date or missing location", () => {
    expect(
      shiftDayThemeSchema.safeParse({ ...base, date: "2026-02-30", theme: "x" })
        .success
    ).toBe(false);
    expect(
      shiftDayThemeSchema.safeParse({ ...base, location: " ", theme: "x" })
        .success
    ).toBe(false);
  });
});

describe("toShiftDayThemeMap", () => {
  it("groups themes by location then day", () => {
    expect(
      toShiftDayThemeMap([
        {
          date: dayKeyToDbDate("2026-12-23"),
          location: "Wellington",
          theme: "Christmas Lunch",
        },
        {
          date: dayKeyToDbDate("2026-12-28"),
          location: "Wellington",
          theme: "Pasta Night",
        },
        {
          date: dayKeyToDbDate("2026-12-23"),
          location: "Glen Innes",
          theme: "Private event",
        },
      ])
    ).toEqual({
      Wellington: {
        "2026-12-23": "Christmas Lunch",
        "2026-12-28": "Pasta Night",
      },
      "Glen Innes": { "2026-12-23": "Private event" },
    });
  });
});
