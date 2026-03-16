"use client";

import { useState, useCallback } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarIcon,
  PlayIcon,
  CheckCircleIcon,
  Loader2Icon,
  EyeIcon,
  MapPinIcon,
  UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type PreviewVolunteer = {
  name: string;
  signups: number;
  id: string;
};

type PreviewLocation = {
  location: string;
  signups: number;
};

type PreviewData = {
  signupsToCreate: number;
  shiftsProcessed: number;
  preview: {
    volunteers: PreviewVolunteer[];
    locations: PreviewLocation[];
  };
  message: string;
};

type ApplyResult = {
  signupsCreated: number;
  shiftsProcessed: number;
  message: string;
};

interface ApplyRegularsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-filter to a specific location (from the table's location filter) */
  selectedLocation?: string;
  /** When set, applies only to this single regular volunteer (row action) */
  regularVolunteer?: {
    id: string;
    user: {
      firstName: string | null;
      lastName: string | null;
    };
  } | null;
}

export function ApplyRegularsDialog({
  open,
  onOpenChange,
  selectedLocation,
  regularVolunteer,
}: ApplyRegularsDialogProps) {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [selectedVolunteerIds, setSelectedVolunteerIds] = useState<Set<string>>(
    new Set()
  );
  const [result, setResult] = useState<ApplyResult | null>(null);

  const isIndividual = !!regularVolunteer;

  const volunteerLabel = isIndividual
    ? [regularVolunteer.user.firstName, regularVolunteer.user.lastName]
        .filter(Boolean)
        .join(" ")
    : null;

  const reset = useCallback(() => {
    setPreview(null);
    setSelectedVolunteerIds(new Set());
    setResult(null);
  }, []);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      reset();
      setDateRange(undefined);
    }
  };

  const buildRequestBody = (dryRun: boolean) => {
    const body: Record<string, unknown> = {
      startDate: format(dateRange!.from!, "yyyy-MM-dd"),
      endDate: format(dateRange!.to!, "yyyy-MM-dd"),
      dryRun,
    };
    if (selectedLocation) {
      body.location = selectedLocation;
    }
    if (isIndividual) {
      body.regularVolunteerIds = [regularVolunteer.id];
    } else if (!dryRun && selectedVolunteerIds.size > 0) {
      body.regularVolunteerIds = Array.from(selectedVolunteerIds);
    }
    return body;
  };

  const handlePreview = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Please select a date range");
      return;
    }

    setLoading(true);
    reset();

    try {
      const response = await fetch("/api/admin/regulars/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody(true)),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to preview");
      }

      const data: PreviewData = await response.json();
      setPreview(data);
      // Select all volunteers by default
      setSelectedVolunteerIds(
        new Set(data.preview.volunteers.map((v) => v.id))
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate preview"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/regulars/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody(false)),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to apply regular volunteers");
      }

      const data: ApplyResult = await response.json();
      setResult(data);
      setPreview(null);

      if (data.signupsCreated > 0) {
        toast.success(data.message);
        router.refresh();
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to apply regular volunteers"
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleVolunteer = (id: string) => {
    setSelectedVolunteerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!preview) return;
    const allIds = preview.preview.volunteers.map((v) => v.id);
    if (selectedVolunteerIds.size === allIds.length) {
      setSelectedVolunteerIds(new Set());
    } else {
      setSelectedVolunteerIds(new Set(allIds));
    }
  };

  // Count signups for only selected volunteers
  const selectedSignupCount = preview
    ? preview.preview.volunteers
        .filter((v) => selectedVolunteerIds.has(v.id))
        .reduce((sum, v) => sum + v.signups, 0)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlayIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            {isIndividual
              ? `Apply ${volunteerLabel} to Shifts`
              : "Apply Regular Volunteers to Shifts"}
          </DialogTitle>
          <DialogDescription>
            {isIndividual
              ? `Preview and apply shift signups for ${volunteerLabel} in a date range.`
              : "Preview and apply regular volunteer signups for existing shifts. Volunteers already signed up for a day are skipped."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              Date Range
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-11",
                    !dateRange?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                    reset();
                  }}
                  initialFocus
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Preview Results */}
          {preview && preview.signupsToCreate > 0 && (
            <div className="space-y-3">
              {/* Location breakdown */}
              {preview.preview.locations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {preview.preview.locations.map((loc) => (
                    <div
                      key={loc.location}
                      className="flex items-center gap-1.5 text-xs bg-muted/50 px-2.5 py-1.5 rounded-md"
                    >
                      <MapPinIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{loc.location}</span>
                      <span className="text-muted-foreground">
                        {loc.signups} signup{loc.signups === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Volunteer selection (bulk mode only) */}
              {!isIndividual && preview.preview.volunteers.length > 1 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={
                          selectedVolunteerIds.size ===
                          preview.preview.volunteers.length
                        }
                        onCheckedChange={toggleAll}
                      />
                      <span className="text-sm font-medium">
                        Volunteers ({selectedVolunteerIds.size}/
                        {preview.preview.volunteers.length})
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {selectedSignupCount} signup
                      {selectedSignupCount === 1 ? "" : "s"} selected
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y">
                    {preview.preview.volunteers.map((vol) => (
                      <label
                        key={vol.id}
                        className="flex items-center justify-between px-3 py-2 hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedVolunteerIds.has(vol.id)}
                            onCheckedChange={() => toggleVolunteer(vol.id)}
                          />
                          <div className="flex items-center gap-1.5">
                            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{vol.name}</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {vol.signups} shift{vol.signups === 1 ? "" : "s"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Single volunteer preview */}
              {(isIndividual || preview.preview.volunteers.length === 1) &&
                preview.preview.volunteers.length > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {preview.preview.volunteers[0].name}
                    </span>
                    <span className="text-muted-foreground">
                      — {preview.preview.volunteers[0].signups} shift
                      {preview.preview.volunteers[0].signups === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
            </div>
          )}

          {/* Preview: nothing to do */}
          {preview && preview.signupsToCreate === 0 && (
            <div className="p-4 rounded-lg border bg-muted/50 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircleIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <p>{preview.message}</p>
              </div>
            </div>
          )}

          {/* Applied result */}
          {result && (
            <div
              className={cn(
                "p-4 rounded-lg border text-sm",
                result.signupsCreated > 0
                  ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                  : "bg-muted/50 border-border"
              )}
            >
              <div className="flex items-start gap-2">
                <CheckCircleIcon
                  className={cn(
                    "h-4 w-4 mt-0.5 shrink-0",
                    result.signupsCreated > 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-muted-foreground"
                  )}
                />
                <div>
                  <p className="font-medium">{result.message}</p>
                  <p className="text-muted-foreground mt-1">
                    {result.shiftsProcessed} shift
                    {result.shiftsProcessed === 1 ? "" : "s"} processed
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              {result ? "Close" : "Cancel"}
            </Button>

            {/* Step 1: Preview */}
            {!preview && !result && (
              <Button
                onClick={handlePreview}
                disabled={loading || !dateRange?.from || !dateRange?.to}
                className="gap-2"
              >
                {loading ? (
                  <>
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <EyeIcon className="h-4 w-4" />
                    Preview
                  </>
                )}
              </Button>
            )}

            {/* Step 2: Confirm */}
            {preview && preview.signupsToCreate > 0 && !result && (
              <Button
                onClick={handleApply}
                disabled={loading || selectedSignupCount === 0}
                className="gap-2"
              >
                {loading ? (
                  <>
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <PlayIcon className="h-4 w-4" />
                    Apply {selectedSignupCount} Signup
                    {selectedSignupCount === 1 ? "" : "s"}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
