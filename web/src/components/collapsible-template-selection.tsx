"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { ChevronDownIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Template {
  name: string;
  startTime: string;
  endTime: string;
  capacity: number;
  notes: string;
  shiftTypeId: string;
  location?: string;
}

interface ShiftType {
  id: string;
  name: string;
}

interface CollapsibleTemplateSelectionProps {
  templatesByLocation: Record<string, [string, Template][]>;
  sortedLocations: string[];
  shiftTypes: ShiftType[];
}

export function CollapsibleTemplateSelection({
  templatesByLocation,
  sortedLocations,
  shiftTypes,
}: CollapsibleTemplateSelectionProps) {
  return (
    <div className="space-y-4">
      {sortedLocations.map((location, index) => (
        <Collapsible key={location} defaultOpen={index === 0}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-left bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <div className="flex items-center gap-3">
              <span className="font-medium text-lg text-gray-800 dark:text-gray-200">
                📍 {location}
              </span>
              <span className="text-sm text-muted-foreground">
                ({templatesByLocation[location].length} templates)
              </span>
            </div>
            <ChevronDownIcon className="h-4 w-4 text-gray-500 transition-transform duration-200 group-data-[state=closed]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            {/* Select All checkbox */}
            <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <input
                type="checkbox"
                id={`select-all-${location.toLowerCase().replace(/\s+/g, "-")}`}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  // Toggle all checkboxes for this location
                  templatesByLocation[location].forEach(([name]) => {
                    const checkbox = document.getElementById(`template_${name}`) as HTMLInputElement;
                    if (checkbox) checkbox.checked = isChecked;
                  });
                }}
              />
              <Label 
                htmlFor={`select-all-${location.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-sm font-medium text-blue-700 dark:text-blue-300"
              >
                Select all {location} templates
              </Label>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {templatesByLocation[location].map(([name, template]) => {
                const shiftTypeName = shiftTypes.find(st => st.id === template.shiftTypeId)?.name || 'Unknown';
                return (
                  <div
                    key={name}
                    className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      name={`template_${name}`}
                      id={`template_${name}`}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary mt-1"
                      data-testid={`template-${name
                        .toLowerCase()
                        .replace(/\s+/g, "-")}-checkbox`}
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor={`template_${name}`}
                        className="font-medium text-sm"
                      >
                        {name.replace(`${location} `, "")}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {template.startTime} - {template.endTime} • {template.capacity} volunteers
                      </p>
                      <p className="text-xs text-primary/70 mt-1">
                        {shiftTypeName}
                      </p>
                      {template.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {template.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}