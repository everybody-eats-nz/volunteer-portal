"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarIcon, PlayIcon, CheckCircleIcon, Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ApplyRegularsDialogProps {
  locations: readonly string[];
  selectedLocation?: string;
}

export function ApplyRegularsDialog({
  locations,
  selectedLocation,
}: ApplyRegularsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [location, setLocation] = useState<string>(selectedLocation || "all");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    signupsCreated: number;
    shiftsProcessed: number;
    message: string;
  } | null>(null);

  const handleApply = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Please select a date range");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const body: Record<string, string> = {
        startDate: format(dateRange.from, "yyyy-MM-dd"),
        endDate: format(dateRange.to, "yyyy-MM-dd"),
      };
      if (location !== "all") {
        body.location = location;
      }

      const response = await fetch("/api/admin/regulars/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to apply regular volunteers");
      }

      const data = await response.json();
      setResult(data);

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

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setResult(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <PlayIcon className="h-4 w-4" />
          Apply Regulars to Shifts
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlayIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Apply Regular Volunteers
          </DialogTitle>
          <DialogDescription>
            Auto-populate regular volunteers into existing shifts for a date
            range. Volunteers who already have a signup for that day will be
            skipped.
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
                  onSelect={setDateRange}
                  initialFocus
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Location</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Result */}
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
                    {result.shiftsProcessed === 1 ? "" : "s"} checked
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
            <Button
              onClick={handleApply}
              disabled={loading || !dateRange?.from || !dateRange?.to}
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
                  Apply Regulars
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
