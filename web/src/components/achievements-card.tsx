"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { slideUpVariants, staggerContainer, staggerItem } from "@/lib/motion";

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  points: number;
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

export default function AchievementsCard() {
  const [achievementsData, setAchievementsData] =
    useState<AchievementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

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
      <motion.div
        variants={slideUpVariants}
        initial="hidden"
        animate="visible"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
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
  const nextAchievements = availableAchievements.slice(0, 3);

  return (
    <motion.div
      variants={slideUpVariants}
      initial="hidden"
      animate="visible"
    >
      <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            Achievements
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              {totalPoints} points
            </Badge>
            <Badge variant="outline" className="text-sm">
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
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium text-sm truncate">
                        {userAchievement.achievement.name}
                      </h5>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          CATEGORY_COLORS[
                            userAchievement.achievement
                              .category as keyof typeof CATEGORY_COLORS
                          ]
                        }`}
                      >
                        {userAchievement.achievement.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {userAchievement.achievement.description}
                    </p>
                  </div>
                  <div className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
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
              {nextAchievements.map((achievement) => (
                <motion.div
                  variants={staggerItem}
                  key={achievement.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-muted/10"
                >
                  <div className="text-2xl flex-shrink-0 opacity-60">
                    {achievement.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium text-sm truncate">
                        {achievement.name}
                      </h5>
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
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {achievement.description}
                    </p>
                  </div>
                  <div className="text-xs font-medium text-muted-foreground">
                    {achievement.points} pts
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        {/* Expand/Collapse Button */}
        {(userAchievements.length > 3 || availableAchievements.length > 3) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="w-full"
          >
            {expanded
              ? "Show Less"
              : `View All (${
                  userAchievements.length + availableAchievements.length
                } total)`}
          </Button>
        )}

        {/* Expanded View */}
        {expanded && (
          <div className="space-y-4 pt-4 border-t">
            {userAchievements.length > 3 && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-3">
                  All Achievements ({userAchievements.length})
                </h4>
                <div className="grid gap-2">
                  {userAchievements.slice(3).map((userAchievement) => (
                    <div
                      key={userAchievement.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 border border-yellow-200 dark:border-yellow-700"
                    >
                      <div className="text-lg flex-shrink-0">
                        {userAchievement.achievement.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-sm truncate">
                          {userAchievement.achievement.name}
                        </h5>
                      </div>
                      <div className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                        +{userAchievement.achievement.points}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableAchievements.length > 3 && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-3">
                  Available Achievements ({availableAchievements.length})
                </h4>
                <div className="grid gap-2">
                  {availableAchievements.slice(3).map((achievement) => (
                    <div
                      key={achievement.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-muted"
                    >
                      <div className="text-lg flex-shrink-0 opacity-60">
                        {achievement.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-sm truncate">
                          {achievement.name}
                        </h5>
                      </div>
                      <div className="text-xs font-medium text-muted-foreground">
                        {achievement.points} pts
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
