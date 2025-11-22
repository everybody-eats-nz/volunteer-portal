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
import { CustomLabelBadge } from "@/components/custom-label-badge";
import { type CustomLabel } from "@prisma/client";

interface CustomLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: CustomLabel | null;
  onSave: (data: {
    name: string;
    color: string;
    icon?: string;
  }) => Promise<void>;
}

// Predefined color options that match volunteer grade colors
const COLOR_OPTIONS = [
  {
    name: "Purple",
    value:
      "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-950/30",
  },
  {
    name: "Blue",
    value:
      "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/30",
  },
  {
    name: "Green",
    value:
      "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/30",
  },
  {
    name: "Yellow",
    value:
      "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/30",
  },
  {
    name: "Pink",
    value:
      "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-950/30",
  },
  {
    name: "Indigo",
    value:
      "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-950/30",
  },
  {
    name: "Teal",
    value:
      "bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-950/30",
  },
  {
    name: "Orange",
    value:
      "bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-950/30",
  },
];

// Common emoji options for icons
const ICON_OPTIONS = [
  "⭐",
  "🔥",
  "💎",
  "🏆",
  "🎯",
  "⚡",
  "🌟",
  "🎖️",
  "👑",
  "🔔",
  "📌",
  "🚀",
  "✨",
  "💝",
  "🎪",
  "🌈",
];

export function CustomLabelDialog({
  open,
  onOpenChange,
  label,
  onSave,
}: CustomLabelDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0].value);
  const [icon, setIcon] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (label) {
      setName(label.name);
      setColor(label.color);
      setIcon(label.icon || "");
    } else {
      setName("");
      setColor(COLOR_OPTIONS[0].value);
      setIcon("");
    }
  }, [label, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !color) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        color,
        icon: icon.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewLabel: CustomLabel = {
    id: "preview",
    name: name.trim() || "Label Name",
    color,
    icon: icon.trim() || null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{label ? "Edit Label" : "Create Label"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label-name">Label Name</Label>
            <Input
              id="label-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter label name"
              required
              data-testid="label-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_OPTIONS.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  onClick={() => setColor(option.value)}
                  className={`
                    p-3 rounded border-2 text-xs font-medium
                    ${option.value}
                    ${
                      color === option.value
                        ? "ring-2 ring-offset-2 ring-slate-400"
                        : ""
                    }
                  `}
                  data-testid={`color-option-${option.name.toLowerCase()}`}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label-icon">Icon (optional)</Label>
            <div className="space-y-2">
              <Input
                id="label-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="Enter emoji or leave blank"
                maxLength={2}
                data-testid="label-icon-input"
              />
              <div className="grid grid-cols-8 gap-1">
                {ICON_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`
                      p-1 text-lg hover:bg-slate-100 dark:hover:bg-zinc-800 rounded
                      ${icon === emoji ? "bg-slate-200 dark:bg-zinc-700" : ""}
                    `}
                    data-testid={`icon-option-${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="p-3 bg-slate-50 dark:bg-zinc-900 rounded">
              <CustomLabelBadge label={previewLabel} />
            </div>
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
              disabled={!name.trim() || isSubmitting}
              data-testid="save-label-button"
            >
              {isSubmitting ? "Saving..." : label ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
