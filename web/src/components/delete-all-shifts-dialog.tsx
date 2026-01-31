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
import {
  AlertTriangleIcon,
  Trash2Icon,
  UsersIcon,
  CalendarIcon,
  ClipboardListIcon,
} from "lucide-react";

interface DeleteAllShiftsDialogProps {
  shiftCount: number;
  volunteerCount: number;
  shiftTypes: string[];
  date: string;
  location: string;
  onDelete: () => Promise<void>;
  children: React.ReactNode;
}

export function DeleteAllShiftsDialog({
  shiftCount,
  volunteerCount,
  shiftTypes,
  date,
  location,
  onDelete,
  children,
}: DeleteAllShiftsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      setOpen(false);
    } catch (error) {
      console.error("Failed to delete shifts:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasVolunteers = volunteerCount > 0;
  const uniqueShiftTypes = [...new Set(shiftTypes)];

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>{children}</ResponsiveDialogTrigger>
      <ResponsiveDialogContent
        className="sm:max-w-md"
        data-testid="delete-all-shifts-dialog"
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle
            className="flex items-center gap-2 text-red-600 dark:text-red-400"
            data-testid="delete-all-shifts-dialog-title"
          >
            <Trash2Icon className="h-5 w-5" />
            Delete All Shifts
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Are you sure you want to delete all shifts for this day? This action
            cannot be undone.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-lg border p-4 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 mb-3">
              <CalendarIcon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="font-medium">
                {date} - {location}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <ClipboardListIcon className="h-4 w-4 text-slate-500" />
                <span>
                  <strong>{shiftCount}</strong> shift
                  {shiftCount !== 1 ? "s" : ""} will be deleted
                </span>
              </div>

              {hasVolunteers && (
                <div className="flex items-center gap-2">
                  <UsersIcon className="h-4 w-4 text-slate-500" />
                  <span>
                    <strong>{volunteerCount}</strong> volunteer
                    {volunteerCount !== 1 ? "s" : ""} currently signed up
                  </span>
                </div>
              )}

              {uniqueShiftTypes.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-400">
                    Shift types:{" "}
                  </span>
                  <span>{uniqueShiftTypes.join(", ")}</span>
                </div>
              )}
            </div>
          </div>

          {/* Warning about volunteers */}
          {hasVolunteers && (
            <Alert variant="destructive">
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">
                    {volunteerCount} volunteer
                    {volunteerCount !== 1 ? "s are" : " is"} signed up for these
                    shifts
                  </p>
                  <p className="text-sm">Deleting these shifts will:</p>
                  <ul className="text-sm list-disc list-inside space-y-1 ml-2">
                    <li>Remove all volunteer signups</li>
                    <li>Cancel volunteer notifications</li>
                    <li>Remove the shifts from volunteer schedules</li>
                  </ul>
                  <p className="text-sm font-medium">
                    Consider notifying the volunteers before deleting these
                    shifts.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* General warning */}
          <Alert>
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertDescription>
              This will permanently delete all {shiftCount} shift
              {shiftCount !== 1 ? "s" : ""} and associated data. This action
              cannot be undone.
            </AlertDescription>
          </Alert>
        </div>

        <ResponsiveDialogFooter className="flex gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
            data-testid="delete-all-shifts-cancel-button"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            data-testid="delete-all-shifts-confirm-button"
          >
            {isDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2Icon className="h-4 w-4 mr-2" />
                Delete All Shifts
              </>
            )}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
