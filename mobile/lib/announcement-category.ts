import type { ToneName } from "@/constants/theme";

/**
 * The category pill on an announcement feed card, so volunteers can tell a
 * shift reminder or an urgent notice from a promo at a glance.
 *
 * Mirrors `feedLabel` in web/src/lib/announcement-categories.ts and the pill
 * colours in the admin feed preview (web/src/app/admin/announcements/
 * feed-preview.tsx). Keep the three in step.
 *
 * The colour is a `Tones` name rather than a hex pair so the pill has a light
 * and a dark variant: resolve it with `Tones[scheme][pill.tone]`.
 */
export type AnnouncementCategoryPill = {
  label: string;
  tone: ToneName;
};

const PILLS: Record<string, AnnouncementCategoryPill> = {
  SHIFT_RELATED: { label: "Your shift", tone: "emerald" },
  URGENT: { label: "Urgent", tone: "red" },
  SHIFT_SHORTAGE: { label: "Help needed", tone: "amber" },
  PROMOTIONAL: { label: "Promo", tone: "sky" },
};

/**
 * The pill for a category, or null when there is none to show: older API
 * responses carry no category, and a category added on the web after this
 * build shipped is unknown here.
 */
export function announcementCategoryPill(
  category: string | undefined
): AnnouncementCategoryPill | null {
  if (!category) return null;
  return PILLS[category] ?? null;
}
