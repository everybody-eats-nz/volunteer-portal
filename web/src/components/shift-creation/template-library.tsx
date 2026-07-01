import React from "react";
import {
  ChevronDownIcon,
  ClockIcon,
  MapPinIcon,
  UsersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CreateTemplateDialog } from "@/components/create-template-dialog";
import { EditTemplateDialog } from "@/components/edit-template-dialog";
import { DeleteTemplateForm } from "@/components/delete-template-form";
import { PlannerSection } from "./planner-section";
import {
  groupTemplatesByLocation,
  ShiftTypeOption,
  TemplateOption,
  templateDisplayName,
} from "./types";

interface TemplateLibraryProps {
  templates: TemplateOption[];
  shiftTypes: ShiftTypeOption[];
  locations: string[];
  createAction: (formData: FormData) => Promise<void>;
  editAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}

/**
 * The template library: the building blocks the weekly schedule is made of.
 * Grouped by restaurant, one row per template, with edit/delete inline.
 */
export function TemplateLibrary({
  templates,
  shiftTypes,
  locations,
  createAction,
  editAction,
  deleteAction,
}: TemplateLibraryProps) {
  const groups = groupTemplatesByLocation(templates, locations);

  return (
    <PlannerSection
      title="Manage Shift Templates"
      description="Templates are the building blocks of the weekly schedule: a role with its usual time, capacity, and restaurant."
      headerAside={
        <CreateTemplateDialog
          shiftTypes={shiftTypes}
          locations={locations}
          createAction={createAction}
          triggerText="Create Template"
          triggerVariant={templates.length === 0 ? "default" : "outline"}
        />
      }
    >
      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <h4 className="text-base text-foreground">No templates yet</h4>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first template and the weekly schedule can build whole
            rosters from it in one go.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([location, group]) => (
            <Collapsible
              key={location}
              className="rounded-xl border border-border"
            >
              <CollapsibleTrigger
                className="group flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left"
                data-testid={`template-location-group-${location
                  .toLowerCase()
                  .replace(/\s+/g, "-")}`}
              >
                <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                <MapPinIcon className="h-4 w-4 shrink-0 text-forest-400 dark:text-forest-200" />
                <h4 className="text-base text-foreground">{location}</h4>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {group.length} template{group.length === 1 ? "" : "s"}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="divide-y divide-border border-t border-border">
                {group.map((template) => {
                  const displayName = templateDisplayName(
                    template.name,
                    location
                  );
                  return (
                  <li
                    key={template.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold text-foreground">
                          {displayName}
                        </span>
                        {template.shiftTypeName !== displayName && (
                          <Badge
                            variant="secondary"
                            className="rounded-full text-[11px] font-medium"
                          >
                            {template.shiftTypeName}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <ClockIcon className="h-3 w-3" />
                          {template.startTime} - {template.endTime}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <UsersIcon className="h-3 w-3" />
                          {template.capacity} place
                          {template.capacity === 1 ? "" : "s"}
                        </span>
                        {template.notes && (
                          <span
                            className="max-w-[24rem] truncate"
                            title={template.notes}
                          >
                            {template.notes}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <EditTemplateDialog
                        template={{
                          id: template.id,
                          name: template.name,
                          shiftTypeId: template.shiftTypeId,
                          startTime: template.startTime,
                          endTime: template.endTime,
                          location: template.location,
                          capacity: template.capacity,
                          notes: template.notes || null,
                        }}
                        shiftTypes={shiftTypes}
                        locations={locations}
                        editAction={editAction}
                      />
                      <DeleteTemplateForm
                        templateId={template.id}
                        templateName={template.name}
                        deleteAction={deleteAction}
                      />
                    </div>
                  </li>
                  );
                })}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}
    </PlannerSection>
  );
}
