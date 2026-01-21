"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SurveyQuestionRenderer } from "./survey-question-renderer";
import { Loader2, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { SurveyQuestion, SurveyAnswer } from "@/types/survey";
import { motion } from "motion/react";

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

  if (submitStatus === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">
                Thank you for your feedback!
              </h2>
              <p className="text-muted-foreground mb-6">
                Your response has been submitted successfully.
              </p>
              <Button asChild>
                <Link href="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
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
      transition={{ duration: 0.3 }}
    >
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          {description && (
            <CardDescription className="text-base">{description}</CardDescription>
          )}
          {userName && (
            <p className="text-sm text-muted-foreground mt-2">
              Hi {userName}, we&apos;d love to hear your thoughts!
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-8">
          {questions.map((question, index) => (
            <div key={question.id} id={`question-${question.id}`}>
              <div className="text-sm text-muted-foreground mb-2">
                Question {index + 1} of {questions.length}
              </div>
              <SurveyQuestionRenderer
                question={question}
                answer={answers.get(question.id)}
                onChange={handleAnswerChange}
                error={errors.get(question.id)}
              />
            </div>
          ))}

          {submitStatus === "error" && submitError && (
            <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg text-red-700 dark:text-red-300">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{submitError}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-6">
          <Button
            onClick={handleSubmit}
            disabled={submitStatus === "submitting"}
            size="lg"
          >
            {submitStatus === "submitting" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Survey"
            )}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
