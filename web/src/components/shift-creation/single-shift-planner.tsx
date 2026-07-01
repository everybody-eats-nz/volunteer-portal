"use client";

import React from "react";
import { useFormStatus } from "react-dom";
import { format, isBefore, startOfDay } from "date-fns";
import {
  CalendarIcon,
  CheckIcon,
  Loader2,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PlannerSection } from "./planner-section";
import { RunSheet, RunSheetLine } from "./run-sheet";
import {
  ShiftTypeOption,
  TemplateOption,
  templateDisplayName,
} from "./types";

interface SingleShiftPlannerProps {
  shiftTypes: ShiftTypeOption[];
  templates: TemplateOption[];
  locations: readonly string[];
  action: (formData: FormData) => Promise<void>;
  createShiftTypeAction: (formData: FormData) => Promise<void>;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      className="h-12 w-full rounded-full text-base"
      data-testid="create-shift-button"
      disabled={pending}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creating shift...
        </>
      ) : (
        "Create Shift"
      )}
    </Button>
  );
}

export function SingleShiftPlanner({
  shiftTypes,
  templates,
  locations,
  action,
  createShiftTypeAction,
}: SingleShiftPlannerProps) {
  const [shiftTypeId, setShiftTypeId] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [date, setDate] = React.useState<Date | undefined>();
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [capacity, setCapacity] = React.useState("");
  const [appliedTemplateId, setAppliedTemplateId] = React.useState<
    string | null
  >(null);
  const [attempted, setAttempted] = React.useState(false);

  const applyTemplate = (template: TemplateOption) => {
    if (appliedTemplateId === template.id) {
      setAppliedTemplateId(null);
      return;
    }
    setShiftTypeId(template.shiftTypeId);
    setLocation(template.location);
    setStartTime(template.startTime);
    setEndTime(template.endTime);
    setCapacity(String(template.capacity));
    setAppliedTemplateId(template.id);
  };

  const shiftTypeName = shiftTypes.find((t) => t.id === shiftTypeId)?.name;
  const capacityNumber = Number.parseInt(capacity, 10);
  const dateInPast = date ? isBefore(date, startOfDay(new Date())) : false;

  const warnings: string[] = [];
  if (!shiftTypeId) warnings.push("Choose a shift type");
  if (!location) warnings.push("Choose a location");
  if (!date) warnings.push("Pick a date");
  else if (dateInPast) warnings.push("The date is in the past");
  if (!startTime || !endTime) warnings.push("Set start and end times");
  else if (endTime <= startTime)
    warnings.push("End time must be after start time");
  if (!capacity || Number.isNaN(capacityNumber) || capacityNumber < 1)
    warnings.push("Set the volunteer capacity");

  const lines: RunSheetLine[] = [];
  if (shiftTypeName) lines.push({ label: "Role", value: shiftTypeName });
  if (location) lines.push({ label: "Location", value: location });
  if (date)
    lines.push({
      label: "Date",
      value: format(date, "EEE d MMM yyyy"),
      emphasis: true,
    });
  if (startTime && endTime)
    lines.push({ label: "Time", value: `${startTime} - ${endTime}` });

  const shiftReady = warnings.length === 0;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!shiftReady) {
      event.preventDefault();
      setAttempted(true);
    }
  };

  return (
    <form
      action={action}
      onSubmit={handleSubmit}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start"
    >
      <div className="space-y-6">
        {templates.length > 0 && (
          <div className="rounded-2xl border border-dashed border-forest-200 bg-forest-500/[0.04] px-5 py-4 sm:px-6 dark:border-forest-300/40 dark:bg-forest-500/10">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <SparklesIcon className="h-4 w-4 text-forest-400 dark:text-forest-200" />
              Quick start from a template
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {templates.map((template) => {
                const active = appliedTemplateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className={cn(
                      "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors",
                      active
                        ? "border-forest-500 bg-forest-500 text-cream-50"
                        : "border-border bg-card text-foreground hover:border-forest-300"
                    )}
                  >
                    {active && <CheckIcon className="h-3.5 w-3.5" />}
                    {templateDisplayName(template.name, template.location)}
                    <span
                      className={cn(
                        "tabular-nums",
                        active ? "text-cream-50/80" : "text-muted-foreground"
                      )}
                    >
                      {template.location} · {template.startTime}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Fills in the role, time, capacity, and location. You can still
              tweak anything below.
            </p>
          </div>
        )}

        <PlannerSection
          step="Step 1"
          title="Role and location"
          description="What volunteers will do, and at which restaurant."
          headerAside={
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="create-shift-type-button"
                >
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
                <form action={createShiftTypeAction} className="space-y-4">
                  <input type="hidden" name="returnTab" value="single" />
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
                    <Label htmlFor="shift-type-description">
                      Description (optional)
                    </Label>
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
                      <PlusIcon className="mr-1.5 h-4 w-4" />
                      Create Shift Type
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          }
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shiftTypeId" className="text-sm font-medium">
                Select shift type *
              </Label>
              <input type="hidden" name="shiftTypeId" value={shiftTypeId} />
              <Select value={shiftTypeId} onValueChange={setShiftTypeId}>
                <SelectTrigger
                  className="h-11 w-full rounded-xl"
                  data-testid="shift-type-select"
                >
                  <SelectValue placeholder="Choose a role..." />
                </SelectTrigger>
                <SelectContent>
                  {shiftTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-medium">
                Location *
              </Label>
              <input type="hidden" name="location" value={location} />
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger
                  className="h-11 w-full rounded-xl"
                  data-testid="shift-location-select"
                >
                  <SelectValue placeholder="Choose a restaurant..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </PlannerSection>

        <PlannerSection
          step="Step 2"
          title="Date and time"
          description="All times are New Zealand time."
        >
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-11 w-full justify-start rounded-xl text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                    data-testid="shift-date-input"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "EEE d MMM yyyy") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    autoFocus
                    disabled={{ before: new Date() }}
                  />
                </PopoverContent>
              </Popover>
              <input
                type="hidden"
                name="date"
                value={date ? format(date, "yyyy-MM-dd") : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime" className="text-sm font-medium">
                Start time *
              </Label>
              <Input
                type="time"
                name="startTime"
                id="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="h-11 rounded-xl tabular-nums"
                data-testid="shift-start-time-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime" className="text-sm font-medium">
                End time *
              </Label>
              <Input
                type="time"
                name="endTime"
                id="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="h-11 rounded-xl tabular-nums"
                data-testid="shift-end-time-input"
              />
            </div>
          </div>
        </PlannerSection>

        <PlannerSection
          step="Step 3"
          title="Capacity and notes"
          description="How many volunteers you need, plus anything they should know."
        >
          <div className="space-y-5">
            <div className="max-w-[12rem] space-y-2">
              <Label htmlFor="capacity" className="text-sm font-medium">
                Volunteer capacity *
              </Label>
              <Input
                type="number"
                name="capacity"
                id="capacity"
                min={1}
                step={1}
                required
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="e.g. 8"
                className="h-11 rounded-xl tabular-nums"
                data-testid="shift-capacity-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">
                Notes (optional)
              </Label>
              <Textarea
                name="notes"
                id="notes"
                placeholder="Special requirements, equipment needed, or other details..."
                rows={4}
                className="resize-none rounded-xl"
                data-testid="shift-notes-textarea"
              />
            </div>
          </div>
        </PlannerSection>
      </div>

      <RunSheet
        count={shiftReady ? 1 : 0}
        places={shiftReady ? capacityNumber : undefined}
        lines={lines}
        warnings={warnings}
        attempted={attempted}
      >
        <SubmitButton />
      </RunSheet>
    </form>
  );
}
