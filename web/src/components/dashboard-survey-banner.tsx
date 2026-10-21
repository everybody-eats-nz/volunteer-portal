"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronDown, ClipboardList } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEntrance } from "@/hooks/use-entrance";
import { cn } from "@/lib/utils";

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

const dismissButtonClassName =
  "text-forest-700/80 hover:bg-forest-500/10 hover:text-forest-700 dark:text-cream-50/75 dark:hover:bg-cream-50/10 dark:hover:text-cream-50";

/**
 * Pending surveys on the dashboard. The oldest gets a full card; any others
 * fold behind an "N more surveys" toggle, so a backlog of surveys never
 * pushes the rest of the dashboard below the fold.
 */
export function DashboardSurveyBanner({
  initialSurveys,
}: DashboardSurveyBannerProps) {
  const [surveys, setSurveys] = useState<PendingSurvey[]>(initialSurveys);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const entrance = useEntrance();
  const moreListId = useId();

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

  const [featured, ...more] = surveys;

  return (
    <motion.section
      initial={entrance({ opacity: 0, y: -10 })}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="grain relative mb-4 overflow-hidden rounded-2xl border border-forest-500/15 bg-forest-500/5 dark:border-cream-50/12 dark:bg-cream-50/5"
      aria-label="Surveys"
      data-testid="survey-banner"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={featured.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-start gap-3 p-4"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest-500/10 text-forest-600 ring-1 ring-forest-500/10 dark:bg-cream-50/10 dark:text-cream-50/80 dark:ring-cream-50/10">
            <ClipboardList className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-forest-700 dark:text-cream-50">
              {featured.survey.title}
            </h3>
            {featured.survey.description && (
              <p className="mt-1 text-sm text-forest-700/80 dark:text-cream-50/75">
                {featured.survey.description}
              </p>
            )}
            <p className="mt-1 text-xs text-forest-700/70 dark:text-cream-50/60">
              We&apos;d love to hear your feedback!
            </p>
            <div className="mt-3 flex flex-col items-stretch gap-2 sm:hidden">
              <Button asChild size="sm">
                <Link href={`/surveys/${featured.token}`}>
                  <ClipboardList className="h-4 w-4" aria-hidden />
                  Take survey
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={dismissButtonClassName}
                onClick={() => handleDismiss(featured.id)}
                disabled={dismissing === featured.id}
              >
                Don&apos;t ask again
              </Button>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <Button
              size="sm"
              variant="ghost"
              className={dismissButtonClassName}
              onClick={() => handleDismiss(featured.id)}
              disabled={dismissing === featured.id}
            >
              Don&apos;t ask again
            </Button>
            <Button asChild size="sm">
              <Link href={`/surveys/${featured.token}`}>
                <ClipboardList className="h-4 w-4" aria-hidden />
                Take survey
              </Link>
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      {more.length > 0 && (
        <div className="border-t border-forest-500/10 dark:border-cream-50/10">
          <button
            type="button"
            onClick={() => setShowMore((open) => !open)}
            aria-expanded={showMore}
            aria-controls={moreListId}
            className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm font-medium text-forest-700 transition-colors hover:bg-forest-500/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring dark:text-cream-50 dark:hover:bg-cream-50/5"
            data-testid="survey-banner-more-toggle"
          >
            {more.length === 1
              ? "1 more survey"
              : `${more.length.toLocaleString("en-NZ")} more surveys`}
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 transition-transform",
                showMore && "rotate-180"
              )}
              aria-hidden
            />
          </button>
          {showMore && (
            <ul
              id={moreListId}
              className="divide-y divide-forest-500/10 border-t border-forest-500/10 dark:divide-cream-50/10 dark:border-cream-50/10"
            >
              {more.map((survey) => (
                <li
                  key={survey.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
                >
                  <span className="min-w-0 flex-1 text-sm text-forest-700 dark:text-cream-50">
                    {survey.survey.title}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={dismissButtonClassName}
                      onClick={() => handleDismiss(survey.id)}
                      disabled={dismissing === survey.id}
                    >
                      Don&apos;t ask again
                      <span className="sr-only">: {survey.survey.title}</span>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/surveys/${survey.token}`}>
                        Take survey
                        <span className="sr-only">: {survey.survey.title}</span>
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </motion.section>
  );
}
