import { describe, it, expect } from "vitest";
import {
  ANNOUNCEMENT_CATEGORIES,
  announcementCategoryMeta,
  isAnnouncementCategory,
  parseAnnouncementCategory,
} from "./announcement-categories";

describe("announcement category policy", () => {
  it("makes shift-related and urgent mandatory, the rest opt-out", () => {
    const mandatory = ANNOUNCEMENT_CATEGORIES.filter((c) => c.mandatory).map(
      (c) => c.value
    );
    expect(mandatory).toEqual(["SHIFT_RELATED", "URGENT"]);
    expect(announcementCategoryMeta("SHIFT_SHORTAGE").mandatory).toBe(false);
    expect(announcementCategoryMeta("PROMOTIONAL").mandatory).toBe(false);
  });

  it("only requires shifts for shift-related", () => {
    const requiring = ANNOUNCEMENT_CATEGORIES.filter(
      (c) => c.requiresShifts
    ).map((c) => c.value);
    expect(requiring).toEqual(["SHIFT_RELATED"]);
  });
});

describe("isAnnouncementCategory", () => {
  it("accepts every enum value and nothing else", () => {
    for (const c of ANNOUNCEMENT_CATEGORIES) {
      expect(isAnnouncementCategory(c.value)).toBe(true);
    }
    expect(isAnnouncementCategory("promotional")).toBe(false);
    expect(isAnnouncementCategory("GENERAL")).toBe(false);
    expect(isAnnouncementCategory(42)).toBe(false);
  });
});

describe("parseAnnouncementCategory", () => {
  it.each([undefined, null, ""])("requires a category (%s)", (value) => {
    expect(parseAnnouncementCategory(value, [])).toEqual({
      ok: false,
      error: "Category is required",
    });
  });

  it("rejects an unknown category", () => {
    expect(parseAnnouncementCategory("NEWSLETTER", [])).toEqual({
      ok: false,
      error: "Category is not valid",
    });
  });

  it("rejects shift-related without any targeted shift", () => {
    expect(parseAnnouncementCategory("SHIFT_RELATED", [])).toEqual({
      ok: false,
      error: "Shift-related announcements must target at least one shift",
    });
  });

  it("accepts shift-related once a shift is targeted", () => {
    expect(parseAnnouncementCategory("SHIFT_RELATED", ["shift-1"])).toEqual({
      ok: true,
      category: "SHIFT_RELATED",
    });
  });

  it.each(["URGENT", "SHIFT_SHORTAGE", "PROMOTIONAL"])(
    "accepts %s without targeted shifts",
    (category) => {
      expect(parseAnnouncementCategory(category, [])).toEqual({
        ok: true,
        category,
      });
    }
  );
});
