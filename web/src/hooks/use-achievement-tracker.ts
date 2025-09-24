"use client";

import { useState, useEffect } from "react";

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

/**
 * Hook to track achievements and detect new unlocks
 * Uses localStorage to track last dashboard visit and unlockedAt timestamps
 */
export function useAchievementTracker() {
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Check for achievements unlocked since last dashboard visit
   */
  const checkAchievements = async (): Promise<AchievementsData | null> => {
    try {
      setIsLoading(true);

      // Get last dashboard visit time from localStorage
      const lastVisitKey = "dashboard_last_visit";
      const lastVisit = localStorage.getItem(lastVisitKey);
      const lastVisitTime = lastVisit ? new Date(lastVisit) : new Date(0); // Use epoch if never visited

      // Trigger achievement calculation to unlock any new ones
      const response = await fetch("/api/achievements");
      if (!response.ok) {
        console.error("Failed to fetch achievements");
        return null;
      }
      const data: AchievementsData = await response.json();

      // Find achievements unlocked since last visit
      const recentAchievements: Achievement[] = [];
      data.userAchievements.forEach((userAchievement) => {
        const unlockedAt = new Date(userAchievement.unlockedAt);
        if (unlockedAt > lastVisitTime) {
          recentAchievements.push(userAchievement.achievement);
        }
      });

      if (recentAchievements.length > 0) {
        setNewAchievements(recentAchievements);
        setShowCelebration(true);

        console.log(
          `🎉 Found ${recentAchievements.length} achievements unlocked since last visit:`,
          recentAchievements.map((a) => a.name)
        );
      }

      // Update last visit time AFTER checking for new achievements
      localStorage.setItem(lastVisitKey, new Date().toISOString());

      return data;
    } catch (error) {
      console.error("Error checking achievements:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Close the celebration dialog
   */
  const closeCelebration = () => {
    setShowCelebration(false);
    setNewAchievements([]);
  };

  /**
   * Reset the tracker (useful for testing or manual reset)
   */
  const resetTracker = () => {
    setNewAchievements([]);
    setShowCelebration(false);
  };

  return {
    // State
    newAchievements,
    showCelebration,
    isLoading,

    // Actions
    checkAchievements,
    closeCelebration,
    resetTracker,
  };
}
