"use client";

import React from "react";
import { ShiftFormManager, type ShiftTemplate } from "./shift-form-manager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusIcon, FileTextIcon } from "lucide-react";

interface ShiftType {
  id: string;
  name: string;
}

interface ShiftCreationClientFormProps {
  shiftTypes: ShiftType[];
  initialTemplates: Record<string, ShiftTemplate>;
  locations: readonly string[];
  createShiftTypeAction: (formData: FormData) => Promise<void>;
}

export function ShiftCreationClientForm({ 
  shiftTypes, 
  initialTemplates, 
  locations, 
  createShiftTypeAction 
}: ShiftCreationClientFormProps) {
  const [selectedShiftTypeId, setSelectedShiftTypeId] = React.useState("");

  const handleShiftTypeChange = (shiftTypeId: string) => {
    setSelectedShiftTypeId(shiftTypeId);
  };

  return (
    <>
      {/* Enhanced Form Manager with Templates, Schedule, and Capacity */}
      <ShiftFormManager 
        initialTemplates={initialTemplates} 
        locations={locations}
        shiftTypes={shiftTypes}
        onShiftTypeChange={handleShiftTypeChange}
      />

      {/* Shift Type Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Shift Type
          </h3>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="create-shift-type-button">
                <PlusIcon className="h-4 w-4 mr-2" />
                Create New Type
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Shift Type</DialogTitle>
                <DialogDescription>
                  Add a new type of volunteer shift that can be used for scheduling.
                </DialogDescription>
              </DialogHeader>
              <form action={createShiftTypeAction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="shift-type-name">Name *</Label>
                  <Input
                    id="shift-type-name"
                    name="name"
                    placeholder="e.g., Kitchen Helper"
                    required
                    data-testid="shift-type-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shift-type-description">Description (optional)</Label>
                  <Textarea
                    id="shift-type-description"
                    name="description"
                    placeholder="Brief description of what this role involves..."
                    rows={3}
                    data-testid="shift-type-description-textarea"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" data-testid="create-shift-type-submit">
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Create Shift Type
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div>
          <Label
            htmlFor="shiftTypeId"
            className="text-sm font-medium mb-2 block"
          >
            Select shift type *
          </Label>
          <div>
            {/* Hidden input for form submission */}
            <input
              type="hidden"
              name="shiftTypeId"
              value={selectedShiftTypeId}
              required
            />
            <Select
              value={selectedShiftTypeId}
              onValueChange={setSelectedShiftTypeId}
            >
              <SelectTrigger 
                className="w-full"
                data-testid="shift-type-select"
              >
                <SelectValue placeholder="Choose the type of volunteer work..." />
              </SelectTrigger>
              <SelectContent>
                {shiftTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Additional Information
          </h3>
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="notes"
            className="text-sm font-medium flex items-center gap-2"
          >
            <FileTextIcon className="h-4 w-4 text-muted-foreground" />
            Notes (optional)
          </Label>
          <Textarea
            name="notes"
            id="notes"
            placeholder="Any additional information about this shift..."
            rows={4}
            className="resize-none"
            data-testid="shift-notes-textarea"
          />
          <p className="text-xs text-muted-foreground">
            Include special requirements, equipment needed, or other details
          </p>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button type="submit" size="lg" data-testid="create-shift-button">
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Shift
        </Button>
      </div>
    </>
  );
}