"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  X,
  Tags,
  AlertTriangle,
  Loader2,
  NotebookPen,
  Pencil,
} from "lucide-react";
import { CustomLabelBadge } from "@/components/custom-label-badge";
import {
  labelNoteByline,
  type LabelNoteAuthor,
} from "@/components/label-note-badge";
import { useToast } from "@/hooks/use-toast";
import { type CustomLabel } from "@/generated/client";

/** Mirrors LABEL_NOTE_MAX_LENGTH in custom-labels.server.ts. */
const NOTE_MAX_LENGTH = 1000;

type LabelWithSettings = CustomLabel & {
  watchers?: { userId: string }[];
};

type UserCustomLabel = {
  label: CustomLabel;
  note?: string | null;
  assignedAt?: Date | string;
  assignedBy?: LabelNoteAuthor | null;
};

interface UserCustomLabelsManagerProps {
  userId: string;
  currentLabels: UserCustomLabel[];
  onChange?: () => void;
}

/** What the note dialog is doing: adding a new label, or editing a note. */
type NoteTarget =
  | { mode: "add"; label: LabelWithSettings }
  | { mode: "edit"; label: CustomLabel; note: string };

export function UserCustomLabelsManager({
  userId,
  currentLabels,
  onChange,
}: UserCustomLabelsManagerProps) {
  const [labels, setLabels] = useState<UserCustomLabel[]>(currentLabels);
  const [availableLabels, setAvailableLabels] = useState<LabelWithSettings[]>(
    []
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [labelToRemove, setLabelToRemove] = useState<CustomLabel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const { toast } = useToast();

  // Fresh labels from the server (e.g. after router.refresh()) replace the
  // local copy. Done during render so the old list never shows for a frame.
  const [syncedLabels, setSyncedLabels] = useState(currentLabels);
  if (currentLabels !== syncedLabels) {
    setSyncedLabels(currentLabels);
    setLabels(currentLabels);
  }

  const fetchAvailableLabels = async () => {
    try {
      const response = await fetch("/api/admin/custom-labels");
      if (response.ok) {
        const data = await response.json();
        setAvailableLabels(data);
      }
    } catch (error) {
      console.error("Error fetching available labels:", error);
    }
  };

  const openAddDialog = () => {
    setDialogOpen(true);
    fetchAvailableLabels();
  };

  const saveAssignment = async (
    method: "POST" | "PATCH",
    labelId: string,
    note?: string
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/labels`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId, note }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.error ||
            (method === "POST" ? "Failed to add label" : "Failed to save note")
        );
      }

      const saved: UserCustomLabel = await response.json();
      setLabels((prev) =>
        method === "POST"
          ? [saved, ...prev]
          : prev.map((ul) => (ul.label.id === labelId ? saved : ul))
      );
      toast({
        title: method === "POST" ? "Label added" : "Note saved",
        description:
          method === "POST"
            ? `${saved.label.name} added to this volunteer`
            : `Updated the ${saved.label.name} note`,
      });
      onChange?.();
      return true;
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickLabel = async (label: LabelWithSettings) => {
    if (label.requiresNote) {
      setDialogOpen(false);
      setNoteDraft("");
      setNoteTarget({ mode: "add", label });
      return;
    }
    if (await saveAssignment("POST", label.id)) setDialogOpen(false);
  };

  const handleSaveNote = async () => {
    if (!noteTarget) return;
    const ok = await saveAssignment(
      noteTarget.mode === "add" ? "POST" : "PATCH",
      noteTarget.label.id,
      noteDraft
    );
    if (ok) setNoteTarget(null);
  };

  const handleRemoveClick = (label: CustomLabel) => {
    setLabelToRemove(label);
    setRemoveDialogOpen(true);
  };

  const handleRemoveConfirm = async () => {
    if (!labelToRemove) return;

    setIsRemoving(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/labels`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ labelId: labelToRemove.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove label");
      }

      setLabels((prev) =>
        prev.filter((ul) => ul.label.id !== labelToRemove.id)
      );

      toast({
        title: "Success",
        description: "Label removed from user",
      });

      setRemoveDialogOpen(false);
      setLabelToRemove(null);
      onChange?.();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to remove label",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const availableToAdd = availableLabels.filter(
    (label) => !labels.some((ul) => ul.label.id === label.id)
  );
  const withNotes = labels.filter((ul) => ul.note || ul.label.requiresNote);
  const noteRequired = noteTarget?.label.requiresNote ?? false;
  const watcherCount =
    noteTarget?.mode === "add" ? (noteTarget.label.watchers?.length ?? 0) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Tags className="h-5 w-5" />
            Custom Labels
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={openAddDialog}
            data-testid="add-label-button"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Label
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {labels.length === 0 ? (
          <div className="text-center py-4 text-slate-500 dark:text-slate-400">
            <Tags className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm">No custom labels assigned</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {labels.map((userLabel) => (
              <div
                key={userLabel.label.id}
                className="relative group"
                data-testid={`user-label-${userLabel.label.id}`}
              >
                <CustomLabelBadge label={userLabel.label} />
                <button
                  onClick={() => handleRemoveClick(userLabel.label)}
                  aria-label={`Remove ${userLabel.label.name}`}
                  className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 dark:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-xs hover:bg-red-600 dark:hover:bg-red-700"
                  data-testid={`remove-label-${userLabel.label.id}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {withNotes.length > 0 && (
          <ul className="space-y-2" data-testid="label-notes">
            {withNotes.map((userLabel) => {
              const byline = labelNoteByline(
                userLabel.assignedBy,
                userLabel.assignedAt
              );
              return (
                <li
                  key={userLabel.label.id}
                  className="rounded-lg border border-border bg-muted/30 p-3"
                  data-testid={`label-note-${userLabel.label.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <CustomLabelBadge
                      label={userLabel.label}
                      size="sm"
                      className="min-w-0 truncate"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="-mr-1.5 -mt-1.5 h-8 w-8 shrink-0 text-muted-foreground"
                      aria-label={`${userLabel.note ? "Edit" : "Add"} the ${userLabel.label.name} note`}
                      title={userLabel.note ? "Edit note" : "Add note"}
                      onClick={() => {
                        setNoteDraft(userLabel.note ?? "");
                        setNoteTarget({
                          mode: "edit",
                          label: userLabel.label,
                          note: userLabel.note ?? "",
                        });
                      }}
                      data-testid={`edit-label-note-${userLabel.label.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                  {userLabel.note ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                      {userLabel.note}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No note yet.
                    </p>
                  )}
                  {byline && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {byline}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {/* Pick a label */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Label</DialogTitle>
          </DialogHeader>
          <Command>
            <CommandInput placeholder="Search labels..." />
            <CommandList>
              <CommandEmpty>No labels found.</CommandEmpty>
              <CommandGroup>
                {availableToAdd.map((label) => (
                  <CommandItem
                    key={label.id}
                    value={label.name}
                    onSelect={() => handlePickLabel(label)}
                    disabled={isLoading}
                    className="cursor-pointer justify-between"
                    data-testid={`add-label-${label.id}`}
                  >
                    <CustomLabelBadge label={label} />
                    {label.requiresNote && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
                        Needs a note
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Write or edit the note */}
      <Dialog
        open={noteTarget !== null}
        onOpenChange={(open) => !open && setNoteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          {noteTarget && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveNote();
              }}
              className="space-y-4"
            >
              <DialogHeader>
                <DialogTitle>
                  {noteTarget.mode === "add"
                    ? `Add ${noteTarget.label.name}`
                    : `${noteTarget.label.name} note`}
                </DialogTitle>
                <DialogDescription>
                  {noteTarget.mode === "add"
                    ? "Say what the team needs to know or do. Only admins see this note."
                    : "Only admins see this note."}
                  {watcherCount > 0 &&
                    ` ${watcherCount} ${
                      watcherCount === 1 ? "person is" : "people are"
                    } told when this label is added.`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="label-note">
                  Note{noteRequired ? "" : " (optional)"}
                </Label>
                <Textarea
                  id="label-note"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="e.g. Please bring a support person to shifts. Check in with the manager before rostering."
                  rows={5}
                  className="min-h-28"
                  maxLength={NOTE_MAX_LENGTH}
                  required={noteRequired}
                  autoFocus
                  data-testid="label-note-input"
                />
                <p className="text-right text-xs tabular-nums text-muted-foreground">
                  {noteDraft.length}/{NOTE_MAX_LENGTH}
                </p>
              </div>

              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNoteTarget(null)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isLoading || (noteRequired && !noteDraft.trim())
                  }
                  data-testid="save-label-note-button"
                >
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  {noteTarget.mode === "add" ? "Add label" : "Save note"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove Label Confirmation Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Remove Label
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this label from the user? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {labelToRemove && (
            <div className="flex items-center justify-center p-4 bg-muted/50 dark:bg-muted/30 rounded-lg">
              <CustomLabelBadge label={labelToRemove} />
            </div>
          )}

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRemoveDialogOpen(false);
                setLabelToRemove(null);
              }}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemoveConfirm}
              disabled={isRemoving}
              data-testid="confirm-remove-label"
            >
              {isRemoving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Removing...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Remove Label
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
