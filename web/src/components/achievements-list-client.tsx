"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/motion";
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

const CATEGORY_COLORS = {
  MILESTONE: "bg-yellow-100 text-yellow-800 border-yellow-200",
  DEDICATION: "bg-blue-100 text-blue-800 border-blue-200",
  SPECIALIZATION: "bg-green-100 text-green-800 border-green-200",
  COMMUNITY: "bg-purple-100 text-purple-800 border-purple-200",
  IMPACT: "bg-red-100 text-red-800 border-red-200",
};

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
  const [activeTab, setActiveTab] = useState("all");
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

  // Group achievements by category
  const allAchievements = [
    ...userAchievements.map((ua) => ({
      ...ua.achievement,
      unlocked: true,
      unlockedAt: ua.unlockedAt,
    })),
    ...availableAchievements.map((a) => ({ ...a, unlocked: false, unlockedAt: undefined })),
  ];
  const categories = [
    "MILESTONE",
    "DEDICATION",
    "IMPACT",
    "SPECIALIZATION",
    "COMMUNITY",
  ];

  const getAchievementsByCategory = (category: string) => {
    return allAchievements.filter((a) => a.category === category);
  };

  const filterAchievements = (achievements: typeof allAchievements) => {
    if (hideCompleted) {
      return achievements.filter((a) => !a.unlocked);
    }
    return achievements;
  };

  const renderAchievement = (
    achievement: Achievement & { unlocked?: boolean; unlockedAt?: Date }
  ) => {
    const achievementProgress = !achievement.unlocked
      ? calculateAchievementProgress(achievement, progress)
      : null;

    return (
      <motion.div
        variants={staggerItem}
        key={achievement.id}
        className={`flex flex-col gap-3 p-4 rounded-lg border ${
          achievement.unlocked
            ? "bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 border-yellow-200 dark:border-yellow-700"
            : "border-muted/10"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`text-3xl flex-shrink-0 ${
              !achievement.unlocked && "opacity-60"
            }`}
          >
            {achievement.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h5 className="font-medium text-base">{achievement.name}</h5>
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
                <Badge variant="secondary" className="text-xs">
                  Unlocked
                </Badge>
              )}
            </div>
            {achievement.unlocked && (
              <p className="text-sm text-muted-foreground mt-1">
                {achievement.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground/80 mt-2 flex items-center gap-1.5">
              <span className="font-medium">Criteria:</span>
              {formatCriteria(achievement.criteria)}
            </p>
            {achievement.unlocked && achievement.unlockedAt && (
              <p className="text-xs text-muted-foreground mt-1.5">
                Unlocked on{" "}
                {new Date(achievement.unlockedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            {achievement.unlocked && "+"}
            {achievement.points} pts
          </div>
        </div>

        {achievementProgress && !achievement.unlocked && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {achievementProgress.label}
              </span>
              <span className="font-medium">
                {achievementProgress.percentage.toFixed(0)}%
              </span>
            </div>
            <Progress value={achievementProgress.percentage} className="h-2" />
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>All Achievements</CardTitle>
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
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="MILESTONE">Milestone</TabsTrigger>
            <TabsTrigger value="DEDICATION">Dedication</TabsTrigger>
            <TabsTrigger value="IMPACT">Impact</TabsTrigger>
            <TabsTrigger value="SPECIALIZATION">Role</TabsTrigger>
            <TabsTrigger value="COMMUNITY">Community</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <motion.div
              className="grid gap-3"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {filterAchievements(allAchievements)
                .sort((a, b) => {
                  // Sort by unlocked status first
                  if (a.unlocked && !b.unlocked) return -1;
                  if (!a.unlocked && b.unlocked) return 1;

                  // For unlocked achievements, sort by unlock date (most recent first)
                  if (a.unlocked && b.unlocked) {
                    const dateA = a.unlockedAt ? new Date(a.unlockedAt).getTime() : 0;
                    const dateB = b.unlockedAt ? new Date(b.unlockedAt).getTime() : 0;
                    return dateB - dateA;
                  }

                  // For locked achievements, sort by progress percentage (highest first)
                  const progressA = calculateAchievementProgress(a, progress);
                  const progressB = calculateAchievementProgress(b, progress);

                  if (progressA && progressB) {
                    return progressB.percentage - progressA.percentage;
                  }
                  if (progressA) return -1;
                  if (progressB) return 1;

                  // Fallback to points
                  return a.points - b.points;
                })
                .map(renderAchievement)}
            </motion.div>
          </TabsContent>

          {categories.map((category) => (
            <TabsContent key={category} value={category} className="mt-6">
              <motion.div
                className="grid gap-3"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {filterAchievements(getAchievementsByCategory(category))
                  .sort((a, b) => {
                    // Sort by unlocked status first
                    if (a.unlocked && !b.unlocked) return -1;
                    if (!a.unlocked && b.unlocked) return 1;

                    // For unlocked achievements, sort by unlock date (most recent first)
                    if (a.unlocked && b.unlocked) {
                      const dateA = a.unlockedAt ? new Date(a.unlockedAt).getTime() : 0;
                      const dateB = b.unlockedAt ? new Date(b.unlockedAt).getTime() : 0;
                      return dateB - dateA;
                    }

                    // For locked achievements, sort by progress percentage (highest first)
                    const progressA = calculateAchievementProgress(a, progress);
                    const progressB = calculateAchievementProgress(b, progress);

                    if (progressA && progressB) {
                      return progressB.percentage - progressA.percentage;
                    }
                    if (progressA) return -1;
                    if (progressB) return 1;

                    // Fallback to points
                    return a.points - b.points;
                  })
                  .map(renderAchievement)}
              </motion.div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
