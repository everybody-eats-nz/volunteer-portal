"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomLabelBadge } from "@/components/custom-label-badge";
import { Check, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { type CustomLabel } from "@/generated/client";
import { COLOR_OPTIONS, ICON_OPTIONS, FAMILY_THEME } from "./label-colors";

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
    if (!name.trim() || !color) return;
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
    name: name.trim() || "Label name",
    color,
    icon: icon.trim() || null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="font-accent text-xl">
            {label ? "Edit label" : "Create a label"}
          </DialogTitle>
          <DialogDescription>
            {label
              ? "Update the name, colour or icon for this label."
              : "Name it, pick a colour, and add an optional icon."}
          </DialogDescription>
        </DialogHeader>

        {/* Live preview */}
        <div className="flex items-center justify-center rounded-xl border border-border bg-gradient-to-br from-muted/60 to-muted/20 py-6">
          <CustomLabelBadge label={previewLabel} size="lg" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="label-name">Label name</Label>
            <Input
              id="label-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kitchen lead, First aider…"
              required
              autoFocus
              maxLength={40}
              data-testid="label-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label>Colour</Label>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_OPTIONS.map((option) => {
                const theme = FAMILY_THEME[option.family];
                const selected = color === option.value;
                return (
                  <button
                    key={option.name}
                    type="button"
                    onClick={() => setColor(option.value)}
                    aria-pressed={selected}
                    className={cn(
                      "group flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition-all",
                      selected
                        ? "border-transparent ring-2 ring-[#1d5337] ring-offset-2 ring-offset-background dark:ring-emerald-400"
                        : "border-border hover:border-foreground/20 hover:bg-muted/50"
                    )}
                    data-testid={`color-option-${option.name.toLowerCase()}`}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm",
                        theme.dot
                      )}
                    >
                      {selected && <Check className="h-4 w-4" />}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {option.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setIcon("")}
                aria-label="No icon"
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground transition-colors",
                  icon === ""
                    ? "border-[#1d5337] bg-[#1d5337]/10 text-[#1d5337] dark:border-emerald-400 dark:text-emerald-300"
                    : "border-border hover:bg-muted"
                )}
                data-testid="icon-option-none"
              >
                <Ban className="h-4 w-4" />
              </button>
              {ICON_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-all",
                    icon === emoji
                      ? "border-[#1d5337] bg-[#1d5337]/10 ring-1 ring-[#1d5337] dark:border-emerald-400 dark:ring-emerald-400"
                      : "border-border hover:scale-105 hover:bg-muted"
                  )}
                  data-testid={`icon-option-${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <Input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="…or paste your own emoji"
              maxLength={2}
              className="mt-1"
              data-testid="label-icon-input"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
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
              className="bg-[#1d5337] text-white hover:bg-[#1d5337]/90"
              data-testid="save-label-button"
            >
              {isSubmitting
                ? "Saving…"
                : label
                  ? "Save changes"
                  : "Create label"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
