"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PendingSurvey {
  id: string;
  status: "PENDING" | "DISMISSED";
  assignedAt: string;
  dismissedAt: string | null;
  survey: {
    id: string;
    title: string;
    description: string | null;
  };
  token: string;
  expiresAt: string;
}

interface DashboardSurveyBannerProps {
  /** Loaded by DashboardSurveyBannerServer for the signed-in volunteer. */
  initialSurveys: PendingSurvey[];
}

export function DashboardSurveyBanner({
  initialSurveys,
}: DashboardSurveyBannerProps) {
  const [surveys, setSurveys] = useState<PendingSurvey[]>(initialSurveys);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const handleDismiss = async (assignmentId: string) => {
    setDismissing(assignmentId);
    try {
      const response = await fetch(
        `/api/surveys/assignments/${assignmentId}/dismiss`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        // Remove from list after successful dismiss
        setSurveys((prev) => prev.filter((s) => s.id !== assignmentId));
      }
    } catch (err) {
      console.error("Error dismissing survey:", err);
    } finally {
      setDismissing(null);
    }
  };

  if (surveys.length === 0) {
    return null;
  }

  return (
    <AnimatePresence mode="sync">
      {surveys.map((survey, index) => (
        <motion.div
          key={survey.id}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.2, delay: index * 0.1 }}
          className="grain relative mb-4 overflow-hidden rounded-2xl border border-forest-500/15 bg-forest-500/5 p-4 dark:border-cream-50/12 dark:bg-cream-50/5"
          data-testid="survey-banner"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest-500/10 text-forest-600 ring-1 ring-forest-500/10 dark:bg-cream-50/10 dark:text-cream-50/80 dark:ring-cream-50/10">
              <ClipboardList className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-forest-700 dark:text-cream-50">
                {survey.survey.title}
              </h3>
              {survey.survey.description && (
                <p className="mt-1 text-sm text-forest-700/80 dark:text-cream-50/75">
                  {survey.survey.description}
                </p>
              )}
              <p className="mt-1 text-xs text-forest-700/65 dark:text-cream-50/60">
                We&apos;d love to hear your feedback!
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 sm:hidden">
                <Button asChild size="sm">
                  <Link
                    href={`/surveys/${survey.token}`}
                    className="flex items-center justify-center gap-1"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Take Survey
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-forest-700/80 hover:bg-forest-500/10 hover:text-forest-700 dark:text-cream-50/70 dark:hover:bg-cream-50/10 dark:hover:text-cream-50"
                  onClick={() => handleDismiss(survey.id)}
                  disabled={dismissing === survey.id}
                >
                  Don&apos;t ask again
                </Button>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="text-forest-700/80 hover:bg-forest-500/10 hover:text-forest-700 dark:text-cream-50/70 dark:hover:bg-cream-50/10 dark:hover:text-cream-50"
                onClick={() => handleDismiss(survey.id)}
                disabled={dismissing === survey.id}
              >
                Don&apos;t ask again
              </Button>
              <Button asChild size="sm">
                <Link
                  href={`/surveys/${survey.token}`}
                  className="flex items-center gap-1"
                >
                  <ClipboardList className="h-4 w-4" />
                  Take Survey
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
