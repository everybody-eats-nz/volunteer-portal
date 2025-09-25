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
import { EditIcon } from "lucide-react";

interface Template {
  id: string;
  name: string;
  shiftTypeId: string;
  startTime: string;
  endTime: string;
  location: string | null;
  capacity: number;
  notes: string | null;
}

interface EditTemplateDialogProps {
  template: Template;
  shiftTypes: Array<{ id: string; name: string }>;
  locations: string[];
  editAction: (formData: FormData) => Promise<void>;
}

export function EditTemplateDialog({
  template,
  shiftTypes,
  locations,
  editAction,
}: EditTemplateDialogProps) {
  const [open, setOpen] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    await editAction(formData);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Template</DialogTitle>
          <DialogDescription>
            Update the template details. Changes will apply to new shifts created from this template.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="templateId" value={template.id} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-template-name">Template Name *</Label>
              <Input
                name="name"
                id="edit-template-name"
                defaultValue={template.name}
                placeholder="e.g., Morning Kitchen Shift"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-template-shift-type">Shift Type *</Label>
              <SelectField
                name="shiftTypeId"
                required
                defaultValue={template.shiftTypeId}
                options={shiftTypes.map((st) => ({
                  value: st.id,
                  label: st.name,
                }))}
                placeholder="Choose shift type..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-template-start-time">Start Time *</Label>
              <Input
                type="time"
                name="startTime"
                id="edit-template-start-time"
                defaultValue={template.startTime}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-template-end-time">End Time *</Label>
              <Input
                type="time"
                name="endTime"
                id="edit-template-end-time"
                defaultValue={template.endTime}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-template-location">Location *</Label>
              <SelectField
                name="location"
                required
                defaultValue={template.location || ""}
                options={locations.map((loc) => ({
                  value: loc,
                  label: loc,
                }))}
                placeholder="Choose location..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-template-capacity">Capacity *</Label>
              <Input
                type="number"
                name="capacity"
                id="edit-template-capacity"
                defaultValue={template.capacity}
                min={1}
                max={1000}
                required
                placeholder="Number of volunteers"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-template-notes">Notes (Optional)</Label>
            <Textarea
              name="notes"
              id="edit-template-notes"
              defaultValue={template.notes || ""}
              rows={2}
              placeholder="Additional notes for this template..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <EditIcon className="h-4 w-4 mr-2" />
              Update Template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}