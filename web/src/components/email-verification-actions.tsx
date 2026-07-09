"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck, Send } from "lucide-react";
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

interface EmailVerificationActionsProps {
  userId: string;
  email: string;
  displayName: string;
}

const NOTE_MAX_LENGTH = 500;

export function EmailVerificationActions({
  userId,
  email,
  displayName,
}: EmailVerificationActionsProps) {
  const router = useRouter();
  const [isResending, setIsResending] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [note, setNote] = useState("");
  const [isMarking, setIsMarking] = useState(false);
  const [error, setError] = useState("");

  const handleResend = async () => {
    setIsResending(true);
    try {
      const response = await fetch(
        `/api/admin/users/${userId}/email-verification`,
        { method: "POST" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to send verification email");
      }
      toast.success(`Verification email sent to ${email}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send verification email"
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleMarkVerified = async () => {
    setIsMarking(true);
    setError("");
    try {
      const trimmed = note.trim();
      const response = await fetch(
        `/api/admin/users/${userId}/email-verification`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trimmed ? { note: trimmed } : {}),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to mark email as verified");
      }
      toast.success(`${displayName}'s email has been marked as verified`);
      setIsDialogOpen(false);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while marking the email as verified"
      );
    } finally {
      setIsMarking(false);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (isMarking) return;
    setIsDialogOpen(open);
    if (!open) {
      setNote("");
      setError("");
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={handleResend}
        disabled={isResending}
        data-testid="resend-verification-email-button"
      >
        {isResending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {isResending ? "Sending…" : "Resend verification email"}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            data-testid="mark-email-verified-button"
          >
            <MailCheck className="h-4 w-4" />
            Mark as verified
          </Button>
        </DialogTrigger>
        <DialogContent
          className="sm:max-w-md"
          data-testid="mark-email-verified-dialog"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <MailCheck className="h-5 w-5" />
              Mark email as verified
            </DialogTitle>
            <DialogDescription className="text-base">
              Verify <strong>{displayName}</strong> ({email}) without them
              clicking the link. Only do this if you have confirmed they can
              receive email at this address — for example over the phone or in
              person.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="mark-verified-note" className="text-sm font-medium">
              Reason{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="mark-verified-note"
              placeholder="e.g. Confirmed email address over the phone"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX_LENGTH))}
              disabled={isMarking}
              rows={3}
              data-testid="mark-email-verified-note-input"
            />
            <p className="text-xs text-muted-foreground">
              An admin note is added to this profile recording the override.
            </p>
          </div>

          {error && (
            <Alert
              className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20"
              data-testid="mark-email-verified-error"
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
              onClick={() => setIsDialogOpen(false)}
              disabled={isMarking}
              data-testid="mark-email-verified-cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleMarkVerified}
              disabled={isMarking}
              className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              data-testid="mark-email-verified-confirm-button"
            >
              {isMarking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Marking…
                </>
              ) : (
                <>
                  <MailCheck className="mr-2 h-4 w-4" />
                  Mark as verified
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
