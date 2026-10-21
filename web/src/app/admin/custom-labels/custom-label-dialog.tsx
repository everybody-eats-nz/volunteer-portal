"use client";

import { useState } from "react";
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
import {
  COLOR_OPTIONS,
  ICON_OPTIONS,
  FAMILY_THEME,
  firstGrapheme,
} from "./label-colors";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        {/* Mounted per open, so the form always starts from the label being
            edited (or a blank one). */}
        <CustomLabelForm
          key={label?.id ?? "new"}
          label={label}
          onSave={onSave}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CustomLabelForm({
  label,
  onSave,
  onCancel,
}: Omit<CustomLabelDialogProps, "open" | "onOpenChange"> & {
  onCancel: () => void;
}) {
  const [name, setName] = useState(label?.name ?? "");
  const [color, setColor] = useState(label?.color ?? COLOR_OPTIONS[0].value);
  const [icon, setIcon] = useState(label?.icon ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <>
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
          <Label id="label-colour-heading">Colour</Label>
          <div
            className="grid grid-cols-4 gap-2"
            role="group"
            aria-labelledby="label-colour-heading"
          >
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
                      ? "border-transparent ring-2 ring-primary-text ring-offset-2 ring-offset-background"
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
                    {selected && <Check className="h-4 w-4" aria-hidden="true" />}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {option.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label id="label-icon-heading">Icon</Label>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-labelledby="label-icon-heading"
          >
            <button
              type="button"
              onClick={() => setIcon("")}
              aria-label="No icon"
              aria-pressed={icon === ""}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground transition-colors",
                icon === ""
                  ? "border-primary-text bg-primary-light text-primary-text"
                  : "border-border hover:bg-muted"
              )}
              data-testid="icon-option-none"
            >
              <Ban className="h-4 w-4" aria-hidden="true" />
            </button>
            {ICON_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                aria-label={`Use ${emoji} as the icon`}
                aria-pressed={icon === emoji}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-all",
                  icon === emoji
                    ? "border-primary-text bg-primary-light ring-1 ring-primary-text"
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
            onChange={(e) => setIcon(firstGrapheme(e.target.value))}
            placeholder="…or paste your own emoji"
            aria-label="Custom icon emoji"
            className="mt-1"
            data-testid="label-icon-input"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
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
            disabled={!name.trim() || isSubmitting}
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
    </>
  );
}
