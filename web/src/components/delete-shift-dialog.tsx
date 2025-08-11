"use client";

import { useState } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertTriangleIcon,
  Trash2Icon,
  UsersIcon,
  CalendarIcon,
} from "lucide-react";

interface DeleteShiftDialogProps {
  shiftId: string;
  shiftName: string;
  shiftDate: string;
  hasSignups: boolean;
  signupCount: number;
  onDelete: () => Promise<void>;
  children: React.ReactNode;
}

export function DeleteShiftDialog({
  shiftId,
  shiftName,
  shiftDate,
  hasSignups,
  signupCount,
  onDelete,
  children,
}: DeleteShiftDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      setOpen(false);
    } catch (error) {
      console.error("Failed to delete shift:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2Icon className="h-5 w-5" />
            Delete Shift
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this shift? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Shift Details */}
          <div className="rounded-lg border p-4 bg-slate-50">
            <div className="flex items-center gap-2 mb-2">
              <CalendarIcon className="h-4 w-4 text-slate-600" />
              <span className="font-medium">{shiftName}</span>
            </div>
            <p className="text-sm text-slate-600">{shiftDate}</p>
          </div>

          {/* Warning about signups */}
          {hasSignups && (
            <Alert variant="destructive">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4" />
                    <span className="font-medium">
                      {signupCount} volunteer
                      {signupCount !== 1 ? "s are" : " is"} signed up for this
                      shift
                    </span>
                  </div>
                  <p className="text-sm">Deleting this shift will:</p>
                  <ul className="text-sm list-disc list-inside space-y-1 ml-2">
                    <li>Remove all volunteer signups</li>
                    <li>Cancel volunteer notifications</li>
                    <li>Remove the shift from volunteer schedules</li>
                  </ul>
                  <p className="text-sm font-medium">
                    Consider notifying the volunteers before deleting this
                    shift.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* General warning */}
          <Alert>
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertDescription>
              This will permanently delete the shift and all associated data.
              This action cannot be undone.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
            className="order-2 sm:order-1"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="order-1 sm:order-2"
          >
            {isDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2Icon className="h-4 w-4 mr-2" />
                Delete Shift
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
