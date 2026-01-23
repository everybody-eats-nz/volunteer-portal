"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SurveyQuestionRenderer } from "./survey-question-renderer";
import { Loader2, CheckCircle, AlertCircle, ArrowRight, Send } from "lucide-react";
import Link from "next/link";
import type { SurveyQuestion, SurveyAnswer } from "@/types/survey";
import { motion, AnimatePresence } from "motion/react";

interface SurveyFormProps {
  token: string;
  title: string;
  description?: string | null;
  questions: SurveyQuestion[];
  userName?: string | null;
  onSuccess?: () => void;
}

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export function SurveyForm({
  token,
  title,
  description,
  questions,
  userName,
  onSuccess,
}: SurveyFormProps) {
  const [answers, setAnswers] = useState<Map<string, SurveyAnswer>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleAnswerChange = (answer: SurveyAnswer) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(answer.questionId, answer);
      return next;
    });
    // Clear error when user provides an answer
    if (errors.has(answer.questionId)) {
      setErrors((prev) => {
        const next = new Map(prev);
        next.delete(answer.questionId);
        return next;
      });
    }
  };

  const validateAnswers = (): boolean => {
    const newErrors = new Map<string, string>();

    for (const question of questions) {
      if (question.required) {
        const answer = answers.get(question.id);
        if (!answer || answer.value === null || answer.value === undefined) {
          newErrors.set(question.id, "This question is required");
          continue;
        }

        const value = answer.value;
        if (typeof value === "string" && !value.trim()) {
          newErrors.set(question.id, "This question is required");
        } else if (Array.isArray(value) && value.length === 0) {
          newErrors.set(question.id, "Please select at least one option");
        }
      }
    }

    setErrors(newErrors);
    return newErrors.size === 0;
  };

  const handleSubmit = async () => {
    if (!validateAnswers()) {
      // Scroll to first error
      const firstErrorId = errors.keys().next().value;
      if (firstErrorId) {
        const element = document.getElementById(`question-${firstErrorId}`);
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setSubmitStatus("submitting");
    setSubmitError(null);

    try {
      const response = await fetch(`/api/surveys/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Array.from(answers.values()),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit survey");
      }

      setSubmitStatus("success");
      onSuccess?.();
    } catch (err) {
      setSubmitStatus("error");
      setSubmitError(
        err instanceof Error ? err.message : "Failed to submit survey"
      );
    }
  };

  // Calculate progress
  const answeredCount = Array.from(answers.values()).filter(
    (a) => a.value !== null && a.value !== undefined && a.value !== ""
  ).length;
  const progressPercent = Math.round((answeredCount / questions.length) * 100);

  if (submitStatus === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-2xl mx-auto"
      >
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="h-2 bg-gradient-to-r from-green-400 to-emerald-500" />
          <CardContent className="pt-8 pb-10">
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h2 className="text-2xl font-bold mb-3">
                  Thank you for your feedback!
                </h2>
                <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
                  Your response helps us improve the volunteer experience for everyone.
                </p>
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto"
    >
      <Card className="overflow-hidden border-0 shadow-lg pt-0 py-0 pb-6">
        {/* Progress bar at top */}
        <div className="h-1.5 bg-muted">
          <motion.div
            className="h-full bg-linear-to-r from-primary to-primary/80"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <CardHeader className="pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Feedback Survey
            </span>
            <span className="text-xs text-muted-foreground">
              {answeredCount}/{questions.length} answered
            </span>
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {description && (
            <CardDescription className="text-base mt-1">
              {description}
            </CardDescription>
          )}
          {userName && (
            <p className="text-sm text-primary/80 mt-3 font-medium">
              Hi {userName}, we&apos;d love to hear your thoughts!
            </p>
          )}
        </CardHeader>

        <CardContent className="pt-4">
          <div className="space-y-6">
            <AnimatePresence mode="sync">
              {questions.map((question, index) => (
                <motion.div
                  key={question.id}
                  id={`question-${question.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                      {index + 1}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      of {questions.length}
                    </span>
                    {answers.get(question.id)?.value !== undefined &&
                      answers.get(question.id)?.value !== "" && (
                        <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                      )}
                  </div>
                  <SurveyQuestionRenderer
                    question={question}
                    answer={answers.get(question.id)}
                    onChange={handleAnswerChange}
                    error={errors.get(question.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {submitStatus === "error" && submitError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 mt-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300"
            >
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{submitError}</p>
            </motion.div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t px-6 py-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Progress value={progressPercent} className="w-24 h-2" />
            <span>{progressPercent}% complete</span>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={submitStatus === "submitting"}
            size="lg"
            className="w-full sm:w-auto"
          >
            {submitStatus === "submitting" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Survey
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
