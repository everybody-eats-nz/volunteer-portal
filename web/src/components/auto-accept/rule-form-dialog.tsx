"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { VOLUNTEER_GRADE_OPTIONS } from "@/lib/volunteer-grades";
import { LOCATIONS } from "@/lib/locations";

const ruleFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  enabled: z.boolean(),
  priority: z.number().int().min(0),
  global: z.boolean(),
  shiftTypeId: z.string().optional(),
  location: z.string().optional(),
  minVolunteerGrade: z.enum(["GREEN", "YELLOW", "PINK", "NONE"]).optional(),
  minCompletedShifts: z.union([z.number().int().min(0), z.literal("")]).optional(),
  minAttendanceRate: z.union([z.number().min(0).max(100), z.literal("")]).optional(),
  minAccountAgeDays: z.union([z.number().int().min(0), z.literal("")]).optional(),
  maxDaysInAdvance: z.union([z.number().int().min(0), z.literal("")]).optional(),
  requireShiftTypeExperience: z.boolean(),
  criteriaLogic: z.enum(["AND", "OR"]),
  stopOnMatch: z.boolean(),
});

type RuleFormValues = z.infer<typeof ruleFormSchema>;

interface RuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: {
    id: string;
    name: string;
    description: string | null;
    enabled: boolean;
    priority: number;
    global: boolean;
    shiftTypeId: string | null;
    location: string | null;
    minVolunteerGrade: string | null;
    minCompletedShifts: number | null;
    minAttendanceRate: number | null;
    minAccountAgeDays: number | null;
    maxDaysInAdvance: number | null;
    requireShiftTypeExperience: boolean;
    criteriaLogic: "AND" | "OR";
    stopOnMatch: boolean;
  };
  onSuccess: () => void;
}

export function RuleFormDialog({
  open,
  onOpenChange,
  rule,
  onSuccess,
}: RuleFormDialogProps) {
  const [shiftTypes, setShiftTypes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      name: "",
      description: "",
      enabled: true,
      priority: 0,
      global: false,
      shiftTypeId: "",
      location: "ALL",
      minVolunteerGrade: "NONE" as const,
      minCompletedShifts: "" as number | "",
      minAttendanceRate: "" as number | "",
      minAccountAgeDays: "" as number | "",
      maxDaysInAdvance: "" as number | "",
      requireShiftTypeExperience: false,
      criteriaLogic: "AND" as const,
      stopOnMatch: true,
    },
  });

  useEffect(() => {
    if (open) {
      fetchShiftTypes();
      if (rule) {
        form.reset({
          name: rule.name,
          description: rule.description || "",
          enabled: rule.enabled,
          priority: rule.priority,
          global: rule.global,
          shiftTypeId: rule.shiftTypeId || "",
          location: rule.location || "ALL",
          minVolunteerGrade: rule.minVolunteerGrade ? (rule.minVolunteerGrade as "GREEN" | "YELLOW" | "PINK") : "NONE",
          minCompletedShifts: rule.minCompletedShifts ?? "",
          minAttendanceRate: rule.minAttendanceRate ?? "",
          minAccountAgeDays: rule.minAccountAgeDays ?? "",
          maxDaysInAdvance: rule.maxDaysInAdvance ?? "",
          requireShiftTypeExperience: rule.requireShiftTypeExperience,
          criteriaLogic: rule.criteriaLogic,
          stopOnMatch: rule.stopOnMatch,
        });
      } else {
        form.reset({
          name: "",
          description: "",
          enabled: true,
          priority: 0,
          global: false,
          shiftTypeId: "",
          location: "ALL",
          minVolunteerGrade: "NONE" as const,
          minCompletedShifts: "" as number | "",
          minAttendanceRate: "" as number | "",
          minAccountAgeDays: "" as number | "",
          maxDaysInAdvance: "" as number | "",
          requireShiftTypeExperience: false,
          criteriaLogic: "AND" as const,
          stopOnMatch: true,
        });
      }
    }
  }, [open, rule, form]);

  const fetchShiftTypes = async () => {
    try {
      const response = await fetch("/api/admin/shift-types");
      if (response.ok) {
        const data = await response.json();
        setShiftTypes(data);
      }
    } catch (error) {
      console.error("Failed to fetch shift types:", error);
    }
  };

  const onSubmit = async (values: RuleFormValues) => {
    setLoading(true);
    try {
      // Clean up empty string values
      const cleanedValues = {
        ...values,
        description: values.description || null,
        shiftTypeId: values.global ? null : values.shiftTypeId || null,
        location: values.location === "ALL" || !values.location ? null : values.location,
        minVolunteerGrade: values.minVolunteerGrade === "NONE" ? null : values.minVolunteerGrade || null,
        minCompletedShifts: values.minCompletedShifts === "" ? null : 
          typeof values.minCompletedShifts === "number" ? values.minCompletedShifts : null,
        minAttendanceRate: values.minAttendanceRate === "" ? null : 
          typeof values.minAttendanceRate === "number" ? values.minAttendanceRate : null,
        minAccountAgeDays: values.minAccountAgeDays === "" ? null : 
          typeof values.minAccountAgeDays === "number" ? values.minAccountAgeDays : null,
        maxDaysInAdvance: values.maxDaysInAdvance === "" ? null : 
          typeof values.maxDaysInAdvance === "number" ? values.maxDaysInAdvance : null,
      };

      const url = rule
        ? `/api/admin/auto-accept-rules/${rule.id}`
        : "/api/admin/auto-accept-rules";
      const method = rule ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedValues),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save rule");
      }

      toast({
        title: "Success",
        description: rule ? "Rule updated successfully" : "Rule created successfully",
      });

      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save rule",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {rule ? "Edit Auto-Accept Rule" : "Create Auto-Accept Rule"}
          </DialogTitle>
          <DialogDescription>
            Configure criteria for automatically approving shift signups
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rule Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Auto-approve Pink volunteers" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                    <FormDescription>Higher priority rules are evaluated first</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what this rule does..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="global"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Global Rule</FormLabel>
                      <FormDescription>
                        Apply to all shift types
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {!form.watch("global") && (
                <FormField
                  control={form.control}
                  name="shiftTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shift Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a shift type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {shiftTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="All locations" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ALL">All locations</SelectItem>
                        {LOCATIONS.map((location) => (
                          <SelectItem key={location} value={location}>
                            {location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Leave empty to apply to all locations</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-medium">Approval Criteria</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="minVolunteerGrade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Volunteer Grade</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select minimum grade" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NONE">No requirement</SelectItem>
                          {VOLUNTEER_GRADE_OPTIONS.map((grade) => (
                            <SelectItem key={grade.value} value={grade.value}>
                              {grade.icon} {grade.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minCompletedShifts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Completed Shifts</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="e.g., 5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minAttendanceRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Attendance Rate (%)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" max="100" placeholder="e.g., 80" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minAccountAgeDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Account Age (days)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="e.g., 30" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxDaysInAdvance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Days in Advance</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="e.g., 14" {...field} />
                      </FormControl>
                      <FormDescription>Only auto-approve if shift is within X days</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requireShiftTypeExperience"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Require Shift Type Experience</FormLabel>
                        <FormDescription>
                          Must have done this shift type before
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="criteriaLogic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Criteria Logic</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="AND" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            AND - All criteria must be met
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="OR" />
                          </FormControl>
                          <FormLabel className="font-normal">
                            OR - Any criterion must be met
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="stopOnMatch"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Stop on Match</FormLabel>
                        <FormDescription>
                          Stop evaluating other rules if this matches
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Enabled</FormLabel>
                        <FormDescription>
                          Rule is active and will be evaluated
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : rule ? "Update Rule" : "Create Rule"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}