/**
 * The category pill on an announcement feed card, so volunteers can tell a
 * shift reminder or an urgent notice from a promo at a glance.
 *
 * Mirrors `feedLabel` in web/src/lib/announcement-categories.ts and the pill
 * colours in the admin feed preview (web/src/app/admin/announcements/
 * feed-preview.tsx). Keep the three in step.
 */
export type AnnouncementCategoryPill = {
  label: string;
  backgroundColor: string;
  color: string;
};

const PILLS: Record<string, AnnouncementCategoryPill> = {
  SHIFT_RELATED: {
    label: "Your shift",
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  URGENT: { label: "Urgent", backgroundColor: "#fee2e2", color: "#991b1b" },
  SHIFT_SHORTAGE: {
    label: "Help needed",
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  PROMOTIONAL: { label: "Promo", backgroundColor: "#e0f2fe", color: "#075985" },
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
