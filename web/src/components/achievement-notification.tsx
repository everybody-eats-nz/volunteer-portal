"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AchievementNotificationProps {
  achievements: string[];
  onDismiss: () => void;
}

export default function AchievementNotification({
  achievements,
  onDismiss,
}: AchievementNotificationProps) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (achievements.length > 0) {
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Auto-dismiss after 8 seconds
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300); // Wait for animation to complete
      }, 8000);

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }
  }, [achievements, onDismiss]);

  if (!visible || achievements.length === 0) {
    return null;
  }

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300); // Wait for animation to complete
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Card
        className={`
          border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50
          shadow-lg transition-all duration-300 ease-in-out
          ${
            visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
          }
        `}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🎉</div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">
                {achievements.length === 1
                  ? "Achievement Unlocked!"
                  : "New Achievements!"}
              </h3>
              <div className="space-y-1">
                {achievements.map((achievement, index) => (
                  <p key={index} className="text-xs text-muted-foreground">
                    🏆 {achievement}
                  </p>
                ))}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 hover:bg-yellow-100"
            >
              ×
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
