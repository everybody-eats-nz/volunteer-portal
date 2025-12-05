"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion } from "motion/react";
import { slideUpVariants, staggerContainer, staggerItem } from "@/lib/motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

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

interface AchievementsData {
  userAchievements: UserAchievement[];
  availableAchievements: Achievement[];
  progress: {
    shifts_completed: number;
    hours_volunteered: number;
    consecutive_months: number;
    years_volunteering: number;
    community_impact: number;
    shift_type_counts: Record<string, number>;
  };
  totalPoints: number;
  newAchievements: string[];
}

const CATEGORY_COLORS = {
  MILESTONE: "bg-yellow-100 text-yellow-800 border-yellow-200",
  DEDICATION: "bg-blue-100 text-blue-800 border-blue-200",
  SPECIALIZATION: "bg-green-100 text-green-800 border-green-200",
  COMMUNITY: "bg-purple-100 text-purple-800 border-purple-200",
  IMPACT: "bg-red-100 text-red-800 border-red-200",
};

interface AchievementCriteria {
  type:
    | "shifts_completed"
    | "hours_volunteered"
    | "consecutive_months"
    | "years_volunteering"
    | "community_impact"
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

export default function AchievementsCard() {
  const [achievementsData, setAchievementsData] =
    useState<AchievementsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAchievements();
  }, []);

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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              Achievements
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
                className="rounded-full h-8 w-8 border-b-2 border-primary"
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

  const { userAchievements, availableAchievements, totalPoints } =
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
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              Achievements
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="secondary"
                className="text-xs sm:text-sm whitespace-nowrap"
              >
                {totalPoints} points
              </Badge>
              <Badge
                variant="outline"
                className="hidden sm:inline-flex text-xs sm:text-sm whitespace-nowrap"
              >
                {userAchievements.length} unlocked
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recent Achievements */}
          {recentAchievements.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-3">
                Recent Achievements
              </h4>
              <motion.div
                className="grid gap-3"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {recentAchievements.map((userAchievement) => (
                  <motion.div
                    variants={staggerItem}
                    key={userAchievement.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 border border-yellow-200 dark:border-yellow-700"
                  >
                    <div className="text-2xl flex-shrink-0">
                      {userAchievement.achievement.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="font-medium text-sm">
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
                      <p className="text-xs text-muted-foreground mt-1">
                        {userAchievement.achievement.description}
                      </p>
                    </div>
                    <div className="text-xs font-medium text-yellow-700 dark:text-yellow-300 whitespace-nowrap">
                      +{userAchievement.achievement.points}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}

          {/* Next Achievements */}
          {nextAchievements.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-3">
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
                    <motion.div
                      variants={staggerItem}
                      key={achievement.id}
                      className="flex flex-col gap-3 p-3 rounded-lg border border-muted/10"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl flex-shrink-0 opacity-60">
                          {achievement.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="font-medium text-sm">
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
                          <p className="text-xs text-muted-foreground mt-1">
                            {achievement.description}
                          </p>
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
                <span className="text-muted-foreground">
                  ({userAchievements.length + availableAchievements.length})
                </span>
                <ArrowRight className="h-4 w-4 flex-shrink-0" />
              </Link>
            </Button>
          )}

          {/* Empty State */}
          {userAchievements.length === 0 && (
            <div className="text-center py-6">
              <div className="text-4xl mb-2">🎯</div>
              <h4 className="font-medium mb-1">Start Your Journey!</h4>
              <p className="text-sm text-muted-foreground">
                Complete your first shift to unlock achievements
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
