"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
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
            placeholder={question.placeholder || "Enter your answer"}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => handleChange(e.target.value)}
            maxLength={question.maxLength}
            className={cn(error && "border-red-500")}
          />
        );

      case "text_long":
        return (
          <Textarea
            placeholder={question.placeholder || "Enter your answer"}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => handleChange(e.target.value)}
            maxLength={question.maxLength}
            rows={4}
            className={cn(error && "border-red-500")}
          />
        );

      case "multiple_choice_single":
        return (
          <RadioGroup
            value={typeof value === "string" ? value : undefined}
            onValueChange={handleChange}
            className="space-y-2"
          >
            {question.options?.map((option, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <RadioGroupItem
                  value={option}
                  id={`${question.id}-${idx}`}
                  className={cn(error && "border-red-500")}
                />
                <Label
                  htmlFor={`${question.id}-${idx}`}
                  className="cursor-pointer font-normal"
                >
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "multiple_choice_multi":
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {question.options?.map((option, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <Checkbox
                  id={`${question.id}-${idx}`}
                  checked={selectedValues.includes(option)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      handleChange([...selectedValues, option]);
                    } else {
                      handleChange(selectedValues.filter((v) => v !== option));
                    }
                  }}
                  className={cn(error && "border-red-500")}
                />
                <Label
                  htmlFor={`${question.id}-${idx}`}
                  className="cursor-pointer font-normal"
                >
                  {option}
                </Label>
              </div>
            ))}
          </div>
        );

      case "rating_scale":
        const min = question.minValue ?? 1;
        const max = question.maxValue ?? 5;
        const ratings = Array.from({ length: max - min + 1 }, (_, i) => min + i);
        const currentRating = typeof value === "number" ? value : undefined;

        return (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>{question.minLabel || min}</span>
              <span>{question.maxLabel || max}</span>
            </div>
            <RadioGroup
              value={currentRating?.toString()}
              onValueChange={(val) => handleChange(parseInt(val))}
              className="flex justify-between gap-1"
            >
              {ratings.map((rating) => (
                <div key={rating} className="flex flex-col items-center">
                  <RadioGroupItem
                    value={rating.toString()}
                    id={`${question.id}-${rating}`}
                    className={cn(
                      "h-10 w-10",
                      error && "border-red-500"
                    )}
                  />
                  <Label
                    htmlFor={`${question.id}-${rating}`}
                    className="text-sm mt-1 cursor-pointer"
                  >
                    {rating}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case "yes_no":
        return (
          <RadioGroup
            value={value === true || value === "yes" ? "yes" : value === false || value === "no" ? "no" : undefined}
            onValueChange={(val) => handleChange(val === "yes")}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="yes"
                id={`${question.id}-yes`}
                className={cn(error && "border-red-500")}
              />
              <Label
                htmlFor={`${question.id}-yes`}
                className="cursor-pointer font-normal"
              >
                Yes
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="no"
                id={`${question.id}-no`}
                className={cn(error && "border-red-500")}
              />
              <Label
                htmlFor={`${question.id}-no`}
                className="cursor-pointer font-normal"
              >
                No
              </Label>
            </div>
          </RadioGroup>
        );

      default:
        return <p className="text-muted-foreground">Unknown question type</p>;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-1">
        <Label className="text-base font-medium">
          {question.text}
          {question.required && (
            <span className="text-red-500 ml-1">*</span>
          )}
        </Label>
      </div>
      {renderQuestionInput()}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
