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
  /** What volunteers see on their notification preferences. */
  preferenceLabel: string;
  /** One line under preferenceLabel, phrased for volunteers. */
  preferenceDescription: string;
  /** Mandatory categories reach everyone in the audience; no opt-out. */
  mandatory: boolean;
  /** Must target at least one shift, so the category can't carry general news. */
  requiresShifts: boolean;
};

/**
 * Every category, in picker order (mandatory first). Client-safe: no Prisma
 * runtime import, so the composer and list can share it with the API.
 *
 * Volunteers opt out of the optional categories from their profile. Shift
 * shortages reuse the existing shortage-alert switch
 * (`User.receiveShortageNotifications`) so there's one shortage switch, not
 * two; every other optional category is listed in `User.announcementOptOuts`.
 */
export const ANNOUNCEMENT_CATEGORIES: readonly AnnouncementCategoryMeta[] = [
  {
    value: "SHIFT_RELATED",
    feedLabel: "Your shift",
    label: "Shift-related",
    description:
      "About a shift people are signed up for, e.g. a uniform reminder.",
    preferenceLabel: "Shift notifications",
    preferenceDescription:
      "Occasional updates about shifts you're signed up for.",
    mandatory: true,
    requiresShifts: true,
  },
  {
    value: "URGENT",
    feedLabel: "Urgent",
    label: "Urgent notice",
    description:
      "Something volunteers must know, e.g. a closure for extreme weather.",
    preferenceLabel: "Urgent messages",
    preferenceDescription:
      "Very occasional important messages, e.g. about flooding or similar.",
    mandatory: true,
    requiresShifts: false,
  },
  {
    value: "SHIFT_SHORTAGE",
    feedLabel: "Help needed",
    label: "Shift shortage",
    description:
      "Asking for help to fill an upcoming shift, e.g. \"We're short on Thursday\".",
    preferenceLabel: "Shift shortage notifications",
    preferenceDescription:
      "Asking for help to fill shifts that are short of volunteers.",
    mandatory: false,
    requiresShifts: false,
  },
  {
    value: "PROMOTIONAL",
    feedLabel: "Promo",
    label: "Promotional",
    description: "Deals, events and other promos, e.g. Hopper Cafe student deals.",
    preferenceLabel: "Promotional messages",
    preferenceDescription: "About upcoming events, activities and socials.",
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

/** A volunteer's announcement preferences, as stored on `User`. */
export type AnnouncementPreferences = {
  receiveShortageNotifications: boolean;
  announcementOptOuts: readonly AnnouncementCategory[];
};

/**
 * Optional categories that are opted out of through
 * `User.announcementOptOuts`. Shift shortages aren't here: they follow the
 * shortage-alert switch instead.
 */
export const LISTED_OPT_OUT_CATEGORIES: readonly AnnouncementCategory[] =
  ANNOUNCEMENT_CATEGORIES.filter(
    (c) => !c.mandatory && c.value !== "SHIFT_SHORTAGE"
  ).map((c) => c.value);

/**
 * Coerce an untrusted `announcementOptOuts` value from a profile update into
 * a clean list. Unknown values, duplicates and categories that can't be
 * opted out of this way (mandatory ones, and shift shortages) are dropped,
 * so a stale or hand-crafted client can't opt anyone out of a mandatory
 * announcement.
 */
export function sanitizeAnnouncementOptOuts(
  value: readonly unknown[]
): AnnouncementCategory[] {
  return LISTED_OPT_OUT_CATEGORIES.filter((c) => value.includes(c));
}

/**
 * Has this volunteer opted out of announcements in this category? In-memory
 * twin of the opt-out condition in announcement-targeting.ts, used by the
 * mobile feed. Mandatory categories always reach everyone.
 */
export function isOptedOutOfAnnouncementCategory(
  prefs: AnnouncementPreferences,
  category: AnnouncementCategory
): boolean {
  if (announcementCategoryMeta(category).mandatory) return false;
  if (category === "SHIFT_SHORTAGE") return !prefs.receiveShortageNotifications;
  return prefs.announcementOptOuts.includes(category);
}

/** Where volunteers change what they hear from us, linked from email footers. */
export const NOTIFICATION_SETTINGS_PATH = "/profile/edit?step=communication";

const FOOTER_REASON =
  "You are receiving this email because you are a registered volunteer at Everybody Eats.";

/**
 * The "why am I getting this" line at the bottom of an announcement email
 * (and the shortage alert email). Optional categories say how to turn them
 * off; mandatory ones say they can't be, so nobody hunts for a switch that
 * doesn't exist. The email template follows it with a link to
 * NOTIFICATION_SETTINGS_PATH.
 */
export function announcementEmailFooter(category: AnnouncementCategory): string {
  switch (category) {
    case "SHIFT_RELATED":
      return `${FOOTER_REASON} Messages about shifts you are signed up for can't be turned off, but you can choose which other messages you get.`;
    case "URGENT":
      return `${FOOTER_REASON} Urgent notices go to every volunteer and can't be turned off, but you can choose which other messages you get.`;
    case "SHIFT_SHORTAGE":
      return `${FOOTER_REASON} Shift shortage alerts are optional, and you can turn them off or choose which shift types you hear about anytime.`;
    case "PROMOTIONAL":
      return `${FOOTER_REASON} Promotional messages are optional, and you can turn them off anytime.`;
  }
}
