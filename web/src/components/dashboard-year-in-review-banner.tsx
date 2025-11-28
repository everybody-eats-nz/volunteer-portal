"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { YearInReviewButton } from "@/components/year-in-review";
import { Sparkles, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function DashboardYearInReviewBanner() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if the feature is seasonally available
    fetch("/api/year-in-review/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: new Date().getFullYear() - 1 }),
    })
      .then((res) => {
        // If we get 403, it's not seasonally available
        // If we get 404, user has no stats but feature is available
        // If we get 200, feature is available
        setIsAvailable(res.status !== 403);
      })
      .catch(() => {
        setIsAvailable(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Don't render during loading or if not available
  if (isLoading || !isAvailable) {
    return null;
  }

  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mb-6"
    >
      <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-background to-accent/5">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Your {previousYear} Year in Review is Ready! 🎉
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Celebrate your volunteering journey with a personalized video
                  showcasing your impact this past year.
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Available through January {currentYear}</span>
                </div>
              </div>
            </div>
            <div className="shrink-0">
              <YearInReviewButton
                year={previousYear}
                size="lg"
                className="w-full sm:w-auto"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
