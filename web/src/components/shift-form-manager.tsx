"use client";

import React from "react";
import { ShiftTemplateManager, type ShiftTemplate } from "./shift-template-manager";

// Re-export ShiftTemplate for other components
export type { ShiftTemplate };
import { DateTimeSection } from "./shift-date-time-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { MapPinIcon, UsersIcon } from "lucide-react";

interface ShiftType {
  id: string;
  name: string;
}

interface ShiftFormManagerProps {
  initialTemplates: Record<string, ShiftTemplate>;
  locations: readonly string[];
  shiftTypes: ShiftType[];
  onShiftTypeChange?: (shiftTypeId: string) => void;
}

export function ShiftFormManager({ initialTemplates, locations, shiftTypes, onShiftTypeChange }: ShiftFormManagerProps) {
  const [selectedTemplate, setSelectedTemplate] = React.useState<ShiftTemplate | null>(null);
  const [capacity, setCapacity] = React.useState("");

  const handleTemplateClick = (template: ShiftTemplate) => {
    setSelectedTemplate(template);
    setCapacity(template.capacity.toString());
    
    // Notify parent component to update shift type selection
    if (onShiftTypeChange) {
      onShiftTypeChange(template.shiftTypeId);
    }
  };

  // Reset template selection when form values are manually changed
  const handleCapacityChange = (value: string) => {
    setCapacity(value);
    // Only clear selected template if the value doesn't match
    if (selectedTemplate && parseInt(value) !== selectedTemplate.capacity) {
      setSelectedTemplate(null);
    }
  };

  return (
    <>
      {/* Template Manager */}
      <ShiftTemplateManager 
        initialTemplates={initialTemplates}
        shiftTypes={shiftTypes}
        onTemplateClick={handleTemplateClick}
      />

      {/* Date & Time Section with template integration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Schedule
          </h3>
          {selectedTemplate && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
              Using: {selectedTemplate.name}
            </span>
          )}
        </div>
        <DateTimeSection 
          templateStartTime={selectedTemplate?.startTime}
          templateEndTime={selectedTemplate?.endTime}
        />
      </div>

      {/* Enhanced Capacity Input with template integration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Location & Capacity
          </h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label
              htmlFor="location"
              className="text-sm font-medium flex items-center gap-2"
            >
              <MapPinIcon className="h-4 w-4 text-muted-foreground" />
              Location *
            </Label>
            <SelectField
              name="location"
              id="location"
              placeholder="Choose a location..."
              required
              options={locations.map((loc) => ({
                value: loc,
                label: loc,
              }))}
              className="w-full"
              data-testid="shift-location-select"
            />
          </div>
          
          <div className="space-y-2">
            <Label
              htmlFor="capacity"
              className="text-sm font-medium flex items-center gap-2"
            >
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
              Volunteer capacity *
            </Label>
            <Input
              type="number"
              name="capacity"
              id="capacity"
              min={1}
              step={1}
              placeholder="e.g. 6"
              required
              className="h-11"
              value={capacity}
              onChange={(e) => handleCapacityChange(e.target.value)}
              data-testid="shift-capacity-input"
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of volunteers needed
              {selectedTemplate && (
                <span className="ml-2 text-primary">
                  (Template default: {selectedTemplate.capacity})
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}