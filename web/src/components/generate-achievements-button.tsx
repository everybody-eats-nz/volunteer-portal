"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GenerateAchievementsButtonProps {
  userId: string;
  userName: string;
}

export function GenerateAchievementsButton({
  userId,
  userName,
}: GenerateAchievementsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleGenerateAchievements = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/achievements/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "user", userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || "Failed to generate achievements"
        );
      }

      const data = await response.json();
      const newAchievementsCount = data.results?.newAchievements || 0;
      const achievementsList = data.results?.achievements || [];

      if (newAchievementsCount > 0) {
        toast({
          title: `${newAchievementsCount} new achievement${newAchievementsCount > 1 ? "s" : ""} unlocked!`,
          description: achievementsList.length > 0
            ? `Unlocked: ${achievementsList.join(", ")}`
            : `${userName} earned ${newAchievementsCount} new achievement${newAchievementsCount > 1 ? "s" : ""}`,
        });
        // Refresh the page to show updated data
        router.refresh();
      } else {
        toast({
          title: "No new achievements",
          description: `${userName} has already unlocked all available achievements for their current progress.`,
        });
      }
    } catch (error) {
      console.error("Generate achievements error:", error);
      toast({
        title: "Error generating achievements",
        description:
          error instanceof Error
            ? error.message
            : "Failed to generate achievements. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleGenerateAchievements}
      disabled={isLoading}
      data-testid="generate-achievements-button"
    >
      <Award className="h-4 w-4" />
      {isLoading ? "Generating..." : "Generate Achievements"}
    </Button>
  );
}
