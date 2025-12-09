"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  points: number;
}

interface AchievementCelebrationDialogProps {
  achievements: Achievement[];
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_COLORS = {
  MILESTONE: "bg-yellow-100 text-yellow-800 border-yellow-200",
  DEDICATION: "bg-blue-100 text-blue-800 border-blue-200",
  SPECIALIZATION: "bg-green-100 text-green-800 border-green-200",
  COMMUNITY: "bg-purple-100 text-purple-800 border-purple-200",
  IMPACT: "bg-red-100 text-red-800 border-red-200",
};

/**
 * Achievement celebration dialog with confetti animation
 * Shows when new achievements are unlocked on dashboard visit
 */
export function AchievementCelebrationDialog({
  achievements,
  isOpen,
  onClose,
}: AchievementCelebrationDialogProps) {
  // Trigger confetti when dialog opens
  useEffect(() => {
    if (isOpen && achievements.length > 0) {
      // Create a celebratory confetti effect similar to auto-approval
      const colors = ["#FFD700", "#FFA500", "#FF6347", "#98FB98", "#87CEEB"];

      // First burst
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors,
      });

      // Second burst with delay
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors,
        });
      }, 200);

      // Third burst with delay
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors,
        });
      }, 400);
    }
  }, [isOpen, achievements.length]);

  if (!achievements.length) return null;

  const totalPoints = achievements.reduce(
    (sum, achievement) => sum + achievement.points,
    0
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex flex-col items-center space-y-2"
            >
              <motion.div
                animate={{
                  rotate: [0, -10, 10, -10, 10, 0],
                  scale: [1, 1.1, 1, 1.1, 1],
                }}
                transition={{
                  duration: 2,
                  ease: "easeInOut",
                  times: [0, 0.2, 0.4, 0.6, 0.8, 1],
                }}
                className="text-6xl"
              >
                🎉
              </motion.div>
              <h2 className="text-xl font-bold text-primary">
                Achievement{achievements.length > 1 ? "s" : ""} Unlocked!
              </h2>
              <Badge variant="secondary" className="text-sm">
                +{totalPoints} points earned
              </Badge>
            </motion.div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2">
          <AnimatePresence>
            {achievements.map((achievement, index) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                  ease: "easeOut",
                }}
                className="relative px-1 py-1"
              >
                <motion.div
                  className="p-4 rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 border-2 border-yellow-200 dark:border-yellow-700 shadow-lg"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="text-3xl flex-shrink-0"
                      animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0],
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      {achievement.icon}
                    </motion.div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                          {achievement.name}
                        </h3>
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
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        {achievement.description}
                      </p>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-yellow-700 dark:text-yellow-300">
                          +{achievement.points} points
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="flex justify-center pt-4 shrink-0">
          <Button onClick={onClose} className="font-medium px-8">
            Awesome!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
