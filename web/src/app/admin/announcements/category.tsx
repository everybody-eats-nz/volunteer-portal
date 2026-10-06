"use client";

import type { ReactNode } from "react";
import {
  BellOff,
  CalendarCheck,
  ChevronDown,
  HandHelping,
  Lock,
  Tag,
  TriangleAlert,
} from "lucide-react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";
import {
  ANNOUNCEMENT_CATEGORIES,
  announcementCategoryMeta,
  type AnnouncementCategory,
  type AnnouncementCategoryMeta,
} from "@/lib/announcement-categories";

const CATEGORY_ICONS: Record<AnnouncementCategory, ReactNode> = {
  SHIFT_RELATED: <CalendarCheck className="h-4 w-4" />,
  URGENT: <TriangleAlert className="h-4 w-4" />,
  SHIFT_SHORTAGE: <HandHelping className="h-4 w-4" />,
  PROMOTIONAL: <Tag className="h-4 w-4" />,
};

/** Badge tones. Always paired with the label, so colour is never the only cue. */
const CATEGORY_BADGE_TONES: Record<AnnouncementCategory, string> = {
  SHIFT_RELATED:
    "border-primary-text/25 bg-primary-text/[0.07] text-primary-text",
  URGENT:
    "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  SHIFT_SHORTAGE:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  PROMOTIONAL:
    "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

const MANDATORY = ANNOUNCEMENT_CATEGORIES.filter((c) => c.mandatory);
const OPTIONAL = ANNOUNCEMENT_CATEGORIES.filter((c) => !c.mandatory);

/**
 * Required category picker. Split into two columns, "Always delivered" and
 * "Volunteers can opt out", so the consequence of the choice is the first
 * thing an admin reads rather than a footnote. The grid flows by column so
 * each column reads top to bottom on a phone, while side-by-side cards share
 * a row height on wider screens.
 */
export function CategoryPicker({
  value,
  onChange,
}: {
  value: AnnouncementCategory | null;
  onChange: (next: AnnouncementCategory) => void;
}) {
  return (
    <RadioGroupPrimitive.Root
      value={value ?? ""}
      onValueChange={(next) => onChange(next as AnnouncementCategory)}
      required
      aria-label="Category"
      className="grid gap-2 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-[auto_1fr_1fr] sm:gap-x-4"
      data-testid="announcement-category"
    >
      <ColumnHeading icon={<Lock className="h-3 w-3" />}>
        Always delivered
      </ColumnHeading>
      {MANDATORY.map((c) => (
        <CategoryOption key={c.value} meta={c} selected={value === c.value} />
      ))}
      <ColumnHeading
        icon={<BellOff className="h-3 w-3" />}
        className="mt-3 sm:mt-0"
      >
        Volunteers can opt out
      </ColumnHeading>
      {OPTIONAL.map((c) => (
        <CategoryOption key={c.value} meta={c} selected={value === c.value} />
      ))}
    </RadioGroupPrimitive.Root>
  );
}

function ColumnHeading({
  icon,
  className,
  children,
}: {
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
        className
      )}
    >
      {icon}
      {children}
    </p>
  );
}

function CategoryOption({
  meta,
  selected,
}: {
  meta: AnnouncementCategoryMeta;
  selected: boolean;
}) {
  return (
    <RadioGroupPrimitive.Item
      value={meta.value}
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected
          ? "border-primary-text/45 bg-primary-text/[0.05]"
          : "border-border hover:border-forest-500/35 dark:hover:border-white/25"
      )}
      data-testid={`announcement-category-${meta.value}`}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          selected
            ? "bg-primary-text text-background"
            : "bg-primary-text/[0.07] text-primary-text"
        )}
        aria-hidden="true"
      >
        {CATEGORY_ICONS[meta.value]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-tight">
          {meta.label}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {meta.description}
        </span>
      </span>
      {/* Radio dot, so the card still reads as one-of-many at a glance. */}
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          selected ? "border-primary-text" : "border-forest-500/30 dark:border-white/25"
        )}
        aria-hidden="true"
      >
        <RadioGroupPrimitive.Indicator className="h-2 w-2 rounded-full bg-primary-text" />
      </span>
    </RadioGroupPrimitive.Item>
  );
}

/** Small category label for list rows. */
export function CategoryBadge({
  category,
  withChevron,
  className,
}: {
  category: AnnouncementCategory;
  /** Show a chevron when the badge opens a menu. */
  withChevron?: boolean;
  className?: string;
}) {
  const meta = announcementCategoryMeta(category);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium [&_svg]:h-3 [&_svg]:w-3",
        CATEGORY_BADGE_TONES[category],
        className
      )}
      data-testid="announcement-category-badge"
    >
      {CATEGORY_ICONS[category]}
      {meta.label}
      {meta.mandatory && (
        <span className="sr-only"> (always delivered)</span>
      )}
      {withChevron && <ChevronDown aria-hidden="true" className="opacity-70" />}
    </span>
  );
}
