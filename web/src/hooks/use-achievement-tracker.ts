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
 * Stores previous achievement state and compares with current to find new ones
 */
export function useAchievementTracker() {
  const [previousAchievementIds, setPreviousAchievementIds] = useState<Set<string>>(new Set());
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Check for achievements and detect new ones
   */
  const checkAchievements = async (): Promise<AchievementsData | null> => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/achievements");
      
      if (!response.ok) {
        console.error("Failed to fetch achievements");
        return null;
      }

      const data: AchievementsData = await response.json();
      
      // Get current achievement IDs
      const currentAchievementIds = new Set(
        data.userAchievements.map(ua => ua.achievement.id)
      );

      // Find newly unlocked achievements
      const newlyUnlocked: Achievement[] = [];
      
      // Only check for new achievements if we have a previous state
      if (previousAchievementIds.size > 0) {
        data.userAchievements.forEach(userAchievement => {
          if (!previousAchievementIds.has(userAchievement.achievement.id)) {
            newlyUnlocked.push(userAchievement.achievement);
          }
        });
      }

      // Update state
      setPreviousAchievementIds(currentAchievementIds);
      
      if (newlyUnlocked.length > 0) {
        setNewAchievements(newlyUnlocked);
        setShowCelebration(true);
        
        console.log(`🎉 New achievements unlocked:`, newlyUnlocked.map(a => a.name));
      }

      return data;
    } catch (error) {
      console.error("Error checking achievements:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Initialize the tracker with current achievements (without showing celebration)
   */
  const initializeTracker = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/achievements");
      
      if (!response.ok) {
        console.error("Failed to initialize achievement tracker");
        return;
      }

      const data: AchievementsData = await response.json();
      
      // Set initial state without triggering celebration
      const currentAchievementIds = new Set(
        data.userAchievements.map(ua => ua.achievement.id)
      );
      
      setPreviousAchievementIds(currentAchievementIds);
      console.log(`📊 Achievement tracker initialized with ${currentAchievementIds.size} achievements`);
    } catch (error) {
      console.error("Error initializing achievement tracker:", error);
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
    setPreviousAchievementIds(new Set());
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
    initializeTracker,
    closeCelebration,
    resetTracker,
  };
}
