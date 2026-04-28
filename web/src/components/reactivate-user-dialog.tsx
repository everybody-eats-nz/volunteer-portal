"use client";

import { useState } from "react";
import { ArchiveRestore, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { type ArchiveReason } from "@/generated/client";

const ARCHIVE_REASON_LABELS: Record<ArchiveReason, string> = {
  INACTIVE_12_MONTHS: "Inactive for 12+ months",
  NEVER_ACTIVATED: "Never activated",
  NEVER_MIGRATED: "Never migrated",
  MANUAL: "Manually archived",
};

interface ReactivateUserDialogProps {
  user: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    archiveReason?: ArchiveReason | null;
  };
  children: React.ReactNode;
}

const NOTE_MAX_LENGTH = 500;

export function ReactivateUserDialog({
  user,
  children,
}: ReactivateUserDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const displayName =
    user.name ||
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    user.email;

  const handleReactivate = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      const trimmed = note.trim();
      const response = await fetch(
        `/api/admin/users/${user.id}/unarchive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trimmed ? { note: trimmed } : {}),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to reactivate user");
      }

      toast.success(`${displayName} has been reactivated`);
      setIsOpen(false);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while reactivating the user"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (isSubmitting) return;
    setIsOpen(open);
    if (!open) {
      setNote("");
      setError("");
    }
  };

  const reasonLabel = user.archiveReason
    ? ARCHIVE_REASON_LABELS[user.archiveReason]
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="sm:max-w-md"
        data-testid="reactivate-user-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <ArchiveRestore className="h-5 w-5" />
            Reactivate user
          </DialogTitle>
          <DialogDescription className="text-base">
            Restore <strong>{displayName}</strong> ({user.email}) to active
            status. Their history, signups, and achievements stay intact.
          </DialogDescription>
        </DialogHeader>

        {reasonLabel && (
          <div
            className="rounded-md border border-muted bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            data-testid="reactivate-user-reason"
          >
            <span className="font-medium text-foreground">
              Archived because:
            </span>{" "}
            {reasonLabel}
          </div>
        )}

        <div className="space-y-2">
          <Label
            htmlFor="reactivate-note"
            className="text-sm font-medium"
          >
            Note{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Textarea
            id="reactivate-note"
            placeholder="e.g. Confirmed still volunteering on regular shifts"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX_LENGTH))}
            disabled={isSubmitting}
            rows={3}
            data-testid="reactivate-user-note-input"
          />
          <p className="text-xs text-muted-foreground text-right">
            {note.length}/{NOTE_MAX_LENGTH}
          </p>
        </div>

        {error && (
          <Alert
            className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20"
            data-testid="reactivate-user-error"
          >
            <AlertDescription className="text-red-800 dark:text-red-300">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
            data-testid="reactivate-user-cancel-button"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleReactivate}
            disabled={isSubmitting}
            className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            data-testid="reactivate-user-confirm-button"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reactivating…
              </>
            ) : (
              <>
                <ArchiveRestore className="mr-2 h-4 w-4" />
                Reactivate user
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
