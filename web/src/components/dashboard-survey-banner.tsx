"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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

export function DashboardSurveyBanner() {
  const { data: session } = useSession();
  const [surveys, setSurveys] = useState<PendingSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    // Fetch pending surveys
    fetch("/api/surveys/pending")
      .then((res) => res.json())
      .then((data) => {
        // Only show non-dismissed surveys on dashboard
        const pendingSurveys = Array.isArray(data)
          ? data.filter((s: PendingSurvey) => s.status === "PENDING")
          : [];
        setSurveys(pendingSurveys);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching surveys:", err);
        setLoading(false);
      });
  }, [session]);

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

  if (loading || !session?.user?.id || surveys.length === 0) {
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
          className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-lg p-4 mb-4"
          data-testid="survey-banner"
        >
          <div className="flex items-start gap-3">
            <ClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {survey.survey.title}
              </h3>
              {survey.survey.description && (
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  {survey.survey.description}
                </p>
              )}
              <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                We&apos;d love to hear your feedback!
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                onClick={() => handleDismiss(survey.id)}
                disabled={dismissing === survey.id}
              >
                Don&apos;t ask again
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
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
