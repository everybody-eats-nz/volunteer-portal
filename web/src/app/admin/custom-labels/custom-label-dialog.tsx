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
import { Switch } from "@/components/ui/switch";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CustomLabelBadge } from "@/components/custom-label-badge";
import { Check, Ban, BellRing, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { type CustomLabel } from "@/generated/client";
import {
  COLOR_OPTIONS,
  ICON_OPTIONS,
  FAMILY_THEME,
  firstGrapheme,
} from "./label-colors";

/** An admin who can be told when a label goes on someone. */
export interface AdminOption {
  id: string;
  name: string;
  email: string;
}

export interface LabelFormData {
  name: string;
  color: string;
  icon?: string;
  requiresNote: boolean;
  watcherIds: string[];
}

interface CustomLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: (CustomLabel & { watchers?: { userId: string }[] }) | null;
  admins: AdminOption[];
  onSave: (data: LabelFormData) => Promise<void>;
}

export function CustomLabelDialog({
  open,
  onOpenChange,
  label,
  admins,
  onSave,
}: CustomLabelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[460px]">
        {/* Mounted per open, so the form always starts from the label being
            edited (or a blank one). */}
        <CustomLabelForm
          key={label?.id ?? "new"}
          label={label}
          admins={admins}
          onSave={onSave}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CustomLabelForm({
  label,
  admins,
  onSave,
  onCancel,
}: Omit<CustomLabelDialogProps, "open" | "onOpenChange"> & {
  onCancel: () => void;
}) {
  const [name, setName] = useState(label?.name ?? "");
  const [color, setColor] = useState(label?.color ?? COLOR_OPTIONS[0].value);
  const [icon, setIcon] = useState(label?.icon ?? "");
  const [requiresNote, setRequiresNote] = useState(label?.requiresNote ?? false);
  const [watcherIds, setWatcherIds] = useState<string[]>(
    label?.watchers?.map((w) => w.userId) ?? []
  );
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
        requiresNote,
        watcherIds,
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
    requiresNote,
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

        <div className="space-y-4 rounded-xl border border-border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="label-requires-note">Ask for a note</Label>
              <p className="text-xs text-muted-foreground">
                Whoever adds this label has to say why. Only admins see the
                note, on the volunteer&apos;s profile and on shift rosters.
              </p>
            </div>
            <Switch
              id="label-requires-note"
              checked={requiresNote}
              onCheckedChange={setRequiresNote}
              data-testid="label-requires-note-switch"
            />
          </div>

          <WatcherPicker
            admins={admins}
            selected={watcherIds}
            onChange={setWatcherIds}
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

function WatcherPicker({
  admins,
  selected,
  onChange,
}: {
  admins: AdminOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const byId = new Map(admins.map((a) => [a.id, a]));
  const chosen = selected
    .map((id) => byId.get(id))
    .filter((a): a is AdminOption => Boolean(a));
  const available = admins.filter((a) => !selected.includes(a.id));

  return (
    <div className="space-y-2" data-testid="label-watchers">
      <div className="space-y-1">
        <Label id="label-watchers-heading">Tell these people when it&apos;s added</Label>
        <p className="text-xs text-muted-foreground">
          They get a notification and an email each time this label goes on a
          volunteer.
        </p>
      </div>

      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-labelledby="label-watchers-heading">
          {chosen.map((admin) => (
            <li
              key={admin.id}
              className="flex items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pl-2.5 pr-0.5 text-xs font-medium"
              title={admin.email}
              data-testid={`label-watcher-${admin.id}`}
            >
              <BellRing className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              {admin.name}
              <button
                type="button"
                onClick={() => onChange(selected.filter((id) => id !== admin.id))}
                aria-label={`Stop telling ${admin.name}`}
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={available.length === 0}
            data-testid="add-label-watcher-button"
          >
            <UserPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {chosen.length === 0 ? "Choose people" : "Add someone"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search admins…" />
            <CommandList>
              <CommandEmpty>No admins found.</CommandEmpty>
              <CommandGroup>
                {available.map((admin) => (
                  <CommandItem
                    key={admin.id}
                    value={`${admin.name} ${admin.email}`}
                    onSelect={() => {
                      onChange([...selected, admin.id]);
                      setOpen(false);
                    }}
                    data-testid={`watcher-option-${admin.id}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{admin.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {admin.email}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
