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
import { UserPlus, Mail, MessageSquare, RefreshCw } from "lucide-react";
import { sendFriendRequest } from "@/lib/friends-actions";
import { MotionSpinner } from "@/components/motion-spinner";

interface SendFriendRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendFriendRequestForm({
  open,
  onOpenChange,
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
      setRetryCount(prev => prev + 1);
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
          <ResponsiveDialogTitle className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5" />
            <span>Send Friend Request</span>
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <form
          id="friend-request-form"
          action={handleSubmit}
          className="space-y-6"
        >
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center space-x-2">
              <Mail className="h-4 w-4" />
              <span>Email Address</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="friend@example.com"
              required
              data-testid="friend-request-email-input"
            />
            <p className="text-sm text-muted-foreground">
              Enter the email address of the person you&apos;d like to add as a
              friend.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message" className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4" />
              <span>Personal Message (Optional)</span>
            </Label>
            <Textarea
              id="message"
              name="message"
              placeholder="Hey! Would love to volunteer together sometime. Let's be friends on the portal!"
              rows={3}
              maxLength={500}
              data-testid="friend-request-message-input"
            />
            <p className="text-sm text-muted-foreground">
              Add a personal message to your friend request (max 500
              characters).
            </p>
          </div>

          {error && (
            <div
              className="bg-destructive/10 border border-destructive/20 rounded-md p-3 space-y-3"
              data-testid="friend-request-error"
            >
              <p className="text-destructive text-sm">{error}</p>
              {retryCount > 0 && retryCount < 3 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-3 w-3" />
                  Try Again
                </Button>
              )}
              {retryCount >= 3 && (
                <p className="text-destructive/80 text-xs">
                  Multiple attempts failed. Please check your connection and try again later.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-6">
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
