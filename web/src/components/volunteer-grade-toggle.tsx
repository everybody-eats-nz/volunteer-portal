"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Award, ChevronDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { type VolunteerGrade } from "@prisma/client";
import {
  VOLUNTEER_GRADE_OPTIONS,
  getVolunteerGradeInfo,
} from "@/lib/volunteer-grades";
import { useCallback, useEffect } from "react";

interface VolunteerGradeToggleProps {
  userId: string;
  currentGrade: VolunteerGrade;
  userRole: "ADMIN" | "VOLUNTEER";
  onGradeChange?: (newGrade: VolunteerGrade) => void;
}

export function VolunteerGradeToggle({
  userId,
  currentGrade,
  userRole,
  onGradeChange,
}: VolunteerGradeToggleProps) {
  const [open, setOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] =
    useState<VolunteerGrade>(currentGrade);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticGrade, setOptimisticGrade] =
    useState<VolunteerGrade>(currentGrade);
  const router = useRouter();

  // Update local state when currentGrade prop changes
  useEffect(() => {
    setSelectedGrade(currentGrade);
    setOptimisticGrade(currentGrade);
  }, [currentGrade]);

  const handleGradeChange = useCallback(async () => {
    if (selectedGrade === currentGrade) {
      setOpen(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Optimistic update
    setOptimisticGrade(selectedGrade);
    onGradeChange?.(selectedGrade);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`/api/admin/users/${userId}/grade`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          volunteerGrade: selectedGrade,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      await response.json(); // Response processed but data not needed

      toast.success(
        `Volunteer grade updated to ${
          getVolunteerGradeInfo(selectedGrade).label
        }`
      );
      setOpen(false);

      // Only refresh if no callback is provided (fallback behavior)
      if (!onGradeChange) {
        router.refresh();
      }
    } catch (error) {
      console.error("Error updating volunteer grade:", error);

      let errorMessage = "Failed to update volunteer grade";

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          errorMessage = "Request timeout - please try again";
        } else {
          errorMessage = error.message;
        }
      }

      // Revert optimistic update on error
      setOptimisticGrade(currentGrade);
      onGradeChange?.(currentGrade);

      setError(errorMessage);
      toast.error(errorMessage);

      // Reset selection on error
      setSelectedGrade(currentGrade);
    } finally {
      setIsLoading(false);
    }
  }, [selectedGrade, currentGrade, userId, onGradeChange, router]);

  // Only show for volunteers, not admins
  if (userRole !== "VOLUNTEER") {
    return null;
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 h-8"
          data-testid={`grade-toggle-button-${userId}`}
        >
          <span className="text-xs">
            {getVolunteerGradeInfo(optimisticGrade).icon}
          </span>
          {getVolunteerGradeInfo(optimisticGrade).label}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent
        className="sm:max-w-[420px]"
        data-testid="grade-change-dialog"
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle
            className="flex items-center gap-2"
            data-testid="grade-change-dialog-title"
          >
            <Award className="h-5 w-5 text-blue-600" />
            Change Volunteer Grade
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Select the appropriate volunteer grade based on their experience and
            capabilities. Each grade provides different levels of access and
            responsibilities.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div
            className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
            data-testid="current-grade-display"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Current Grade:</span>
              <Badge
                variant="outline"
                className={getVolunteerGradeInfo(currentGrade).color}
              >
                <span className="mr-1">
                  {getVolunteerGradeInfo(currentGrade).icon}
                </span>
                {getVolunteerGradeInfo(currentGrade).label}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">New Grade:</label>
            <Select
              value={selectedGrade}
              onValueChange={(value: VolunteerGrade) => setSelectedGrade(value)}
            >
              <SelectTrigger data-testid="grade-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOLUNTEER_GRADE_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    data-testid={`grade-option-${option.value}`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{option.icon}</span>
                      <div className="flex flex-col">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedGrade !== currentGrade && (
            <div
              className="flex items-center justify-between p-4 bg-blue-50 rounded-lg"
              data-testid="new-grade-display"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">New Grade:</span>
                <Badge
                  variant="outline"
                  className={getVolunteerGradeInfo(selectedGrade).color}
                >
                  <span className="mr-1">
                    {getVolunteerGradeInfo(selectedGrade).icon}
                  </span>
                  {getVolunteerGradeInfo(selectedGrade).label}
                </Badge>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSelectedGrade(currentGrade);
              setError(null);
              setOpen(false);
            }}
            disabled={isLoading}
            data-testid="grade-change-cancel-button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGradeChange}
            disabled={isLoading || selectedGrade === currentGrade}
            className="btn-primary"
            data-testid="grade-change-confirm-button"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Updating...
              </>
            ) : (
              <>
                <Award className="h-4 w-4 mr-2" />
                Update Grade
              </>
            )}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
