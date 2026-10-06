import { describe, it, expect } from "vitest";
import {
  ANNOUNCEMENT_CATEGORIES,
  announcementCategoryMeta,
  announcementEmailFooter,
  isAnnouncementCategory,
  isOptedOutOfAnnouncementCategory,
  LISTED_OPT_OUT_CATEGORIES,
  parseAnnouncementCategory,
  sanitizeAnnouncementOptOuts,
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

describe("sanitizeAnnouncementOptOuts", () => {
  it("only lists promotional; shortages use their own switch", () => {
    expect(LISTED_OPT_OUT_CATEGORIES).toEqual(["PROMOTIONAL"]);
  });

  it("keeps promotional and drops anything that can't be opted out of here", () => {
    expect(
      sanitizeAnnouncementOptOuts([
        "PROMOTIONAL",
        "SHIFT_RELATED",
        "URGENT",
        "SHIFT_SHORTAGE",
        "NEWSLETTER",
        42,
        "PROMOTIONAL",
      ])
    ).toEqual(["PROMOTIONAL"]);
  });

  it("returns an empty list when nothing is opted out", () => {
    expect(sanitizeAnnouncementOptOuts([])).toEqual([]);
  });
});

describe("isOptedOutOfAnnouncementCategory", () => {
  const optedIn = {
    receiveShortageNotifications: true,
    announcementOptOuts: [],
  } as const;
  const optedOutOfEverything = {
    receiveShortageNotifications: false,
    // A stale row could hold mandatory categories; they must still deliver.
    announcementOptOuts: [
      "SHIFT_RELATED",
      "URGENT",
      "SHIFT_SHORTAGE",
      "PROMOTIONAL",
    ],
  } as const;

  it.each(["SHIFT_RELATED", "URGENT"] as const)(
    "never opts anyone out of mandatory %s",
    (category) => {
      expect(
        isOptedOutOfAnnouncementCategory(optedOutOfEverything, category)
      ).toBe(false);
    }
  );

  it("follows the shortage switch for shift shortages", () => {
    expect(isOptedOutOfAnnouncementCategory(optedIn, "SHIFT_SHORTAGE")).toBe(
      false
    );
    expect(
      isOptedOutOfAnnouncementCategory(
        { receiveShortageNotifications: false, announcementOptOuts: [] },
        "SHIFT_SHORTAGE"
      )
    ).toBe(true);
    // Listing SHIFT_SHORTAGE does nothing while the switch is on.
    expect(
      isOptedOutOfAnnouncementCategory(
        {
          receiveShortageNotifications: true,
          announcementOptOuts: ["SHIFT_SHORTAGE"],
        },
        "SHIFT_SHORTAGE"
      )
    ).toBe(false);
  });

  it("follows the opt-out list for promotional", () => {
    expect(isOptedOutOfAnnouncementCategory(optedIn, "PROMOTIONAL")).toBe(
      false
    );
    expect(
      isOptedOutOfAnnouncementCategory(
        { receiveShortageNotifications: true, announcementOptOuts: ["PROMOTIONAL"] },
        "PROMOTIONAL"
      )
    ).toBe(true);
  });
});

describe("announcementEmailFooter", () => {
  it("tells volunteers why they got the email, for every category", () => {
    for (const { value } of ANNOUNCEMENT_CATEGORIES) {
      expect(announcementEmailFooter(value)).toMatch(
        /^You are receiving this email because you are a registered volunteer at Everybody Eats\./
      );
    }
  });

  it("says mandatory categories can't be turned off", () => {
    for (const c of ANNOUNCEMENT_CATEGORIES.filter((c) => c.mandatory)) {
      expect(announcementEmailFooter(c.value)).toContain("can't be turned off");
    }
  });

  it("says optional categories can be turned off", () => {
    for (const c of ANNOUNCEMENT_CATEGORIES.filter((c) => !c.mandatory)) {
      const footer = announcementEmailFooter(c.value);
      expect(footer).toContain("optional");
      expect(footer).toContain("turn them off");
    }
  });
});
