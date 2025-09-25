"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlusIcon } from "lucide-react";

interface CreateTemplateDialogProps {
  shiftTypes: Array<{ id: string; name: string }>;
  locations: string[];
  createAction: (formData: FormData) => Promise<void>;
  triggerText?: string;
  triggerVariant?: "default" | "outline";
  triggerSize?: "default" | "sm" | "lg";
}

export function CreateTemplateDialog({
  shiftTypes,
  locations,
  createAction,
  triggerText = "Create New Template",
  triggerVariant = "outline",
  triggerSize = "sm"
}: CreateTemplateDialogProps) {
  const [open, setOpen] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    await createAction(formData);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize}>
          <PlusIcon className="h-4 w-4 mr-2" />
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Template</DialogTitle>
          <DialogDescription>
            Create a shift template for efficient scheduling. Templates can be used to quickly create multiple shifts.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dialog-template-name">Template Name *</Label>
              <Input
                name="name"
                id="dialog-template-name"
                placeholder="e.g., Morning Kitchen Shift"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-template-shift-type">Shift Type *</Label>
              <SelectField
                name="shiftTypeId"
                required
                options={shiftTypes.map((st) => ({
                  value: st.id,
                  label: st.name,
                }))}
                placeholder="Choose shift type..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-template-start-time">Start Time *</Label>
              <Input
                type="time"
                name="startTime"
                id="dialog-template-start-time"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-template-end-time">End Time *</Label>
              <Input
                type="time"
                name="endTime"
                id="dialog-template-end-time"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-template-location">Location *</Label>
              <SelectField
                name="location"
                required
                options={locations.map((loc) => ({
                  value: loc,
                  label: loc,
                }))}
                placeholder="Choose location..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-template-capacity">Capacity *</Label>
              <Input
                type="number"
                name="capacity"
                id="dialog-template-capacity"
                min={1}
                max={1000}
                required
                placeholder="Number of volunteers"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dialog-template-notes">Notes (Optional)</Label>
            <Textarea
              name="notes"
              id="dialog-template-notes"
              rows={2}
              placeholder="Additional notes for this template..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}