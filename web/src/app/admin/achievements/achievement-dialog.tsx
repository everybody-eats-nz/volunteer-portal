"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Achievement } from "@/generated/client";
import { Card, CardContent } from "@/components/ui/card";

interface AchievementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  achievement?: Achievement | null;
  onSave: (data: {
    name: string;
    description: string;
    category: string;
    icon: string;
    criteria: string;
    points: number;
    isActive?: boolean;
  }) => Promise<void>;
}

const CATEGORIES = [
  { value: "MILESTONE", label: "Milestone" },
  { value: "DEDICATION", label: "Dedication" },
  { value: "SPECIALIZATION", label: "Specialization" },
  { value: "COMMUNITY", label: "Community" },
  { value: "IMPACT", label: "Impact" },
];

const CRITERIA_TYPES = [
  { value: "shifts_completed", label: "Shifts Completed" },
  { value: "hours_volunteered", label: "Hours Volunteered" },
  { value: "consecutive_months", label: "Consecutive Months" },
  { value: "years_volunteering", label: "Years Volunteering" },
  { value: "community_impact", label: "Community Impact (Meals)" },
];

const ICON_OPTIONS = [
  "🌟",
  "⭐",
  "🎯",
  "🏆",
  "👑",
  "⏰",
  "💪",
  "🏃",
  "💯",
  "📅",
  "🗓️",
  "🎊",
  "🎂",
  "🎉",
  "🍽️",
  "🦸",
  "⚔️",
  "🔥",
  "💎",
  "⚡",
  "✨",
  "🎖️",
];

export function AchievementDialog({
  open,
  onOpenChange,
  achievement,
  onSave,
}: AchievementDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("MILESTONE");
  const [icon, setIcon] = useState("🌟");
  const [criteriaType, setCriteriaType] = useState("shifts_completed");
  const [criteriaValue, setCriteriaValue] = useState("1");
  const [points, setPoints] = useState("10");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (achievement) {
      setName(achievement.name);
      setDescription(achievement.description);
      setCategory(achievement.category);
      setIcon(achievement.icon);
      setPoints(achievement.points.toString());

      // Parse criteria
      try {
        const parsedCriteria = JSON.parse(achievement.criteria);
        setCriteriaType(parsedCriteria.type || "shifts_completed");
        setCriteriaValue(parsedCriteria.value?.toString() || "1");
      } catch (e) {
        console.error("Failed to parse criteria:", e);
      }
    } else {
      setName("");
      setDescription("");
      setCategory("MILESTONE");
      setIcon("🌟");
      setCriteriaType("shifts_completed");
      setCriteriaValue("1");
      setPoints("10");
    }
  }, [achievement, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !description.trim() || !icon) {
      return;
    }

    const criteriaObj = {
      type: criteriaType,
      value: parseInt(criteriaValue, 10),
    };

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        category,
        icon,
        criteria: JSON.stringify(criteriaObj),
        points: parseInt(points, 10),
        isActive: achievement?.isActive ?? true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCriteriaDescription = () => {
    const value = parseInt(criteriaValue, 10) || 0;
    switch (criteriaType) {
      case "shifts_completed":
        return `Complete ${value} volunteer shift${value !== 1 ? "s" : ""}`;
      case "hours_volunteered":
        return `Volunteer for ${value} hour${value !== 1 ? "s" : ""}`;
      case "consecutive_months":
        return `Volunteer for ${value} consecutive month${value !== 1 ? "s" : ""}`;
      case "years_volunteering":
        return `Volunteer for ${value} year${value !== 1 ? "s" : ""}`;
      case "community_impact":
        return `Help prepare an estimated ${value} meal${value !== 1 ? "s" : ""}`;
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {achievement ? "Edit Achievement" : "Create Achievement"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="achievement-name">Name *</Label>
              <Input
                id="achievement-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter achievement name"
                required
                maxLength={100}
                data-testid="achievement-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="achievement-category">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger
                  id="achievement-category"
                  data-testid="achievement-category-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="achievement-description">Description *</Label>
            <Textarea
              id="achievement-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter achievement description"
              required
              maxLength={500}
              rows={3}
              data-testid="achievement-description-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="achievement-icon">Icon *</Label>
            <Input
              id="achievement-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="Enter or paste any emoji (e.g., 🎉)"
              required
              maxLength={10}
              className="text-2xl h-12"
              data-testid="achievement-icon-input"
            />
            <p className="text-xs text-slate-500">
              Quick select or paste any emoji above
            </p>
            <div className="grid grid-cols-11 gap-1">
              {ICON_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`
                    p-2 text-2xl hover:bg-slate-100 rounded transition-colors
                    ${icon === emoji ? "bg-slate-200 ring-2 ring-slate-400" : ""}
                  `}
                  data-testid={`icon-option-${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="criteria-type">Criteria Type *</Label>
              <Select value={criteriaType} onValueChange={setCriteriaType}>
                <SelectTrigger
                  id="criteria-type"
                  data-testid="criteria-type-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRITERIA_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="criteria-value">Criteria Value *</Label>
              <Input
                id="criteria-value"
                type="number"
                min="1"
                value={criteriaValue}
                onChange={(e) => setCriteriaValue(e.target.value)}
                placeholder="Enter value"
                required
                data-testid="criteria-value-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="achievement-points">Points *</Label>
            <Input
              id="achievement-points"
              type="number"
              min="0"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="Enter points"
              required
              data-testid="achievement-points-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Preview</Label>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{icon}</div>
                  <div>
                    <h4 className="font-semibold text-lg">
                      {name.trim() || "Achievement Name"}
                    </h4>
                    <p className="text-slate-600 text-sm mt-1">
                      {description.trim() || "Achievement description"}
                    </p>
                    <p className="text-slate-500 text-xs mt-2">
                      {getCriteriaDescription() || "Criteria description"}
                    </p>
                    <div className="mt-2 text-sm text-slate-500">
                      <span className="font-medium">{points || 0}</span> points
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !name.trim() || !description.trim() || isSubmitting
              }
              data-testid="save-achievement-button"
            >
              {isSubmitting
                ? "Saving..."
                : achievement
                  ? "Update"
                  : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
