import { describe, it, expect } from "vitest";

import {
  SHIFT_DAY_THEME_MAX_LENGTH,
  dayKeyToDbDate,
  dbDateToDayKey,
  isDayKey,
  normalizeTheme,
  shiftDayThemeSchema,
  toShiftDayThemeMap,
  dayThemeLabel,
  toDayThemeLabelMap,
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

  it("defaults closed to false, so older clients keep working", () => {
    expect(shiftDayThemeSchema.parse({ ...base, theme: "x" }).closed).toBe(
      false
    );
    expect(
      shiftDayThemeSchema.parse({ ...base, theme: "", closed: true }).closed
    ).toBe(true);
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
          closed: false,
        },
        {
          date: dayKeyToDbDate("2026-12-28"),
          location: "Wellington",
          theme: "Summer break",
          closed: true,
        },
        {
          date: dayKeyToDbDate("2026-12-23"),
          location: "Glen Innes",
          theme: "Private event",
          closed: false,
        },
      ])
    ).toEqual({
      Wellington: {
        "2026-12-23": { theme: "Christmas Lunch", closed: false },
        "2026-12-28": { theme: "Summer break", closed: true },
      },
      "Glen Innes": { "2026-12-23": { theme: "Private event", closed: false } },
    });
  });
});

describe("dayThemeLabel", () => {
  it("is the theme on an open day", () => {
    expect(dayThemeLabel({ theme: "Pasta Night", closed: false })).toBe(
      "Pasta Night"
    );
  });

  it("leads with Closed on a closed day, with or without a reason", () => {
    expect(dayThemeLabel({ theme: "Labour Day weekend", closed: true })).toBe(
      "Closed - Labour Day weekend"
    );
    expect(dayThemeLabel({ theme: "", closed: true })).toBe("Closed");
  });
});

describe("toDayThemeLabelMap", () => {
  it("flattens each day to its label", () => {
    expect(
      toDayThemeLabelMap({
        Wellington: {
          "2026-10-25": { theme: "Labour Day weekend", closed: true },
          "2026-12-23": { theme: "Christmas Lunch", closed: false },
        },
      })
    ).toEqual({
      Wellington: {
        "2026-10-25": "Closed - Labour Day weekend",
        "2026-12-23": "Christmas Lunch",
      },
    });
  });
});
