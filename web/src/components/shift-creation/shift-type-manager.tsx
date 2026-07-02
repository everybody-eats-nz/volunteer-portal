"use client";

import React from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlannerSection } from "./planner-section";

export interface ShiftTypeDetail {
  id: string;
  name: string;
  description: string | null;
  templateCount: number;
  shiftCount: number;
  /** True when shifts, templates, regulars, or auto-accept rules reference it */
  inUse: boolean;
}

interface ShiftTypeManagerProps {
  shiftTypes: ShiftTypeDetail[];
  createAction: (formData: FormData) => Promise<void>;
  editAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function usageSummary(type: ShiftTypeDetail): string {
  const parts = [
    `${type.templateCount} template${type.templateCount === 1 ? "" : "s"}`,
    `${type.shiftCount} shift${type.shiftCount === 1 ? "" : "s"}`,
  ];
  return parts.join(" · ");
}

function EditShiftTypeDialog({
  shiftType,
  editAction,
}: {
  shiftType: ShiftTypeDetail;
  editAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid={`edit-shift-type-${slugify(shiftType.name)}`}
        >
          <PencilIcon className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Shift Type</DialogTitle>
          <DialogDescription>
            Renaming updates every shift and template that uses this type.
          </DialogDescription>
        </DialogHeader>
        <form action={editAction} className="space-y-4">
          <input type="hidden" name="shiftTypeId" value={shiftType.id} />
          <div className="space-y-2">
            <Label htmlFor={`edit-type-name-${shiftType.id}`}>Name *</Label>
            <Input
              id={`edit-type-name-${shiftType.id}`}
              name="name"
              defaultValue={shiftType.name}
              required
              maxLength={100}
              data-testid="edit-shift-type-name-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-type-description-${shiftType.id}`}>
              Description (optional)
            </Label>
            <Textarea
              id={`edit-type-description-${shiftType.id}`}
              name="description"
              defaultValue={shiftType.description ?? ""}
              placeholder="Brief description of what this role involves..."
              rows={3}
              data-testid="edit-shift-type-description-textarea"
            />
          </div>
          <DialogFooter>
            <Button type="submit" data-testid="edit-shift-type-submit">
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteShiftTypeDialog({
  shiftType,
  deleteAction,
}: {
  shiftType: ShiftTypeDetail;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  if (shiftType.inUse) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        title={`In use by ${usageSummary(
          shiftType
        )} - remove those first to delete this type`}
        data-testid={`delete-shift-type-${slugify(shiftType.name)}`}
      >
        <Trash2Icon className="mr-1.5 h-3.5 w-3.5" />
        Delete
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
          data-testid={`delete-shift-type-${slugify(shiftType.name)}`}
        >
          <Trash2Icon className="mr-1.5 h-3.5 w-3.5" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete &ldquo;{shiftType.name}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This shift type is not used by any shifts or templates. Deleting it
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={deleteAction}>
            <input type="hidden" name="shiftTypeId" value={shiftType.id} />
            <AlertDialogAction
              type="submit"
              className="w-full bg-red-600 text-white hover:bg-red-700"
              data-testid="confirm-delete-shift-type"
            >
              Delete Shift Type
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Management surface for shift types (roles): the kinds of volunteer mahi
 * that templates and shifts are built on.
 */
export function ShiftTypeManager({
  shiftTypes,
  createAction,
  editAction,
  deleteAction,
}: ShiftTypeManagerProps) {
  return (
    <PlannerSection
      title="Manage Shift Types"
      description="Shift types are the roles volunteers do - Dishwasher, Front of House, Kitchen Prep. Every template and shift is built on one."
      headerAside={
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" data-testid="new-shift-type-button">
              <PlusIcon className="mr-1.5 h-4 w-4" />
              New Shift Type
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Shift Type</DialogTitle>
              <DialogDescription>
                Add a new type of volunteer shift that can be used for
                scheduling.
              </DialogDescription>
            </DialogHeader>
            <form action={createAction} className="space-y-4">
              <input type="hidden" name="returnTab" value="templates" />
              <div className="space-y-2">
                <Label htmlFor="library-shift-type-name">Name *</Label>
                <Input
                  id="library-shift-type-name"
                  name="name"
                  placeholder="e.g., Kitchen Helper"
                  required
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="library-shift-type-description">
                  Description (optional)
                </Label>
                <Textarea
                  id="library-shift-type-description"
                  name="description"
                  placeholder="Brief description of what this role involves..."
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="submit">
                  <PlusIcon className="mr-1.5 h-4 w-4" />
                  Create Shift Type
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {shiftTypes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <h4 className="text-base text-foreground">No shift types yet</h4>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create the roles volunteers can do, then build templates and shifts
            on top of them.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {shiftTypes.map((type) => (
            <li
              key={type.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
              data-testid={`shift-type-row-${slugify(type.name)}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold text-foreground">
                    {type.name}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {usageSummary(type)}
                  </span>
                </div>
                {type.description && (
                  <p
                    className="mt-0.5 max-w-[36rem] truncate text-xs text-muted-foreground"
                    title={type.description}
                  >
                    {type.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <EditShiftTypeDialog shiftType={type} editAction={editAction} />
                <DeleteShiftTypeDialog
                  shiftType={type}
                  deleteAction={deleteAction}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </PlannerSection>
  );
}
