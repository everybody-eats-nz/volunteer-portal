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
  onSave: (data: { name: string; color: string; icon?: string }) => Promise<void>;
}

// Predefined color options that match volunteer grade colors
const COLOR_OPTIONS = [
  {
    name: "Purple",
    value: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
  },
  {
    name: "Blue", 
    value: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  },
  {
    name: "Green",
    value: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  },
  {
    name: "Yellow",
    value: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  },
  {
    name: "Pink",
    value: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",
  },
  {
    name: "Indigo",
    value: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
  },
  {
    name: "Teal",
    value: "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100",
  },
  {
    name: "Orange",
    value: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
  },
];

// Common emoji options for icons
const ICON_OPTIONS = [
  "⭐", "🔥", "💎", "🏆", "🎯", "⚡", "🌟", "🎖️", 
  "👑", "🔔", "📌", "🚀", "✨", "💝", "🎪", "🌈"
];

export function CustomLabelDialog({ 
  open, 
  onOpenChange, 
  label, 
  onSave 
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
          <DialogTitle>
            {label ? "Edit Label" : "Create Label"}
          </DialogTitle>
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
                    ${color === option.value ? "ring-2 ring-offset-2 ring-slate-400" : ""}
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
                      p-1 text-lg hover:bg-slate-100 rounded
                      ${icon === emoji ? "bg-slate-200" : ""}
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
            <div className="p-3 bg-slate-50 rounded">
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