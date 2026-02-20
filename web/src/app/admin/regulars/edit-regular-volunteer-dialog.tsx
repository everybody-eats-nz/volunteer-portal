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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserIcon, EditIcon } from "lucide-react";

type RegularVolunteer = {
  id: string;
  userId: string;
  location: string;
  frequency: string;
  availableDays: string[];
  isActive: boolean;
  isPausedByUser: boolean;
  autoApprove: boolean;
  pausedUntil: Date | null;
  notes: string | null;
  volunteerNotes: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
  };
  shiftType: {
    id: string;
    name: string;
  };
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

export function EditRegularVolunteerDialog({
  regular,
  shiftTypes,
  open,
  onOpenChange,
  locations,
  otherShiftTypeIds = [],
}: {
  regular: RegularVolunteer;
  shiftTypes: ShiftType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: readonly string[];
  otherShiftTypeIds?: string[]; // Shift type IDs this user is already regular for (excluding current)
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Filter out shift types that the user is already regular for (excluding current)
  const unavailableShiftTypeIds = new Set(otherShiftTypeIds);
  const availableShiftTypes = shiftTypes.filter(
    (st) => st.id === regular.shiftType.id || !unavailableShiftTypeIds.has(st.id)
  );

  const [formData, setFormData] = useState({
    shiftTypeId: regular.shiftType.id,
    location: regular.location,
    frequency: regular.frequency,
    availableDays: regular.availableDays,
    notes: regular.notes || "",
    isActive: regular.isActive,
    autoApprove: regular.autoApprove,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.availableDays.length === 0) {
      toast.error("Please select at least one available day");
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

    setLoading(true);

    try {
      const response = await fetch(`/api/admin/regulars/${regular.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorMessage =
          error.error ||
          `Failed to update regular volunteer (${response.status})`;
        const errorDetails = error.details
          ? `\nDetails: ${JSON.stringify(error.details, null, 2)}`
          : "";
        throw new Error(errorMessage + errorDetails);
      }

      toast.success("Regular volunteer updated successfully");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update regular volunteer"
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

  const volunteerDisplayName =
    regular.user.firstName && regular.user.lastName
      ? `${regular.user.firstName} ${regular.user.lastName}`
      : regular.user.name || regular.user.email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EditIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Edit Regular Volunteer
          </DialogTitle>
          <DialogDescription>
            Update the regular assignment for{" "}
            <span className="font-medium">{volunteerDisplayName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Volunteer Info */}
          <div className="bg-muted/50 dark:bg-muted/20 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <UserIcon className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">{volunteerDisplayName}</div>
                <div className="text-sm text-muted-foreground">
                  {regular.user.email}
                </div>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Shift Type */}
              <div className="space-y-2">
                <Label htmlFor="shiftTypeId">Shift Type *</Label>
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
                {otherShiftTypeIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Already regular for: {shiftTypes
                      .filter((st) => unavailableShiftTypeIds.has(st.id))
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

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="isActive">Status *</Label>
                <Select
                  value={formData.isActive ? "active" : "inactive"}
                  onValueChange={(value) => {
                    setFormData((prev) => ({
                      ...prev,
                      isActive: value === "active",
                    }));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <Badge variant="success" className="text-xs">
                          Active
                        </Badge>
                        <span>Active</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="inactive">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          Inactive
                        </Badge>
                        <span>Inactive</span>
                      </div>
                    </SelectItem>
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

            {/* Auto-Approve */}
            <div className="flex items-start space-x-3 p-4 rounded-lg border bg-muted/50">
              <Switch
                id="editAutoApprove"
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
                  htmlFor="editAutoApprove"
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
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Updating..." : "Update Regular Volunteer"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
