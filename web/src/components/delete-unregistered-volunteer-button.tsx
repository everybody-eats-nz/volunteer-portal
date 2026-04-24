"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface DeleteUnregisteredVolunteerButtonProps {
  shiftId: string;
  placeholderId: string;
  name: string;
}

export function DeleteUnregisteredVolunteerButton({
  shiftId,
  placeholderId,
  name,
}: DeleteUnregisteredVolunteerButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [, startTransition] = useTransition();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/shifts/${shiftId}/placeholders/${placeholderId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        setIsDeleting(false);
        return;
      }
      setOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-slate-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
          aria-label={`Remove unregistered volunteer ${name}`}
          data-testid={`unregistered-delete-${placeholderId}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove unregistered volunteer?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove <span className="font-semibold">{name}</span> from
            this shift and free up a capacity slot.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 focus-visible:ring-red-600"
            data-testid={`unregistered-delete-confirm-${placeholderId}`}
          >
            {isDeleting ? "Removing..." : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
