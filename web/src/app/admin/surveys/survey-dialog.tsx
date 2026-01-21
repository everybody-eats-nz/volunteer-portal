"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SurveyQuestionEditor } from "@/components/admin/survey-question-editor";
import {
  SURVEY_TRIGGER_DISPLAY,
  type SurveyQuestion,
} from "@/types/survey";
import type { Survey, SurveyTriggerType } from "@/generated/client";
import { Plus, Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { EmailPreviewDialog } from "@/components/email-preview-dialog";

interface SurveyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survey: Survey | null;
  onSave: (data: {
    title: string;
    description?: string;
    questions: SurveyQuestion[];
    triggerType: SurveyTriggerType;
    triggerValue: number;
    isActive?: boolean;
  }) => Promise<void>;
}

const DEFAULT_QUESTION: Omit<SurveyQuestion, "id"> = {
  type: "text_short",
  text: "",
  required: true,
};

export function SurveyDialog({
  open,
  onOpenChange,
  survey,
  onSave,
}: SurveyDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<SurveyTriggerType>("SHIFTS_COMPLETED");
  const [triggerValue, setTriggerValue] = useState(5);
  const [isActive, setIsActive] = useState(true);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form when survey changes or dialog opens
  useEffect(() => {
    if (survey) {
      setTitle(survey.title);
      setDescription(survey.description || "");
      setTriggerType(survey.triggerType);
      setTriggerValue(survey.triggerValue);
      setIsActive(survey.isActive);
      setQuestions(survey.questions as unknown as SurveyQuestion[]);
    } else {
      setTitle("");
      setDescription("");
      setTriggerType("SHIFTS_COMPLETED");
      setTriggerValue(5);
      setIsActive(true);
      setQuestions([{ ...DEFAULT_QUESTION, id: uuidv4() }]);
    }
    setErrors({});
  }, [survey, open]);

  const handleAddQuestion = () => {
    setQuestions((prev) => [...prev, { ...DEFAULT_QUESTION, id: uuidv4() }]);
  };

  const handleQuestionChange = (index: number, question: SurveyQuestion) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = question;
      return next;
    });
    // Clear error for this question
    if (errors[`question_${index}`]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`question_${index}`];
        return next;
      });
    }
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveQuestion = (index: number, direction: "up" | "down") => {
    setQuestions((prev) => {
      const next = [...prev];
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= next.length) return prev;
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "Title is required";
    }

    if (triggerType !== "MANUAL" && triggerValue <= 0) {
      newErrors.triggerValue = "Trigger value must be greater than 0";
    }

    if (questions.length === 0) {
      newErrors.questions = "At least one question is required";
    }

    questions.forEach((q, index) => {
      if (!q.text.trim()) {
        newErrors[`question_${index}`] = "Question text is required";
      }
      if (
        (q.type === "multiple_choice_single" ||
          q.type === "multiple_choice_multi") &&
        (!q.options || q.options.length < 2)
      ) {
        newErrors[`question_${index}`] =
          "Multiple choice questions need at least 2 options";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        questions,
        triggerType,
        triggerValue,
        isActive,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {survey ? "Edit Survey" : "Create Survey"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Survey title"
                className={errors.title ? "border-red-500" : ""}
              />
              {errors.title && (
                <p className="text-sm text-red-500">{errors.title}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the survey"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Trigger Type</Label>
                <Select
                  value={triggerType}
                  onValueChange={(v) => setTriggerType(v as SurveyTriggerType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SURVEY_TRIGGER_DISPLAY) as SurveyTriggerType[]).map(
                      (type) => (
                        <SelectItem key={type} value={type}>
                          {SURVEY_TRIGGER_DISPLAY[type].label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {SURVEY_TRIGGER_DISPLAY[triggerType].description}
                </p>
              </div>

              {triggerType !== "MANUAL" && (
                <div className="space-y-2">
                  <Label htmlFor="triggerValue">
                    {SURVEY_TRIGGER_DISPLAY[triggerType].valueLabel}{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="triggerValue"
                    type="number"
                    min={1}
                    value={triggerValue}
                    onChange={(e) => setTriggerValue(parseInt(e.target.value) || 0)}
                    className={errors.triggerValue ? "border-red-500" : ""}
                  />
                  {errors.triggerValue && (
                    <p className="text-sm text-red-500">{errors.triggerValue}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Questions</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddQuestion}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Question
              </Button>
            </div>

            {errors.questions && (
              <p className="text-sm text-red-500">{errors.questions}</p>
            )}

            <div className="space-y-4">
              {questions.map((question, index) => (
                <SurveyQuestionEditor
                  key={question.id}
                  question={question}
                  index={index}
                  totalQuestions={questions.length}
                  onChange={(q) => handleQuestionChange(index, q)}
                  onRemove={() => handleRemoveQuestion(index)}
                  onMove={(direction) => handleMoveQuestion(index, direction)}
                  error={errors[`question_${index}`]}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <EmailPreviewDialog
            emailType="surveyNotification"
            triggerLabel="Preview Email"
            triggerVariant="outline"
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : survey ? (
                "Update Survey"
              ) : (
                "Create Survey"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
