"use client";

import { useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw } from "lucide-react";
import { sendFriendRequest } from "@/lib/friends-actions";
import { MotionSpinner } from "@/components/motion-spinner";

/* Form inputs — soft-rounded with forest focus ring, matching the login page. */
const inputStyles =
  "rounded-xl border-forest-500/20 focus-visible:border-forest-500 focus-visible:ring-forest-500/20 dark:border-cream-50/15";

interface SendFriendRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillEmail?: string;
}

export function SendFriendRequestForm({
  open,
  onOpenChange,
  prefillEmail = "",
}: SendFriendRequestFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    setError("");

    try {
      const result = await sendFriendRequest(formData);

      if (result.error) {
        setError(result.error);
      } else {
        onOpenChange(false);
        // Clear form by reloading the component
        const form = document.getElementById(
          "friend-request-form"
        ) as HTMLFormElement;
        form?.reset();
      }
    } catch (error) {
      console.error(error);
      setError("An error occurred while sending the friend request");
      setRetryCount((prev) => prev + 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setError("");
    setRetryCount(0);
    const form = document.getElementById(
      "friend-request-form"
    ) as HTMLFormElement;
    form?.reset();
  };

  const handleRetry = async () => {
    const form = document.getElementById(
      "friend-request-form"
    ) as HTMLFormElement;
    if (form) {
      const formData = new FormData(form);
      await handleSubmit(formData);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      <ResponsiveDialogContent
        className="sm:max-w-md"
        data-testid="send-friend-request-dialog"
      >
        <ResponsiveDialogHeader className="pb-4">
          <p className="eyebrow flex items-center gap-3 text-forest-500/80 dark:text-cream-50/60">
            <span className="inline-block h-px w-8 bg-forest-500/50 dark:bg-cream-50/40" />
            Grow the whānau
          </p>
          <ResponsiveDialogTitle className="display display-medium mt-2 text-2xl tracking-tight text-forest-700 dark:text-cream-50">
            Send Friend Request
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <form
          id="friend-request-form"
          action={handleSubmit}
          className="space-y-6"
        >
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="font-medium text-forest-700 dark:text-cream-50"
            >
              Email Address
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="friend@example.com"
              defaultValue={prefillEmail}
              required
              className={`h-11 ${inputStyles}`}
              data-testid="friend-request-email-input"
            />
            <p className="text-sm leading-relaxed text-forest-700/65 dark:text-cream-50/60">
              Enter the email address of the person you&apos;d like to add as a
              friend.
            </p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="message"
              className="font-medium text-forest-700 dark:text-cream-50"
            >
              Personal Message (Optional)
            </Label>
            <Textarea
              id="message"
              name="message"
              placeholder="Kia ora! Would love to volunteer together sometime. Let's be friends on the portal!"
              rows={3}
              maxLength={500}
              className={inputStyles}
              data-testid="friend-request-message-input"
            />
            <p className="text-sm leading-relaxed text-forest-700/65 dark:text-cream-50/60">
              Add a personal message to your friend request (max 500
              characters).
            </p>
          </div>

          {error && (
            <div
              className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/40"
              data-testid="friend-request-error"
            >
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              {retryCount > 0 && retryCount < 3 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-3 w-3" aria-hidden />
                  Try Again
                </Button>
              )}
              {retryCount >= 3 && (
                <p className="text-xs text-red-700/80 dark:text-red-300/80">
                  Multiple attempts failed. Please check your connection and
                  try again later.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-6 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              data-testid="friend-request-cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="friend-request-submit-button"
            >
              {isSubmitting ? (
                <>
                  <MotionSpinner size="sm" className="mr-2" />
                  Sending...
                </>
              ) : (
                "Send Request"
              )}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
