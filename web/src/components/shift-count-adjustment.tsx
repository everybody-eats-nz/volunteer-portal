"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Save, X, Loader2, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface ShiftCountAdjustmentProps {
  userId: string;
  currentAdjustment: number;
  currentNote: string | null;
  adjustedBy: string | null;
  adjustedAt: Date | null;
}

export function ShiftCountAdjustment({
  userId,
  currentAdjustment,
  currentNote,
  adjustedBy,
  adjustedAt,
}: ShiftCountAdjustmentProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [adjustment, setAdjustment] = useState(currentAdjustment);
  const [note, setNote] = useState(currentNote || "");

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/admin/users/${userId}/shift-adjustment`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adjustment,
            note: note.trim() || undefined,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update adjustment");
      }

      toast.success("Shift count adjustment updated");
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update adjustment"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setAdjustment(currentAdjustment);
    setNote(currentNote || "");
    setIsEditing(false);
  };

  return (
    <Card data-testid="shift-count-adjustment-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Shift Count Adjustment
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adjustment">Adjustment value</Label>
              <Input
                id="adjustment"
                type="number"
                value={adjustment}
                onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
                placeholder="e.g. 10 or -5"
                data-testid="shift-adjustment-input"
              />
              <p className="text-xs text-muted-foreground">
                This number is added to the volunteer&apos;s completed shift
                count. Use positive numbers to add shifts, negative to subtract.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Reason (optional)</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Missing shifts from old system"
                data-testid="shift-adjustment-note-input"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                data-testid="shift-adjustment-save-button"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
                data-testid="shift-adjustment-cancel-button"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                {currentAdjustment !== 0 ? (
                  <div className="space-y-1">
                    <p
                      className="text-sm font-medium"
                      data-testid="shift-adjustment-value"
                    >
                      {currentAdjustment > 0 ? "+" : ""}
                      {currentAdjustment} shifts
                    </p>
                    {currentNote && (
                      <p className="text-xs text-muted-foreground">
                        {currentNote}
                      </p>
                    )}
                    {adjustedBy && adjustedAt && (
                      <p className="text-xs text-muted-foreground">
                        Set by {adjustedBy} on{" "}
                        {new Date(adjustedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No adjustment
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                data-testid="shift-adjustment-edit-button"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
