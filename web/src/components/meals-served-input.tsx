"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Utensils, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MealsServedInputProps {
  date: string; // ISO date string (YYYY-MM-DD)
  location: string;
}

export function MealsServedInput({ date, location }: MealsServedInputProps) {
  const [mealsServed, setMealsServed] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [defaultValue, setDefaultValue] = useState<number>(60);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [hasExistingRecord, setHasExistingRecord] = useState(false);

  // Fetch existing meals served data
  useEffect(() => {
    const fetchData = async () => {
      setFetching(true);
      try {
        const response = await fetch(
          `/api/admin/meals-served?date=${date}&location=${encodeURIComponent(
            location
          )}`
        );
        if (response.ok) {
          const data = await response.json();
          const hasRecord =
            data.mealsServed !== null ||
            (typeof data.notes === "string" && data.notes.length > 0);
          if (hasRecord) {
            setMealsServed(
              data.mealsServed !== null ? data.mealsServed.toString() : ""
            );
            setNotes(data.notes || "");
            setHasExistingRecord(true);
          } else {
            setMealsServed("");
            setNotes("");
            setHasExistingRecord(false);
          }
          if (typeof data.defaultMealsServed === "number") {
            setDefaultValue(data.defaultMealsServed);
          }
        }
      } catch (error) {
        console.error("Error fetching meals served:", error);
      } finally {
        setFetching(false);
      }
    };

    fetchData();
  }, [date, location]);

  const trimmedNotes = notes.trim();
  const hasMealsCount = mealsServed !== "";
  const canSave = hasMealsCount || trimmedNotes.length > 0;
  const hasRecordedCount = hasExistingRecord && hasMealsCount;

  const handleSave = async () => {
    if (!canSave) {
      toast.error("Enter a meals count, a note, or both");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/meals-served", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date,
          location,
          mealsServed: hasMealsCount ? parseInt(mealsServed, 10) : null,
          notes: trimmedNotes,
        }),
      });

      if (response.ok) {
        setHasExistingRecord(true);
        toast.success(
          hasMealsCount
            ? "Meals served recorded successfully!"
            : "Note saved — add the meals count when you have it"
        );
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save meals served");
      }
    } catch (error) {
      console.error("Error saving meals served:", error);
      toast.error("Failed to save meals served");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Utensils className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Meals Served
          {hasExistingRecord && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({hasRecordedCount ? "Recorded" : "Note saved"})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="mealsServed">
              Number of people served{" "}
              {!hasRecordedCount && (
                <span className="text-xs text-muted-foreground">
                  (Default: {defaultValue})
                </span>
              )}
            </Label>
            <Input
              id="mealsServed"
              type="number"
              min="0"
              value={mealsServed}
              onChange={(e) => setMealsServed(e.target.value)}
              placeholder={`e.g., ${defaultValue}`}
              className="max-w-xs mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about today's service..."
              className="mt-1.5"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Leave a note now — you can add the count later.
            </p>
            <Button
              onClick={handleSave}
              disabled={loading || !canSave}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {hasExistingRecord ? "Update" : "Save"}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
