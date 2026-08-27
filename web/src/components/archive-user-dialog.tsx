"use client";

import { useEffect, useState } from "react";
import { Archive, AlertTriangle, Loader2 } from "lucide-react";
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

interface ArchiveUserDialogProps {
  user: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  children: React.ReactNode;
}

interface ArchiveImpact {
  upcomingConfirmed: number;
  upcomingPending: number;
  activeRegulars: number;
}

const NOTE_MAX_LENGTH = 500;

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

/**
 * Builds the "still booked on..." sentence. Returns null when the volunteer has
 * nothing outstanding, so the warning block stays hidden in the common case.
 */
function describeImpact(impact: ArchiveImpact): string | null {
  const parts: string[] = [];
  if (impact.upcomingConfirmed > 0) {
    parts.push(`${plural(impact.upcomingConfirmed, "confirmed shift")}`);
  }
  if (impact.upcomingPending > 0) {
    parts.push(`${plural(impact.upcomingPending, "pending signup")}`);
  }
  if (impact.activeRegulars > 0) {
    parts.push(`${plural(impact.activeRegulars, "active regular slot")}`);
  }
  if (parts.length === 0) return null;

  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return list;
}

export function ArchiveUserDialog({ user, children }: ArchiveUserDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [impact, setImpact] = useState<ArchiveImpact | null>(null);

  const displayName =
    user.name ||
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    user.email;

  // Load the impact preview when the dialog opens. A failure here is not worth
  // blocking the archive on - the warning block simply stays hidden.
  useEffect(() => {
    if (!isOpen) return;
    let canceled = false;

    fetch(`/api/admin/users/${user.id}/archive`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ArchiveImpact | null) => {
        if (!canceled && data) setImpact(data);
      })
      .catch(() => {
        // Non-fatal: archiving stays available without the preview.
      });

    return () => {
      canceled = true;
    };
  }, [isOpen, user.id]);

  const handleArchive = async () => {
    setIsSubmitting(true);
    setError("");

    try {
      const trimmed = note.trim();
      const response = await fetch(`/api/admin/users/${user.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "MANUAL",
          ...(trimmed ? { note: trimmed } : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to archive user");
      }

      toast.success(`${displayName} has been archived`);
      setIsOpen(false);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while archiving the user"
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
      setImpact(null);
    }
  };

  const impactSummary = impact ? describeImpact(impact) : null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="archive-user-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Archive className="h-5 w-5" />
            Archive volunteer
          </DialogTitle>
          <DialogDescription className="text-base">
            Archive <strong>{displayName}</strong> ({user.email}). They will not
            be able to sign in, and they drop out of active volunteer counts.
            Their history, signups, and achievements stay intact, and you can
            reactivate them at any time.
          </DialogDescription>
        </DialogHeader>

        {impactSummary && (
          <div
            className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800/60 dark:bg-amber-950/40"
            data-testid="archive-user-impact"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700 dark:text-amber-300" />
            <p className="text-amber-900 dark:text-amber-100">
              This volunteer still has {impactSummary}. Archiving leaves those in
              place - cancel or reassign them first if someone else needs to
              cover.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="archive-note" className="text-sm font-medium">
            Note{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Textarea
            id="archive-note"
            placeholder="e.g. Moved overseas, asked to be taken off the roster"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX_LENGTH))}
            disabled={isSubmitting}
            rows={3}
            data-testid="archive-user-note-input"
          />
          <p className="text-xs text-muted-foreground text-right">
            {note.length}/{NOTE_MAX_LENGTH}
          </p>
        </div>

        {error && (
          <Alert
            className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20"
            data-testid="archive-user-error"
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
            data-testid="archive-user-cancel-button"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleArchive}
            disabled={isSubmitting}
            className="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
            data-testid="archive-user-confirm-button"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Archiving…
              </>
            ) : (
              <>
                <Archive className="mr-2 h-4 w-4" />
                Archive volunteer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
