"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InfoBox } from "@/components/ui/info-box";
import { MotionSpinner } from "@/components/motion-spinner";
import { UserPlus, UserPen } from "lucide-react";

interface UnregisteredVolunteerDialogProps {
  shiftId: string;
  mode: "create" | "edit";
  placeholder?: {
    id: string;
    name: string;
    notes: string | null;
  };
  children: React.ReactNode;
}

export function UnregisteredVolunteerDialog({
  shiftId,
  mode,
  placeholder,
  children,
}: UnregisteredVolunteerDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(placeholder?.name ?? "");
  const [notes, setNotes] = useState(placeholder?.notes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(placeholder?.name ?? "");
      setNotes(placeholder?.notes ?? "");
      setError(null);
    }
  }, [open, placeholder?.name, placeholder?.notes]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const url =
        mode === "create"
          ? `/api/admin/shifts/${shiftId}/placeholders`
          : `/api/admin/shifts/${shiftId}/placeholders/${placeholder!.id}`;

      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          notes: notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "Something went wrong. Please try again.");
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEdit = mode === "edit";
  const TitleIcon = isEdit ? UserPen : UserPlus;

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>{children}</ResponsiveDialogTrigger>
      <ResponsiveDialogContent
        className="sm:max-w-md"
        data-testid={`unregistered-dialog-${isEdit ? "edit" : "create"}`}
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <TitleIcon className="h-5 w-5" />
            {isEdit ? "Edit unregistered volunteer" : "Add unregistered volunteer"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {isEdit
              ? "Update the name or notes for this unregistered volunteer."
              : "Record someone who showed up without a volunteer account. They'll count toward this shift's capacity."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="unregistered-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="unregistered-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jamie Smith"
              maxLength={120}
              autoFocus
              data-testid="unregistered-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unregistered-notes">Notes (optional)</Label>
            <Textarea
              id="unregistered-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth remembering — e.g. first-timer, friend of another volunteer, dietary needs."
              rows={3}
              maxLength={1000}
              className="resize-none"
              data-testid="unregistered-notes-input"
            />
          </div>

          {error && (
            <InfoBox
              title="Couldn't save volunteer"
              variant="red"
              testId="unregistered-error"
            >
              <p className="text-red-700">{error}</p>
            </InfoBox>
          )}
        </div>

        <ResponsiveDialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
            data-testid="unregistered-cancel-button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
            className="min-w-[120px]"
            data-testid="unregistered-submit-button"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <MotionSpinner className="w-4 h-4" />
                Saving...
              </span>
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Add volunteer"
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
