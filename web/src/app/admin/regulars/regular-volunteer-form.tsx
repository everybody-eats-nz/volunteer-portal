"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { PlusIcon, ChevronDownIcon } from "lucide-react";

type Volunteer = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  regularVolunteers: {
    shiftTypeId: string;
  }[];
};

type ShiftType = {
  id: string;
  name: string;
};
const FREQUENCIES = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "FORTNIGHTLY", label: "Fortnightly" },
  { value: "MONTHLY", label: "Monthly" },
];
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function RegularVolunteerForm({
  volunteers,
  shiftTypes,
  locations,
}: {
  volunteers: Volunteer[];
  shiftTypes: ShiftType[];
  locations: readonly string[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Transform volunteers into combobox options
  const volunteerOptions = volunteers.map((v) => {
    const displayName =
      v.firstName && v.lastName
        ? `${v.firstName} ${v.lastName}`
        : v.name
        ? v.name
        : v.email;
    return {
      value: v.id,
      label: `${displayName} (${v.email})`,
    };
  });

  const [formData, setFormData] = useState({
    userId: "",
    shiftTypeId: "",
    location: "",
    frequency: "WEEKLY",
    availableDays: [] as string[],
    notes: "",
    addToExistingShifts: true,
    autoApprove: false,
  });

  // Get the selected volunteer's existing regular shift types
  const selectedVolunteer = volunteers.find((v) => v.id === formData.userId);
  const existingShiftTypeIds = new Set(
    selectedVolunteer?.regularVolunteers.map((r) => r.shiftTypeId) || []
  );

  // Filter available shift types for the selected volunteer
  const availableShiftTypes = shiftTypes.filter(
    (st) => !existingShiftTypeIds.has(st.id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.availableDays.length === 0) {
      toast.error("Please select at least one available day");
      return;
    }

    if (!formData.userId) {
      toast.error("Please select a volunteer");
      return;
    }

    if (!formData.shiftTypeId) {
      toast.error("Please select a shift type");
      return;
    }

    if (!formData.location) {
      toast.error("Please select a location");
      return;
    }

    console.log("Submitting form data:", formData);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/regulars", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("API Error:", error);
        const errorMessage =
          error.error ||
          `Failed to create regular volunteer (${response.status})`;
        const errorDetails = error.details
          ? `\nDetails: ${JSON.stringify(error.details, null, 2)}`
          : "";
        throw new Error(errorMessage + errorDetails);
      }

      const result = await response.json();
      const signupsCreated = result.signupsCreated || 0;

      if (signupsCreated > 0) {
        toast.success(`Regular volunteer created and signed up for ${signupsCreated} existing shift${signupsCreated === 1 ? '' : 's'}`);
      } else {
        toast.success("Regular volunteer created successfully");
      }

      // Reset form
      setFormData({
        userId: "",
        shiftTypeId: "",
        location: "",
        frequency: "WEEKLY",
        availableDays: [],
        notes: "",
        addToExistingShifts: true,
        autoApprove: false,
      });

      setIsOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create regular volunteer"
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day],
    }));
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 dark:hover:bg-accent/30 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Add Regular Volunteer</CardTitle>
                <CardDescription>
                  Assign a volunteer to automatically sign up for recurring
                  shifts
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                {isOpen ? (
                  <ChevronDownIcon className="h-5 w-5 rotate-180 transition-transform" />
                ) : (
                  <>
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Add Regular
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Volunteer Selection */}
                <div className="space-y-2">
                  <Label htmlFor="userId">Volunteer *</Label>
                  <Combobox
                    options={volunteerOptions}
                    value={formData.userId}
                    onValueChange={(value) => {
                      // Reset shiftTypeId when volunteer changes to avoid invalid selections
                      setFormData((prev) => ({ ...prev, userId: value, shiftTypeId: "" }));
                    }}
                    placeholder="Select a volunteer..."
                    searchPlaceholder="Search volunteers..."
                    emptyText="No volunteers found."
                  />
                </div>

                {/* Shift Type */}
                <div className="space-y-2">
                  <Label htmlFor="shiftTypeId">Shift Type *</Label>
                  {formData.userId && availableShiftTypes.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                      This volunteer is already regular for all shift types.
                    </div>
                  ) : (
                    <Select
                      value={formData.shiftTypeId}
                      onValueChange={(value) => {
                        setFormData((prev) => ({ ...prev, shiftTypeId: value }));
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select shift type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableShiftTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {formData.userId && existingShiftTypeIds.size > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Already regular for: {shiftTypes
                        .filter((st) => existingShiftTypeIds.has(st.id))
                        .map((st) => st.name)
                        .join(", ")}
                    </p>
                  )}
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Select
                    value={formData.location}
                    onValueChange={(value) => {
                      console.log("Selected location:", value);
                      setFormData((prev) => ({ ...prev, location: value }));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select location..." />
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

                {/* Frequency */}
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency *</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) => {
                      console.log("Selected frequency:", value);
                      setFormData((prev) => ({ ...prev, frequency: value }));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select frequency..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((freq) => (
                        <SelectItem key={freq.value} value={freq.value}>
                          {freq.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Available Days */}
              <div className="space-y-2">
                <Label>Available Days *</Label>
                <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                  {DAYS.map((day) => (
                    <Button
                      key={day}
                      type="button"
                      variant={
                        formData.availableDays.includes(day)
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => toggleDay(day)}
                      className="w-full"
                    >
                      {day.slice(0, 3)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Admin Notes (Optional)</Label>
                <Textarea
                  name="notes"
                  rows={3}
                  placeholder="Any special notes about this regular assignment..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>

              {/* Add to Existing Shifts */}
              <div className="flex items-start space-x-3 p-4 rounded-lg border bg-muted/50">
                <Checkbox
                  id="addToExistingShifts"
                  checked={formData.addToExistingShifts}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      addToExistingShifts: checked === true,
                    }))
                  }
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="addToExistingShifts"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Add to existing future shifts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sign up this volunteer for matching future shifts that already exist in the system.
                  </p>
                </div>
              </div>

              {/* Auto-Approve */}
              <div className="flex items-start space-x-3 p-4 rounded-lg border bg-muted/50">
                <Switch
                  id="autoApprove"
                  checked={formData.autoApprove}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      autoApprove: checked === true,
                    }))
                  }
                />
                <div className="space-y-1">
                  <Label
                    htmlFor="autoApprove"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Auto-approve signups
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically confirm signups for this volunteer without requiring admin review.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create Regular Volunteer"}
                </Button>
              </div>
            </form>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
