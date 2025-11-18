"use client";

import { useEffect } from "react";
import { AchievementCelebrationDialog } from "@/components/achievement-celebration-dialog";
import { useAchievementTracker } from "@/hooks/use-achievement-tracker";

interface AchievementTrackerProps {
  userId: string;
}

/**
 * Achievement tracker component that runs in the background
 * Handles achievement state tracking and shows celebration dialog for new achievements
 * This is a client component that doesn't interfere with server components
 */
export function AchievementTracker({ userId }: AchievementTrackerProps) {
  const {
    newAchievements,
    showCelebration,
    checkAchievements,
    closeCelebration,
  } = useAchievementTracker();

  // Check for achievements when component mounts
  useEffect(() => {
    checkAchievements();
  }, [checkAchievements, userId]);

  // Only render the celebration dialog - this component is invisible otherwise
  return (
    <AchievementCelebrationDialog
      achievements={newAchievements}
      isOpen={showCelebration}
      onClose={closeCelebration}
    />
  );
}
