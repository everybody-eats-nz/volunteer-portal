"use client";

import { useState } from "react";
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
import { UserMinusIcon } from "lucide-react";
import { MotionSpinner } from "@/components/motion-spinner";
import { removeFriend } from "@/lib/friends-actions";

interface RemoveFriendButtonProps {
  friendId: string;
}

export function RemoveFriendButton({ friendId }: RemoveFriendButtonProps) {
  const [open, setOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      const result = await removeFriend(friendId);
      if (result.success) {
        setOpen(false);
      }
      // Server Actions automatically revalidate the page, so no need for manual refresh
    } catch (error) {
      console.error("Failed to remove friend:", error);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <button
          type="button"
          data-testid="remove-friend-trigger"
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-red-700/80 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-red-400/80 dark:hover:bg-red-950/30 dark:hover:text-red-400"
        >
          Remove
        </button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent
        className="sm:max-w-lg"
        data-testid="remove-friend-dialog"
      >
        <ResponsiveDialogHeader className="text-center sm:text-left">
          <ResponsiveDialogTitle
            className="display display-medium flex items-center justify-center gap-2 text-2xl tracking-tight text-red-700 sm:justify-start dark:text-red-400"
            data-testid="remove-friend-dialog-title"
          >
            <UserMinusIcon className="h-5 w-5" aria-hidden />
            Remove Friend
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="mt-2 leading-relaxed">
            Are you sure you want to remove this person from your friends list?
            This action cannot be undone.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="py-4">
          <div className="grain relative overflow-hidden rounded-2xl border border-forest-500/10 bg-cream-100 p-5 dark:border-cream-50/10 dark:bg-forest-800/60">
            <p className="text-sm font-medium text-forest-700 dark:text-cream-50">
              Removing this friend will:
            </p>
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-forest-700/80 dark:text-cream-50/75">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-forest-500 dark:text-cream-50/60">
                  •
                </span>
                Remove them from your friends list
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-forest-500 dark:text-cream-50/60">
                  •
                </span>
                Remove you from their friends list
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-forest-500 dark:text-cream-50/60">
                  •
                </span>
                Hide your volunteer activity from each other (based on privacy
                settings)
              </li>
            </ul>
            <p className="mt-4 border-t border-forest-500/10 pt-3 text-sm text-forest-700/80 dark:border-cream-50/10 dark:text-cream-50/75">
              <strong>Note:</strong> You can send them a new friend request
              later if you change your mind.
            </p>
          </div>
        </div>

        <ResponsiveDialogFooter className="flex flex-col-reverse gap-2 pt-4 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isRemoving}
            className="flex-1 sm:flex-none"
            data-testid="remove-friend-cancel-button"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={isRemoving}
            className="flex-1 sm:flex-none"
            data-testid="remove-friend-confirm-button"
          >
            {isRemoving ? (
              <>
                <MotionSpinner size="sm" className="mr-2 text-white" />
                Removing...
              </>
            ) : (
              <>
                <UserMinusIcon className="h-4 w-4" aria-hidden />
                Remove Friend
              </>
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
