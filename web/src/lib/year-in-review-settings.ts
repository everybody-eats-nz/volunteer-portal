import { prisma } from "@/lib/prisma";
import { nowInNZT } from "@/lib/timezone";

/**
 * Whether volunteers can see their "Year in mahi" video, and which year it
 * covers. Stored as site settings under their own category; the admin page at
 * /admin/year-in-review edits them (the generic site-settings form skips
 * this category).
 */

export const YEAR_IN_REVIEW_CATEGORY = "YEAR_IN_REVIEW";

const KEYS = {
  enabled: "YEAR_IN_REVIEW_ENABLED",
  year: "YEAR_IN_REVIEW_YEAR",
} as const;

export type YearInReviewSettings = {
  /** Shown to everyone with a completed shift that year, admin or not. */
  enabled: boolean;
  year: number;
};

/** Years an admin can pick: this NZ year and the four before it. */
export function selectableYears(): number[] {
  const current = nowInNZT().getFullYear();
  return Array.from({ length: 5 }, (_, i) => current - i);
}

export async function getYearInReviewSettings(): Promise<YearInReviewSettings> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: Object.values(KEYS) } },
    select: { key: true, value: true },
  });
  const value = (key: string) => rows.find((r) => r.key === key)?.value;
  const year = Number(value(KEYS.year));

  return {
    enabled: value(KEYS.enabled) === "true",
    year: Number.isInteger(year) ? year : nowInNZT().getFullYear(),
  };
}

export async function saveYearInReviewSettings(
  settings: YearInReviewSettings,
  adminId: string
): Promise<void> {
  const rows = [
    {
      key: KEYS.enabled,
      value: String(settings.enabled),
      description: "Show volunteers their Year in mahi video",
    },
    {
      key: KEYS.year,
      value: String(settings.year),
      description: "Which year the Year in mahi video covers",
    },
  ];
  await prisma.$transaction(
    rows.map((row) =>
      prisma.siteSetting.upsert({
        where: { key: row.key },
        create: { ...row, category: YEAR_IN_REVIEW_CATEGORY, updatedBy: adminId },
        update: { value: row.value, updatedBy: adminId },
      })
    )
  );
}

/**
 * Everyone can open their video once it's switched on. Admins can open
 * theirs before that, to check the year before everyone else sees it.
 */
export function canViewYearInReview(
  settings: YearInReviewSettings,
  role: string | undefined
): boolean {
  return settings.enabled || role === "ADMIN";
}
