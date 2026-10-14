"use client";

import { useState } from "react";
import useSWR from "swr";
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
import { formatAchievementCriteria, ACHIEVEMENT_CRITERIA_TYPES } from "@/lib/achievement-utils";

interface ShiftType {
  id: string;
  name: string;
}

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
  "🦋",
  "🤝",
  "🌐",
  "🎭",
];

function initialValues(achievement: Achievement | null | undefined) {
  const values = {
    name: "",
    description: "",
    category: "MILESTONE",
    icon: "🌟",
    criteriaType: "shifts_completed",
    criteriaValue: "1",
    shiftTypeId: "",
    points: "10",
  };
  if (!achievement) return values;

  values.name = achievement.name;
  values.description = achievement.description;
  values.category = achievement.category;
  values.icon = achievement.icon;
  values.points = achievement.points.toString();
  try {
    const parsedCriteria = JSON.parse(achievement.criteria);
    values.criteriaType = parsedCriteria.type || "shifts_completed";
    values.criteriaValue = parsedCriteria.value?.toString() || "1";
    values.shiftTypeId = parsedCriteria.shiftType || "";
  } catch (e) {
    console.error("Failed to parse criteria:", e);
  }
  return values;
}

export function AchievementDialog({
  open,
  onOpenChange,
  achievement,
  onSave,
}: AchievementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        {/* Mounted per open, so the form always starts from the achievement
            being edited (or a blank one). */}
        <AchievementForm
          key={achievement?.id ?? "new"}
          achievement={achievement}
          onSave={onSave}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AchievementForm({
  achievement,
  onSave,
  onCancel,
}: Omit<AchievementDialogProps, "open" | "onOpenChange"> & {
  onCancel: () => void;
}) {
  const [initial] = useState(() => initialValues(achievement));
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [category, setCategory] = useState(initial.category);
  const [icon, setIcon] = useState(initial.icon);
  const [criteriaType, setCriteriaType] = useState(initial.criteriaType);
  const [criteriaValue, setCriteriaValue] = useState(initial.criteriaValue);
  const [shiftTypeId, setShiftTypeId] = useState(initial.shiftTypeId);
  const [points, setPoints] = useState(initial.points);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: shiftTypes = [] } = useSWR<ShiftType[]>(
    "/api/admin/shift-types"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !description.trim() || !icon) {
      return;
    }

    // Validate shift type is selected for specific_shift_type criteria
    if (criteriaType === "specific_shift_type" && !shiftTypeId) {
      return;
    }

    const criteriaObj: {
      type: string;
      value: number;
      shiftType?: string;
    } = {
      type: criteriaType,
      value: parseInt(criteriaValue, 10),
    };

    // Add shiftType if it's a specific shift type criteria
    if (criteriaType === "specific_shift_type" && shiftTypeId) {
      criteriaObj.shiftType = shiftTypeId;
    }

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
    const criteriaObj = {
      type: criteriaType,
      value: parseInt(criteriaValue, 10),
      shiftType: shiftTypeId,
    };
    const selectedShiftType = shiftTypes.find((st) => st.id === shiftTypeId);
    return formatAchievementCriteria(
      JSON.stringify(criteriaObj),
      selectedShiftType?.name
    );
  };

  return (
    <>
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
          <p className="text-xs text-muted-foreground">
            Quick select or paste any emoji above
          </p>
          <div className="grid grid-cols-11 gap-1">
            {ICON_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                className={`
                  p-2 text-2xl hover:bg-muted rounded transition-colors
                  ${
                    icon === emoji ? "bg-muted ring-2 ring-ring" : ""
                  }
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
                {ACHIEVEMENT_CRITERIA_TYPES.map((type) => (
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

        {criteriaType === "specific_shift_type" && (
          <div className="space-y-2">
            <Label htmlFor="shift-type">Shift Type *</Label>
            <Select value={shiftTypeId} onValueChange={setShiftTypeId}>
              <SelectTrigger id="shift-type" data-testid="shift-type-select">
                <SelectValue placeholder="Select shift type" />
              </SelectTrigger>
              <SelectContent>
                {shiftTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
          <Card className="py-4">
            <CardContent>
              <div className="flex items-start gap-4">
                <div className="text-4xl">{icon}</div>
                <div>
                  <h4 className="font-semibold text-lg">
                    {name.trim() || "Achievement Name"}
                  </h4>
                  <p className="text-muted-foreground text-sm mt-1">
                    {description.trim() || "Achievement description"}
                  </p>
                  <p className="text-muted-foreground text-xs mt-2">
                    {getCriteriaDescription() || "Criteria description"}
                  </p>
                  <div className="mt-2 text-sm text-muted-foreground">
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
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!name.trim() || !description.trim() || isSubmitting}
            data-testid="save-achievement-button"
          >
            {isSubmitting ? "Saving..." : achievement ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </>
  );
}
