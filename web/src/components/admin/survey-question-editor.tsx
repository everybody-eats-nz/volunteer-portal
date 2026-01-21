"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Plus,
  X,
} from "lucide-react";
import {
  QUESTION_TYPE_DISPLAY,
  type SurveyQuestion,
  type SurveyQuestionType,
} from "@/types/survey";
import { cn } from "@/lib/utils";

interface SurveyQuestionEditorProps {
  question: SurveyQuestion;
  index: number;
  totalQuestions: number;
  onChange: (question: SurveyQuestion) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
  error?: string;
}

export function SurveyQuestionEditor({
  question,
  index,
  totalQuestions,
  onChange,
  onRemove,
  onMove,
  error,
}: SurveyQuestionEditorProps) {
  const handleChange = (field: keyof SurveyQuestion, value: unknown) => {
    onChange({ ...question, [field]: value });
  };

  const handleTypeChange = (type: SurveyQuestionType) => {
    const updated = { ...question, type };

    // Set default values based on type
    if (type === "multiple_choice_single" || type === "multiple_choice_multi") {
      if (!updated.options || updated.options.length === 0) {
        updated.options = ["Option 1", "Option 2"];
      }
    }

    if (type === "rating_scale") {
      if (updated.minValue === undefined) updated.minValue = 1;
      if (updated.maxValue === undefined) updated.maxValue = 5;
    }

    onChange(updated);
  };

  const handleAddOption = () => {
    const options = question.options || [];
    handleChange("options", [...options, `Option ${options.length + 1}`]);
  };

  const handleOptionChange = (optIndex: number, value: string) => {
    const options = [...(question.options || [])];
    options[optIndex] = value;
    handleChange("options", options);
  };

  const handleRemoveOption = (optIndex: number) => {
    const options = (question.options || []).filter((_, i) => i !== optIndex);
    handleChange("options", options);
  };

  const needsOptions =
    question.type === "multiple_choice_single" ||
    question.type === "multiple_choice_multi";

  const needsRatingConfig = question.type === "rating_scale";

  return (
    <Card className={cn(error && "border-red-500")}>
      <CardContent className="pt-4">
        <div className="flex items-start gap-2">
          {/* Drag handle and move buttons */}
          <div className="flex flex-col items-center gap-1 pt-1">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onMove("up")}
              disabled={index === 0}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onMove("down")}
              disabled={index === totalQuestions - 1}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>

          {/* Question content */}
          <div className="flex-1 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Question {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemove}
                disabled={totalQuestions <= 1}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Question text */}
            <div className="space-y-2">
              <Label>Question Text</Label>
              <Input
                value={question.text}
                onChange={(e) => handleChange("text", e.target.value)}
                placeholder="Enter your question"
                className={cn(!question.text && error && "border-red-500")}
              />
            </div>

            {/* Type and Required */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select
                  value={question.type}
                  onValueChange={(v) => handleTypeChange(v as SurveyQuestionType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(QUESTION_TYPE_DISPLAY) as SurveyQuestionType[]).map(
                      (type) => (
                        <SelectItem key={type} value={type}>
                          {QUESTION_TYPE_DISPLAY[type].label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {QUESTION_TYPE_DISPLAY[question.type].description}
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-8">
                <Switch
                  id={`required-${question.id}`}
                  checked={question.required}
                  onCheckedChange={(checked) => handleChange("required", checked)}
                />
                <Label htmlFor={`required-${question.id}`}>Required</Label>
              </div>
            </div>

            {/* Options for multiple choice */}
            {needsOptions && (
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="space-y-2">
                  {(question.options || []).map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <Input
                        value={option}
                        onChange={(e) =>
                          handleOptionChange(optIndex, e.target.value)
                        }
                        placeholder={`Option ${optIndex + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOption(optIndex)}
                        disabled={(question.options?.length || 0) <= 2}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddOption}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Option
                  </Button>
                </div>
              </div>
            )}

            {/* Rating scale config */}
            {needsRatingConfig && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Value</Label>
                  <Input
                    type="number"
                    value={question.minValue ?? 1}
                    onChange={(e) =>
                      handleChange("minValue", parseInt(e.target.value) || 1)
                    }
                    min={0}
                  />
                  <Input
                    value={question.minLabel ?? ""}
                    onChange={(e) => handleChange("minLabel", e.target.value)}
                    placeholder="Min label (e.g., Not at all)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Value</Label>
                  <Input
                    type="number"
                    value={question.maxValue ?? 5}
                    onChange={(e) =>
                      handleChange("maxValue", parseInt(e.target.value) || 5)
                    }
                    min={1}
                  />
                  <Input
                    value={question.maxLabel ?? ""}
                    onChange={(e) => handleChange("maxLabel", e.target.value)}
                    placeholder="Max label (e.g., Extremely likely)"
                  />
                </div>
              </div>
            )}

            {/* Text field config */}
            {(question.type === "text_short" ||
              question.type === "text_long") && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Placeholder</Label>
                  <Input
                    value={question.placeholder ?? ""}
                    onChange={(e) => handleChange("placeholder", e.target.value)}
                    placeholder="Enter placeholder text"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Length</Label>
                  <Input
                    type="number"
                    value={question.maxLength ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "maxLength",
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    placeholder="No limit"
                    min={1}
                  />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
