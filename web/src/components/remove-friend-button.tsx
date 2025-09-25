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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangleIcon, UserMinusIcon } from "lucide-react";
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
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
          data-testid="remove-friend-trigger"
        >
          Remove
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-lg" data-testid="remove-friend-dialog">
        <ResponsiveDialogHeader className="text-center sm:text-left">
          <ResponsiveDialogTitle className="flex items-center justify-center sm:justify-start gap-2 text-red-600" data-testid="remove-friend-dialog-title">
            <UserMinusIcon className="h-5 w-5" />
            Remove Friend
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="mt-2">
            Are you sure you want to remove this person from your friends list? This action cannot be undone.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="py-4">
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/50">
            <AlertTriangleIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <div className="space-y-3">
                <p className="font-medium text-sm">Removing this friend will:</p>
                <ul className="text-sm space-y-1.5 ml-1">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                    Remove them from your friends list
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                    Remove you from their friends list
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                    Hide your volunteer activity from each other (based on privacy settings)
                  </li>
                </ul>
                <p className="text-sm mt-3 pt-2 border-t border-amber-200 dark:border-amber-800">
                  <strong>Note:</strong> You can send them a new friend request later if you change your mind.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </div>

        <ResponsiveDialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
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
                <UserMinusIcon className="h-4 w-4 mr-2" />
                Remove Friend
              </>
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}