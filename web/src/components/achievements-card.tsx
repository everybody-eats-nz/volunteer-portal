"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "motion/react";
import { slideUpVariants, staggerContainer, staggerItem } from "@/lib/motion";
import { formatAchievementCriteria } from "@/lib/achievement-utils";
import Link from "next/link";
import { ArrowRight, Trophy, Target } from "lucide-react";

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
  unlockedAt: string;
  progress: number;
  achievement: Achievement;
}

interface ShiftType {
  id: string;
  name: string;
}

interface AchievementsData {
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
  totalPoints: number;
  newAchievements: string[];
  shiftTypes: ShiftType[];
}

/* Category chips — kept brand-cohesive (forest + sun family) rather than the
   old rainbow, so the achievements card reads as one piece with the dashboard. */
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

function getShiftTypeName(
  criteria: string,
  shiftTypes: ShiftType[]
): string | undefined {
  try {
    const parsedCriteria: AchievementCriteria = JSON.parse(criteria);
    if (parsedCriteria.type === "specific_shift_type" && parsedCriteria.shiftType) {
      const shiftType = shiftTypes.find(st => st.id === parsedCriteria.shiftType);
      return shiftType?.name;
    }
  } catch (error) {
    console.error("Error parsing criteria for shift type:", error);
  }
  return undefined;
}

function calculateAchievementProgress(
  achievement: Achievement,
  progress: AchievementsData["progress"]
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

interface AchievementsCardProps {
  initialData?: AchievementsData | null;
}

export default function AchievementsCard({ initialData }: AchievementsCardProps = {}) {
  const [achievementsData, setAchievementsData] =
    useState<AchievementsData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);

  useEffect(() => {
    // Skip fetch if server provided initial data
    if (initialData) return;
    fetchAchievements();
  }, [initialData]);

  const fetchAchievements = async () => {
    try {
      const response = await fetch("/api/achievements");
      if (response.ok) {
        const data = await response.json();
        setAchievementsData(data);
      }
    } catch (error) {
      console.error("Error fetching achievements:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <motion.div variants={slideUpVariants} initial="hidden" animate="visible">
        <Card className="grain relative overflow-hidden rounded-3xl border-forest-500/10 dark:border-cream-50/10">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-forest-500 to-forest-300 dark:from-forest-400 dark:to-forest-300" />
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-500/10 text-forest-600 ring-1 ring-forest-500/10 dark:bg-cream-50/10 dark:text-cream-50/80 dark:ring-cream-50/10">
                <Trophy className="h-5 w-5" />
              </span>
              <span className="display text-xl tracking-tight text-forest-700 dark:text-cream-50">
                Achievements
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="flex items-center justify-center"
              style={{ minHeight: "400px" }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="rounded-full h-8 w-8 border-b-2 border-forest-500 dark:border-cream-50/70"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (!achievementsData) {
    return null;
  }

  const { userAchievements, availableAchievements, totalPoints, shiftTypes } =
    achievementsData;
  const recentAchievements = userAchievements.slice(0, 3);

  // Sort available achievements by completion percentage (descending)
  const sortedAvailableAchievements = [...availableAchievements].sort((a, b) => {
    const progressA = calculateAchievementProgress(a, achievementsData.progress);
    const progressB = calculateAchievementProgress(b, achievementsData.progress);

    // Handle null progress (shouldn't happen, but just in case)
    if (!progressA && !progressB) return 0;
    if (!progressA) return 1;
    if (!progressB) return -1;

    // Sort by percentage descending (closest to completion first)
    return progressB.percentage - progressA.percentage;
  });

  const nextAchievements = sortedAvailableAchievements.slice(0, 3);

  return (
    <motion.div variants={slideUpVariants} initial="hidden" animate="visible">
      <Card className="grain relative overflow-hidden rounded-3xl border-forest-500/10 dark:border-cream-50/10">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-forest-500 to-forest-300 dark:from-forest-400 dark:to-forest-300" />
        <CardHeader>
          <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-500/10 text-forest-600 ring-1 ring-forest-500/10 dark:bg-cream-50/10 dark:text-cream-50/80 dark:ring-cream-50/10">
                <Trophy className="h-5 w-5" />
              </span>
              <span className="display text-xl tracking-tight text-forest-700 dark:text-cream-50">
                Achievements
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="secondary"
                className="whitespace-nowrap border border-forest-500/15 bg-forest-500/8 text-xs text-forest-700 sm:text-sm dark:border-cream-50/15 dark:bg-cream-50/10 dark:text-cream-50/85"
              >
                {totalPoints} points
              </Badge>
              <Badge
                variant="outline"
                className="hidden whitespace-nowrap border-forest-500/20 text-xs text-forest-700 sm:inline-flex sm:text-sm dark:border-cream-50/20 dark:text-cream-50/85"
              >
                {userAchievements.length} unlocked
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TooltipProvider>
            {/* Recent Achievements */}
            {recentAchievements.length > 0 && (
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-forest-700/70 dark:text-cream-50/65">
                  <span className="inline-block h-px w-6 bg-forest-500/40 dark:bg-cream-50/30" />
                  Recent Achievements
                </h4>
                <motion.div
                  className="grid gap-3"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {recentAchievements.map((userAchievement) => (
                    <Tooltip key={userAchievement.id}>
                      <TooltipTrigger asChild>
                        <motion.div
                          variants={staggerItem}
                          className="grain flex cursor-pointer items-center gap-3 rounded-2xl border border-forest-500/15 bg-gradient-to-r from-sun-200/40 to-sun-100/30 p-3 transition-all hover:scale-[1.01] hover:border-forest-500/25 hover:shadow-md dark:border-cream-50/15 dark:from-sun-200/10 dark:to-sun-200/5 dark:hover:border-cream-50/25"
                        >
                          <div className="text-2xl flex-shrink-0">
                            {userAchievement.achievement.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="font-medium text-sm text-forest-700 dark:text-cream-50">
                                {userAchievement.achievement.name}
                              </h5>
                              <Badge
                                variant="outline"
                                className={`text-xs whitespace-nowrap ${
                                  CATEGORY_COLORS[
                                    userAchievement.achievement
                                      .category as keyof typeof CATEGORY_COLORS
                                  ]
                                }`}
                              >
                                {userAchievement.achievement.category}
                              </Badge>
                            </div>
                            <p className="text-xs text-forest-700/65 dark:text-cream-50/60 mt-1">
                              {userAchievement.achievement.description}
                            </p>
                          </div>
                          <div className="text-xs font-semibold text-forest-700 dark:text-cream-50/85 whitespace-nowrap">
                            +{userAchievement.achievement.points}
                          </div>
                        </motion.div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">
                          {formatAchievementCriteria(
                            userAchievement.achievement.criteria,
                            getShiftTypeName(userAchievement.achievement.criteria, shiftTypes)
                          )}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
              </motion.div>
            </div>
          )}

          {/* Next Achievements */}
          {nextAchievements.length > 0 && (
            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-forest-700/70 dark:text-cream-50/65">
                <span className="inline-block h-px w-6 bg-forest-500/40 dark:bg-cream-50/30" />
                Next Goals
              </h4>
              <motion.div
                className="grid gap-3"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {nextAchievements.map((achievement) => {
                  const achievementProgress = calculateAchievementProgress(
                    achievement,
                    achievementsData.progress
                  );

                  return (
                    <Tooltip key={achievement.id}>
                      <TooltipTrigger asChild>
                        <motion.div
                          variants={staggerItem}
                          className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-forest-500/10 p-3 transition-all hover:border-forest-500/25 hover:bg-forest-500/5 hover:shadow-sm dark:border-cream-50/10 dark:hover:border-cream-50/20 dark:hover:bg-cream-50/5"
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-2xl shrink-0 opacity-60">
                              {achievement.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="font-medium text-sm text-forest-700 dark:text-cream-50">
                                  {achievement.name}
                                </h5>
                                <Badge
                                  variant="outline"
                                  className={`text-xs whitespace-nowrap ${
                                    CATEGORY_COLORS[
                                      achievement.category as keyof typeof CATEGORY_COLORS
                                    ]
                                  }`}
                                >
                                  {achievement.category}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                              {achievement.points} pts
                            </div>
                          </div>

                          {achievementProgress && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">
                                  {achievementProgress.label}
                                </span>
                                <span className="font-medium">
                                  {achievementProgress.percentage.toFixed(0)}%
                                </span>
                              </div>
                              <Progress
                                value={achievementProgress.percentage}
                                className="h-2"
                              />
                            </div>
                          )}
                        </motion.div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">
                          {formatAchievementCriteria(
                            achievement.criteria,
                            getShiftTypeName(achievement.criteria, shiftTypes)
                          )}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </motion.div>
            </div>
          )}

          {/* View All Button */}
          {(userAchievements.length > 3 ||
            availableAchievements.length > 3) && (
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link
                href="/achievements"
                className="flex items-center justify-center gap-2"
              >
                <span className="hidden sm:inline">View All Achievements</span>
                <span className="sm:hidden">View All</span>
                <span className="text-forest-700/60 dark:text-cream-50/55">
                  ({userAchievements.length + availableAchievements.length})
                </span>
                <ArrowRight className="h-4 w-4 flex-shrink-0" />
              </Link>
            </Button>
          )}

          {/* Empty State */}
          {userAchievements.length === 0 && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-forest-500/10 text-forest-600 ring-1 ring-forest-500/10 dark:bg-cream-50/10 dark:text-cream-50/80 dark:ring-cream-50/10">
                <Target className="h-8 w-8" />
              </div>
              <h4 className="display text-lg tracking-tight text-forest-700 dark:text-cream-50">
                Start Your Journey!
              </h4>
              <p className="mt-1 text-sm text-forest-700/70 dark:text-cream-50/65">
                Complete your first shift to unlock achievements
              </p>
            </div>
          )}
          </TooltipProvider>
        </CardContent>
      </Card>
    </motion.div>
  );
}
