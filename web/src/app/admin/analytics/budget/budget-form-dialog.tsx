"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money0, money2 } from "../_lib/chart-theme";

export interface BudgetFormTarget {
  locationId: string;
  location: string;
  year: number;
  budget: { annualTarget: number; plannedServiceNights: number } | null;
}

export function BudgetFormDialog({
  target,
  onOpenChange,
}: {
  /** The location + year being edited; null closes the dialog. */
  target: BudgetFormTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [annualTarget, setAnnualTarget] = useState("");
  const [plannedNights, setPlannedNights] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (target) {
      setAnnualTarget(target.budget ? String(target.budget.annualTarget) : "");
      setPlannedNights(
        target.budget ? String(target.budget.plannedServiceNights) : ""
      );
      setBusy(false);
    }
  }, [target]);

  const annual = Number(annualTarget);
  const nights = Number(plannedNights);
  const annualValid = annualTarget !== "" && Number.isFinite(annual) && annual > 0;
  const nightsValid =
    plannedNights !== "" && Number.isInteger(nights) && nights >= 1 && nights <= 366;
  const valid = annualValid && nightsValid;
  const isEdit = target?.budget != null;

  const save = async () => {
    if (!target || !valid || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/location-budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: target.locationId,
          year: target.year,
          annualTarget: annual,
          plannedServiceNights: nights,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Couldn't save the budget");
        return;
      }
      toast.success(`${target.location} ${target.year} budget saved`);
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error("Error saving budget:", error);
      toast.error("Couldn't save the budget");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const params = new URLSearchParams({
        locationId: target.locationId,
        year: String(target.year),
      });
      const res = await fetch(`/api/admin/location-budgets?${params}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Couldn't remove the budget");
        return;
      }
      toast.success(`${target.location} ${target.year} budget removed`);
      setConfirmRemove(false);
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error("Error removing budget:", error);
      toast.error("Couldn't remove the budget");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog
        open={target !== null}
        onOpenChange={(next) => !busy && onOpenChange(next)}
      >
        <DialogContent className="sm:max-w-md" data-testid="budget-form-dialog">
          <DialogHeader>
            <DialogTitle className="font-accent">
              {target?.location} budget for {target?.year}
            </DialogTitle>
            <DialogDescription>
              Each service night&rsquo;s koha target is the annual budget spread
              evenly over the planned nights.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="budget-annual">
                  Annual koha target ($) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="budget-annual"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={annualTarget}
                  onChange={(e) => setAnnualTarget(e.target.value)}
                  placeholder="e.g. 120000"
                  disabled={busy}
                  aria-invalid={annualTarget !== "" && !annualValid}
                  data-testid="budget-annual-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget-nights">
                  Planned service nights <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="budget-nights"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="366"
                  step="1"
                  value={plannedNights}
                  onChange={(e) => setPlannedNights(e.target.value)}
                  placeholder="e.g. 240"
                  disabled={busy}
                  aria-invalid={plannedNights !== "" && !nightsValid}
                  data-testid="budget-nights-input"
                />
              </div>
            </div>
            {plannedNights !== "" && !nightsValid && (
              <p className="-mt-3 text-xs text-destructive" role="alert">
                Planned nights must be a whole number from 1 to 366.
              </p>
            )}

            <div
              className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-4 py-3"
              aria-live="polite"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Nightly target
                </p>
                <p className="text-xs text-muted-foreground">
                  {valid
                    ? `${money0(annual)} ÷ ${nights} nights`
                    : "Fill in both fields to see it"}
                </p>
              </div>
              <span
                className="font-accent text-2xl font-semibold tabular-nums"
                data-testid="budget-nightly-preview"
              >
                {valid ? money2(annual / nights) : "—"}
              </span>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              {isEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmRemove(true)}
                  disabled={busy}
                  data-testid="budget-remove-button"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              ) : (
                <span className="hidden sm:block" />
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
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
                  data-testid="budget-save-button"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isEdit ? "Save budget" : "Set budget"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove the {target?.year} budget for {target?.location}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Budget tracking for {target?.year} will stop and nightly targets
              fall back to the location&rsquo;s standing koha target. Recorded
              koha is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep budget</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                remove();
              }}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Remove budget
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
