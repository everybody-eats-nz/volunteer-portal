"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User } from "./users-data-table";

interface DeleteUserDialogProps {
  user: User;
  children: React.ReactNode;
}

export function DeleteUserDialog({ user, children }: DeleteUserDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const displayName = user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;

  const handleDelete = async () => {
    if (!confirmEmail.trim()) {
      setError("Please enter the user's email address to confirm deletion");
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmEmail: confirmEmail.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete user");
      }

      // Close dialog and refresh the page
      setIsOpen(false);
      setConfirmEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred while deleting the user");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!isDeleting) {
      setIsOpen(open);
      if (!open) {
        setConfirmEmail("");
        setError("");
      }
    }
  };

  const isConfirmationValid = confirmEmail.trim().toLowerCase() === user.email.toLowerCase();

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Delete User
          </DialogTitle>
          <DialogDescription className="text-base">
            You are about to permanently delete <strong>{displayName}</strong> ({user.email}).
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Warning:</strong> This will permanently delete all user data, including:
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>Profile information</li>
              <li>Shift signups and history</li>
              <li>Achievement progress</li>
              <li>All associated records</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-email" className="text-sm font-medium">
              To confirm, please enter the user&apos;s email address:
            </Label>
            <Input
              id="confirm-email"
              type="email"
              placeholder={user.email}
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              className="font-mono text-sm"
              disabled={isDeleting}
              data-testid="delete-user-email-input"
            />
          </div>

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isDeleting}
            data-testid="delete-user-cancel-button"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmationValid || isDeleting}
            className="sm:ml-2"
            data-testid="delete-user-confirm-button"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete User
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}