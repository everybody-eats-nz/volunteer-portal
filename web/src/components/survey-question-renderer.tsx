"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, ThumbsUp, ThumbsDown } from "lucide-react";
import type { SurveyQuestion, SurveyAnswer } from "@/types/survey";
import { cn } from "@/lib/utils";

interface SurveyQuestionRendererProps {
  question: SurveyQuestion;
  answer: SurveyAnswer | undefined;
  onChange: (answer: SurveyAnswer) => void;
  error?: string;
}

export function SurveyQuestionRenderer({
  question,
  answer,
  onChange,
  error,
}: SurveyQuestionRendererProps) {
  const value = answer?.value;

  const handleChange = (newValue: string | string[] | number | boolean) => {
    onChange({ questionId: question.id, value: newValue });
  };

  const renderQuestionInput = () => {
    switch (question.type) {
      case "text_short":
        return (
          <Input
            type="text"
            placeholder={question.placeholder || "Type your answer here..."}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => handleChange(e.target.value)}
            maxLength={question.maxLength}
            className={cn(
              "h-12 text-base",
              error && "border-red-500 focus-visible:ring-red-500"
            )}
          />
        );

      case "text_long":
        return (
          <Textarea
            placeholder={question.placeholder || "Share your thoughts..."}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => handleChange(e.target.value)}
            maxLength={question.maxLength}
            rows={4}
            className={cn(
              "text-base resize-none",
              error && "border-red-500 focus-visible:ring-red-500"
            )}
          />
        );

      case "multiple_choice_single":
        return (
          <RadioGroup
            value={typeof value === "string" ? value : undefined}
            onValueChange={handleChange}
            className="grid gap-2.5"
          >
            {question.options?.map((option, idx) => {
              const isSelected = value === option;
              return (
                <Label
                  key={idx}
                  htmlFor={`${question.id}-${idx}`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg p-2 -ml-2 cursor-pointer transition-colors",
                    "hover:bg-muted/50",
                    isSelected && "bg-primary/5"
                  )}
                >
                  <RadioGroupItem
                    value={option}
                    id={`${question.id}-${idx}`}
                    className={cn(
                      "h-5 w-5",
                      error && "border-red-500"
                    )}
                  />
                  <span className="text-sm">{option}</span>
                </Label>
              );
            })}
          </RadioGroup>
        );

      case "multiple_choice_multi":
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="grid gap-2.5">
            {question.options?.map((option, idx) => {
              const isSelected = selectedValues.includes(option);
              return (
                <Label
                  key={idx}
                  htmlFor={`${question.id}-${idx}`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg p-2 -ml-2 cursor-pointer transition-colors",
                    "hover:bg-muted/50",
                    isSelected && "bg-primary/5"
                  )}
                >
                  <Checkbox
                    id={`${question.id}-${idx}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleChange([...selectedValues, option]);
                      } else {
                        handleChange(selectedValues.filter((v) => v !== option));
                      }
                    }}
                    className={cn(
                      "h-5 w-5",
                      error && "border-red-500"
                    )}
                  />
                  <span className="text-sm">{option}</span>
                </Label>
              );
            })}
          </div>
        );

      case "rating_scale":
        const min = question.minValue ?? 1;
        const max = question.maxValue ?? 5;
        const ratings = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        const currentRating = typeof value === "number" ? value : undefined;
        const isNPS = max === 10 && min === 0; // NPS-style (0-10)

        return (
          <div className="space-y-3">
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>{question.minLabel || `${min} - Low`}</span>
              <span>{question.maxLabel || `${max} - High`}</span>
            </div>
            <RadioGroup
              value={currentRating?.toString()}
              onValueChange={(val) => handleChange(parseInt(val))}
              className={cn(
                "flex gap-1",
                isNPS ? "justify-between" : "justify-center gap-2"
              )}
            >
              {ratings.map((rating) => {
                const isSelected = currentRating === rating;
                // Color coding for NPS: 0-6 red, 7-8 yellow, 9-10 green
                const getNPSColor = () => {
                  if (!isNPS) return isSelected ? "bg-primary" : "bg-muted";
                  if (rating <= 6) return isSelected ? "bg-red-500" : "bg-red-100 dark:bg-red-950/30";
                  if (rating <= 8) return isSelected ? "bg-amber-500" : "bg-amber-100 dark:bg-amber-950/30";
                  return isSelected ? "bg-green-500" : "bg-green-100 dark:bg-green-950/30";
                };

                return (
                  <Label
                    key={rating}
                    htmlFor={`${question.id}-${rating}`}
                    className="cursor-pointer"
                  >
                    <RadioGroupItem
                      value={rating.toString()}
                      id={`${question.id}-${rating}`}
                      className="sr-only"
                    />
                    <div
                      className={cn(
                        "flex items-center justify-center rounded-lg font-semibold transition-all",
                        isNPS ? "h-10 w-8 sm:w-10 text-sm" : "h-12 w-12 text-base",
                        isSelected
                          ? cn(getNPSColor(), "text-white shadow-md scale-110")
                          : cn(
                              getNPSColor(),
                              "hover:scale-105",
                              isNPS
                                ? rating <= 6
                                  ? "text-red-700 dark:text-red-300"
                                  : rating <= 8
                                    ? "text-amber-700 dark:text-amber-300"
                                    : "text-green-700 dark:text-green-300"
                                : "text-muted-foreground hover:bg-muted-foreground/20"
                            ),
                        error && "ring-2 ring-red-500/50"
                      )}
                    >
                      {rating}
                    </div>
                  </Label>
                );
              })}
            </RadioGroup>
            {isNPS && (
              <div className="flex justify-between text-[10px] text-muted-foreground px-1 pt-1">
                <span>Detractors</span>
                <span>Passives</span>
                <span>Promoters</span>
              </div>
            )}
          </div>
        );

      case "yes_no":
        const yesSelected = value === true || value === "yes";
        const noSelected = value === false || value === "no";
        return (
          <RadioGroup
            value={yesSelected ? "yes" : noSelected ? "no" : undefined}
            onValueChange={(val) => handleChange(val === "yes")}
            className="grid grid-cols-2 gap-3"
          >
            <Label
              htmlFor={`${question.id}-yes`}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-5 cursor-pointer transition-all",
                yesSelected
                  ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                  : "border-muted hover:border-green-300 hover:bg-green-50/50 dark:hover:bg-green-950/20",
                error && !yesSelected && "border-red-200"
              )}
            >
              <RadioGroupItem
                value="yes"
                id={`${question.id}-yes`}
                className="sr-only"
              />
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                  yesSelected
                    ? "bg-green-500 text-white"
                    : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                )}
              >
                <ThumbsUp className="h-6 w-6" />
              </div>
              <span
                className={cn(
                  "font-semibold",
                  yesSelected ? "text-green-700 dark:text-green-300" : "text-muted-foreground"
                )}
              >
                Yes
              </span>
            </Label>
            <Label
              htmlFor={`${question.id}-no`}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-xl border-2 p-5 cursor-pointer transition-all",
                noSelected
                  ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                  : "border-muted hover:border-red-300 hover:bg-red-50/50 dark:hover:bg-red-950/20",
                error && !noSelected && "border-red-200"
              )}
            >
              <RadioGroupItem
                value="no"
                id={`${question.id}-no`}
                className="sr-only"
              />
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                  noSelected
                    ? "bg-red-500 text-white"
                    : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                )}
              >
                <ThumbsDown className="h-6 w-6" />
              </div>
              <span
                className={cn(
                  "font-semibold",
                  noSelected ? "text-red-700 dark:text-red-300" : "text-muted-foreground"
                )}
              >
                No
              </span>
            </Label>
          </RadioGroup>
        );

      default:
        return <p className="text-muted-foreground">Unknown question type</p>;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-medium leading-relaxed">
          {question.text}
          {question.required && (
            <span className="text-red-500 ml-1" aria-label="required">
              *
            </span>
          )}
        </Label>
      </div>
      {renderQuestionInput()}
      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1.5">
          <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
          {error}
        </p>
      )}
    </div>
  );
}
