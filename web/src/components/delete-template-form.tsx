"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TrashIcon } from "lucide-react";

interface DeleteTemplateFormProps {
  templateId: string;
  templateName: string;
  deleteAction: (formData: FormData) => Promise<void>;
}

export function DeleteTemplateForm({ templateId, templateName, deleteAction }: DeleteTemplateFormProps) {
  const [open, setOpen] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    await deleteAction(formData);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Template</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the template &ldquo;{templateName}&rdquo;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit}>
          <input type="hidden" name="templateId" value={templateId} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive">
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete Template
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}