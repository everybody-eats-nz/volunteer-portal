"use client";

import { useEffect, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

import type { Venue } from "./types";

export interface VenueFormValues {
  name: string;
  address: string;
  defaultMealsServed: number;
  /** Raw input string — "" means no target. */
  targetPerNight: string;
  isPopup: boolean;
}

interface VenueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Venue being edited, or null when creating a new one. */
  venue: Venue | null;
  /** Resolves true on success — the dialog closes itself. */
  onSubmit: (values: VenueFormValues) => Promise<boolean>;
}

function initialValues(venue: Venue | null): VenueFormValues {
  return {
    name: venue?.name ?? "",
    address: venue?.address ?? "",
    defaultMealsServed: venue?.defaultMealsServed ?? 60,
    targetPerNight:
      venue?.targetPerNight != null ? String(venue.targetPerNight) : "",
    isPopup: venue?.isPopup ?? false,
  };
}

export function VenueFormDialog({
  open,
  onOpenChange,
  venue,
  onSubmit,
}: VenueFormDialogProps) {
  const [values, setValues] = useState<VenueFormValues>(() =>
    initialValues(venue)
  );
  const [busy, setBusy] = useState(false);

  const isEdit = venue !== null;
  const isRename = isEdit && values.name.trim() !== venue.name;

  useEffect(() => {
    if (open) {
      setValues(initialValues(venue));
      setBusy(false);
    }
  }, [open, venue]);

  const valid =
    values.name.trim().length > 0 &&
    values.address.trim().length > 0 &&
    Number.isFinite(values.defaultMealsServed) &&
    values.defaultMealsServed >= 0;

  const handleSubmit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const ok = await onSubmit({
        ...values,
        name: values.name.trim(),
        address: values.address.trim(),
      });
      if (ok) onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg" data-testid="venue-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-accent">
            {isEdit ? `Edit ${venue.name}` : "Add a location"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the venue details and its per-service settings."
              : "New locations stay hidden from volunteers until they have upcoming shifts."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="venue-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="venue-name"
                value={values.name}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g. Auckland Central"
                disabled={busy}
                data-testid="venue-name-input"
              />
              {isRename && (
                <p className="flex items-start gap-1.5 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Renaming also updates every shift, template, and volunteer
                  preference that points at &ldquo;{venue.name}&rdquo;.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="venue-address">
                Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="venue-address"
                value={values.address}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    address: event.target.value,
                  }))
                }
                placeholder="123 Main Street, Auckland"
                disabled={busy}
                data-testid="venue-address-input"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Per-service settings
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="venue-meals">
                  Meals served / night{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="venue-meals"
                  type="number"
                  min="0"
                  value={
                    Number.isFinite(values.defaultMealsServed)
                      ? values.defaultMealsServed
                      : ""
                  }
                  onChange={(event) =>
                    setValues((prev) => ({
                      ...prev,
                      defaultMealsServed:
                        event.target.value === ""
                          ? NaN
                          : parseInt(event.target.value, 10),
                    }))
                  }
                  disabled={busy}
                  data-testid="venue-meals-input"
                />
                <p className="text-xs text-muted-foreground">
                  Pre-filled when recording meals served.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="venue-koha">Koha target / night ($)</Label>
                <Input
                  id="venue-koha"
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.targetPerNight}
                  onChange={(event) =>
                    setValues((prev) => ({
                      ...prev,
                      targetPerNight: event.target.value,
                    }))
                  }
                  placeholder="e.g. 781"
                  disabled={busy}
                  data-testid="venue-koha-input"
                />
                <p className="text-xs text-muted-foreground">
                  Banking target. Leave empty for none.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="venue-popup">Pop-up venue</Label>
                <p className="text-xs text-muted-foreground">
                  Temporary venue — volunteers can pick it as an available
                  location, but never as their home base.
                </p>
              </div>
              <Switch
                id="venue-popup"
                checked={values.isPopup}
                onCheckedChange={(checked) =>
                  setValues((prev) => ({ ...prev, isPopup: checked }))
                }
                disabled={busy}
                data-testid="venue-popup-switch"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!valid || busy}
              data-testid="venue-form-submit"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
