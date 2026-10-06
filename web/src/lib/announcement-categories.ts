import type { AnnouncementCategory } from "@/generated/client";

export type { AnnouncementCategory };

export type AnnouncementCategoryMeta = {
  value: AnnouncementCategory;
  label: string;
  /**
   * The pill volunteers see on the feed card, phrased for them rather than
   * for admins. Mirrored in mobile/lib/announcement-category.ts.
   */
  feedLabel: string;
  /** One line for the composer picker: what belongs in this category. */
  description: string;
  /** Mandatory categories reach everyone in the audience; no opt-out. */
  mandatory: boolean;
  /** Must target at least one shift, so the category can't carry general news. */
  requiresShifts: boolean;
};

/**
 * Every category, in picker order (mandatory first). Client-safe: no Prisma
 * runtime import, so the composer and list can share it with the API.
 *
 * When opt-outs land, shift shortages will reuse the volunteer's existing
 * shortage-alert switch (`User.receiveShortageNotifications`) rather than
 * adding a second one.
 */
export const ANNOUNCEMENT_CATEGORIES: readonly AnnouncementCategoryMeta[] = [
  {
    value: "SHIFT_RELATED",
    feedLabel: "Your shift",
    label: "Shift-related",
    description:
      "About a shift people are signed up for, e.g. a uniform reminder.",
    mandatory: true,
    requiresShifts: true,
  },
  {
    value: "URGENT",
    feedLabel: "Urgent",
    label: "Urgent notice",
    description:
      "Something volunteers must know, e.g. a closure for extreme weather.",
    mandatory: true,
    requiresShifts: false,
  },
  {
    value: "SHIFT_SHORTAGE",
    feedLabel: "Help needed",
    label: "Shift shortage",
    description:
      "Asking for help to fill an upcoming shift, e.g. \"We're short on Thursday\".",
    mandatory: false,
    requiresShifts: false,
  },
  {
    value: "PROMOTIONAL",
    feedLabel: "Promo",
    label: "Promotional",
    description: "Deals, events and other promos, e.g. Hopper Cafe student deals.",
    mandatory: false,
    requiresShifts: false,
  },
];

export function isAnnouncementCategory(
  value: unknown
): value is AnnouncementCategory {
  return ANNOUNCEMENT_CATEGORIES.some((c) => c.value === value);
}

export function announcementCategoryMeta(
  category: AnnouncementCategory
): AnnouncementCategoryMeta {
  const meta = ANNOUNCEMENT_CATEGORIES.find((c) => c.value === category);
  if (!meta) throw new Error(`Unknown announcement category: ${category}`);
  return meta;
}

/**
 * The rules an announcement's category imposes, shared by the create and
 * re-categorise routes and the composer. Returns the parsed category, or an
 * admin-facing error.
 */
export function parseAnnouncementCategory(
  category: unknown,
  targetShiftIds: readonly string[]
):
  | { ok: true; category: AnnouncementCategory }
  | { ok: false; error: string } {
  if (category === undefined || category === null || category === "") {
    return { ok: false, error: "Category is required" };
  }
  if (!isAnnouncementCategory(category)) {
    return { ok: false, error: "Category is not valid" };
  }
  if (
    announcementCategoryMeta(category).requiresShifts &&
    targetShiftIds.length === 0
  ) {
    return {
      ok: false,
      error: "Shift-related announcements must target at least one shift",
    };
  }
  return { ok: true, category };
}
