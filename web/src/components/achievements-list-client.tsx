"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { formatAchievementCriteria } from "@/lib/achievement-utils";
import { EyeOff, Eye } from "lucide-react";

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  points: number;
  criteria: string;
}

interface UserAchievement {
  id: string;
  unlockedAt: Date;
  progress: number;
  achievement: Achievement;
}

interface ShiftType {
  id: string;
  name: string;
}

interface AchievementsListClientProps {
  userAchievements: UserAchievement[];
  availableAchievements: Achievement[];
  progress: {
    shifts_completed: number;
    hours_volunteered: number;
    consecutive_months: number;
    years_volunteering: number;
    community_impact: number;
    friends_count: number;
    shift_type_counts: Record<string, number>;
  };
  shiftTypes: ShiftType[];
}

interface AchievementCriteria {
  type:
    | "shifts_completed"
    | "hours_volunteered"
    | "consecutive_months"
    | "years_volunteering"
    | "community_impact"
    | "friends_count"
    | "specific_shift_type";
  value: number;
  shiftType?: string;
}

interface AchievementProgress {
  current: number;
  target: number;
  percentage: number;
  label: string;
}

/** Four-point sparkle — the marketing site's signature accent mark. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

/* Category chips — brand-cohesive (forest + sun family) so the gallery reads
   as one piece with the rest of the portal rather than a rainbow. */
const CATEGORY_COLORS = {
  MILESTONE:
    "bg-sun-200/60 text-forest-700 border-forest-500/15 dark:bg-sun-200/15 dark:text-sun-200 dark:border-cream-50/15",
  DEDICATION:
    "bg-forest-500/10 text-forest-700 border-forest-500/20 dark:bg-cream-50/10 dark:text-cream-50/85 dark:border-cream-50/15",
  SPECIALIZATION:
    "bg-forest-500/8 text-forest-700 border-forest-500/15 dark:bg-cream-50/8 dark:text-cream-50/80 dark:border-cream-50/12",
  COMMUNITY:
    "bg-cream-200/70 text-forest-700 border-forest-500/15 dark:bg-cream-50/10 dark:text-cream-50/80 dark:border-cream-50/15",
  IMPACT:
    "bg-forest-700/10 text-forest-700 border-forest-700/20 dark:bg-cream-50/10 dark:text-cream-50/85 dark:border-cream-50/15",
};

/* Filter pills — All + one per category, replacing the old boxed tab strip. */
const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "MILESTONE", label: "Milestone" },
  { value: "DEDICATION", label: "Dedication" },
  { value: "IMPACT", label: "Impact" },
  { value: "SPECIALIZATION", label: "Role" },
  { value: "COMMUNITY", label: "Community" },
];

function calculateAchievementProgress(
  achievement: Achievement,
  progress: AchievementsListClientProps["progress"]
): AchievementProgress | null {
  try {
    const criteria: AchievementCriteria = JSON.parse(achievement.criteria);
    let current = 0;
    let label = "";

    switch (criteria.type) {
      case "shifts_completed":
        current = progress.shifts_completed;
        label = `${current} / ${criteria.value} shifts`;
        break;
      case "hours_volunteered":
        current = progress.hours_volunteered;
        label = `${current} / ${criteria.value} hours`;
        break;
      case "consecutive_months":
        current = progress.consecutive_months;
        label = `${current} / ${criteria.value} months`;
        break;
      case "years_volunteering":
        current = progress.years_volunteering;
        label = `${current} / ${criteria.value} years`;
        break;
      case "community_impact":
        current = progress.community_impact;
        label = `${current} / ${criteria.value} meals`;
        break;
      case "friends_count":
        current = progress.friends_count;
        label = `${current} / ${criteria.value} friends`;
        break;
      case "specific_shift_type":
        if (criteria.shiftType) {
          current = progress.shift_type_counts[criteria.shiftType] || 0;
          label = `${current} / ${criteria.value} shifts`;
        } else {
          return null;
        }
        break;
      default:
        return null;
    }

    const percentage = Math.min((current / criteria.value) * 100, 100);

    return {
      current,
      target: criteria.value,
      percentage,
      label,
    };
  } catch (error) {
    console.error("Error parsing achievement criteria:", error);
    return null;
  }
}

export function AchievementsListClient({
  userAchievements,
  availableAchievements,
  progress,
  shiftTypes,
}: AchievementsListClientProps) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [hideCompleted, setHideCompleted] = useState(false);

  // Helper to format achievement criteria with shift type name
  const formatCriteria = (criteriaJson: string) => {
    try {
      const criteria = JSON.parse(criteriaJson);
      const shiftTypeName = criteria.shiftType
        ? shiftTypes.find((st) => st.id === criteria.shiftType)?.name
        : undefined;
      return formatAchievementCriteria(criteriaJson, shiftTypeName);
    } catch {
      return formatAchievementCriteria(criteriaJson);
    }
  };

  const allAchievements = [
    ...userAchievements.map((ua) => ({
      ...ua.achievement,
      unlocked: true,
      unlockedAt: ua.unlockedAt,
    })),
    ...availableAchievements.map((a) => ({
      ...a,
      unlocked: false,
      unlockedAt: undefined,
    })),
  ];

  // Unlocked first (most recent at the top), then locked sorted by how close
  // they are to completion, falling back to points.
  const sortAchievements = (achievements: typeof allAchievements) =>
    [...achievements].sort((a, b) => {
      if (a.unlocked && !b.unlocked) return -1;
      if (!a.unlocked && b.unlocked) return 1;

      if (a.unlocked && b.unlocked) {
        const dateA = a.unlockedAt ? new Date(a.unlockedAt).getTime() : 0;
        const dateB = b.unlockedAt ? new Date(b.unlockedAt).getTime() : 0;
        return dateB - dateA;
      }

      const progressA = calculateAchievementProgress(a, progress);
      const progressB = calculateAchievementProgress(b, progress);

      if (progressA && progressB) {
        return progressB.percentage - progressA.percentage;
      }
      if (progressA) return -1;
      if (progressB) return 1;

      return a.points - b.points;
    });

  const visibleAchievements = sortAchievements(
    allAchievements.filter((a) => {
      if (activeFilter !== "all" && a.category !== activeFilter) return false;
      if (hideCompleted && a.unlocked) return false;
      return true;
    })
  );

  const renderAchievement = (
    achievement: Achievement & { unlocked?: boolean; unlockedAt?: Date },
    index: number
  ) => {
    const achievementProgress = !achievement.unlocked
      ? calculateAchievementProgress(achievement, progress)
      : null;

    return (
      <motion.div
        key={achievement.id}
        // Each tile owns its entrance: variant propagation from an
        // already-"visible" parent never fires for tiles mounted after a
        // filter change, leaving them stuck at opacity 0.
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1],
          delay: Math.min(index * 0.05, 0.4),
        }}
        className={`grain relative flex flex-col overflow-hidden rounded-3xl border p-6 transition-[border-color,box-shadow] duration-200 hover:shadow-lg ${
          achievement.unlocked
            ? "border-forest-500/15 bg-gradient-to-br from-sun-200/50 via-sun-100/35 to-card hover:border-forest-500/25 dark:border-cream-50/15 dark:from-sun-200/15 dark:via-sun-200/5 dark:to-card dark:hover:border-cream-50/25"
            : "border-forest-500/10 bg-card hover:border-forest-500/20 dark:border-cream-50/10 dark:hover:border-cream-50/20"
        }`}
      >
        {/* Thin top accent bar — sun for unlocked, faint forest for in-progress */}
        <div
          className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${
            achievement.unlocked
              ? "from-sun-300 to-sun-200"
              : "from-forest-500/25 to-forest-300/25 dark:from-cream-50/15 dark:to-cream-50/5"
          }`}
        />

        <div className="flex items-start justify-between gap-3">
          {/* Per-achievement emoji — kept deliberately: it carries the
              achievement's identity. Unlocked medals sit on a forest tile. */}
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${
              achievement.unlocked
                ? "bg-forest-500 shadow-md dark:bg-forest-600"
                : "bg-forest-500/8 ring-1 ring-forest-500/10 dark:bg-cream-50/8 dark:ring-cream-50/10"
            }`}
          >
            <span className={achievement.unlocked ? "" : "opacity-50 grayscale"}>
              {achievement.icon}
            </span>
          </span>
          <span
            className={`whitespace-nowrap text-sm font-semibold ${
              achievement.unlocked
                ? "text-forest-700 dark:text-sun-200"
                : "text-forest-700/55 dark:text-cream-50/50"
            }`}
          >
            {achievement.unlocked && "+"}
            {achievement.points} pts
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <h5 className="text-base font-semibold text-forest-700 dark:text-cream-50">
            {achievement.name}
          </h5>
          {achievement.unlocked && (
            <Sparkle className="h-3.5 w-3.5 shrink-0 text-sun-300" />
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={`text-xs ${
              CATEGORY_COLORS[
                achievement.category as keyof typeof CATEGORY_COLORS
              ]
            }`}
          >
            {achievement.category}
          </Badge>
          {achievement.unlocked && (
            <Badge
              variant="secondary"
              className="border border-forest-500/15 bg-forest-500/10 text-xs text-forest-700 dark:border-cream-50/15 dark:bg-cream-50/10 dark:text-cream-50/85"
            >
              Unlocked
            </Badge>
          )}
        </div>

        {achievement.unlocked && (
          <p className="mt-3 text-sm leading-relaxed text-forest-700/70 dark:text-cream-50/65">
            {achievement.description}
          </p>
        )}

        <p className="mt-4 text-xs leading-relaxed text-forest-700/60 dark:text-cream-50/55">
          <span className="font-medium">Criteria:</span>{" "}
          {formatCriteria(achievement.criteria)}
        </p>

        {achievement.unlocked && achievement.unlockedAt && (
          <p className="mt-auto pt-4 text-xs text-forest-700/55 dark:text-cream-50/50">
            Unlocked on {new Date(achievement.unlockedAt).toLocaleDateString()}
          </p>
        )}

        {achievementProgress && !achievement.unlocked && (
          <div className="mt-auto space-y-2 pt-5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-forest-700/65 dark:text-cream-50/60">
                {achievementProgress.label}
              </span>
              <span className="font-semibold text-forest-700 dark:text-cream-50/85">
                {achievementProgress.percentage.toFixed(0)}%
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-forest-500/10 dark:bg-cream-50/10"
              role="progressbar"
              aria-valuenow={Math.round(achievementProgress.percentage)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${achievement.name} progress`}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-forest-500 to-forest-300 transition-all dark:from-forest-400 dark:to-forest-300"
                style={{ width: `${achievementProgress.percentage}%` }}
              />
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <section data-testid="achievements-collection">
      {/* Section header — editorial, sits straight on the cream page */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-3 flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
            <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
            The collection
          </p>
          {/* Deliberately not a heading element: the e2e suite locates the page
              by its single /achievements/i heading (the h1). */}
          <div className="display text-3xl tracking-tight text-forest-700 sm:text-4xl dark:text-cream-50">
            All <em>Achievements</em>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHideCompleted(!hideCompleted)}
          className="flex items-center gap-2"
        >
          {hideCompleted ? (
            <>
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Show Completed</span>
            </>
          ) : (
            <>
              <EyeOff className="h-4 w-4" />
              <span className="hidden sm:inline">Hide Completed</span>
            </>
          )}
        </Button>
      </div>

      {/* Category filter pills */}
      <div
        className="mt-8 flex flex-wrap gap-2.5"
        role="tablist"
        aria-label="Filter achievements by category"
      >
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveFilter(filter.value)}
              className={`rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-forest-500 text-cream-50 shadow-md dark:bg-cream-50 dark:text-forest-700"
                  : "border border-forest-500/20 text-forest-700 hover:border-forest-500/40 hover:bg-forest-500/5 dark:border-cream-50/20 dark:text-cream-50/85 dark:hover:border-cream-50/40 dark:hover:bg-cream-50/5"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {/* Gallery grid — plain container; each tile animates itself on mount
          so filtered-in tiles always fade up correctly. */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visibleAchievements.length > 0 ? (
          visibleAchievements.map(renderAchievement)
        ) : (
          <div className="col-span-full grain relative overflow-hidden rounded-3xl border border-dashed border-forest-500/20 px-6 py-14 text-center dark:border-cream-50/20">
            <Sparkle className="mx-auto h-6 w-6 text-sun-300" />
            <p className="display mt-4 text-xl tracking-tight text-forest-700 dark:text-cream-50">
              {hideCompleted
                ? "Ka pai — nothing left to chase here!"
                : "Nothing here yet"}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-forest-700/70 dark:text-cream-50/65">
              {hideCompleted
                ? "You've completed everything in this view. Show completed to admire your mahi."
                : "Achievements in this category will appear here as they become available."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
