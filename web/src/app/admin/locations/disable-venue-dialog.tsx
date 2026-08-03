"use client";

import { useState } from "react";
import { Archive, Loader2, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import type { Venue } from "./types";

interface DisableVenueDialogProps {
  /** The venue pending confirmation, or null when closed. */
  venue: Venue | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (venue: Venue) => Promise<void>;
}

export function DisableVenueDialog({
  venue,
  onOpenChange,
  onConfirm,
}: DisableVenueDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (!venue || busy) return;
    setBusy(true);
    try {
      await onConfirm(venue);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={venue !== null}
      onOpenChange={(next) => !busy && onOpenChange(next)}
    >
      <DialogContent
        className="sm:max-w-md"
        data-testid="disable-location-dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-accent">Disable location?</DialogTitle>
          <DialogDescription>
            Disabled venues disappear from the options when scheduling new
            shifts. You can restore them at any time.
          </DialogDescription>
        </DialogHeader>

        {venue && (
          <div className="space-y-3">
            <div className="rounded-xl bg-muted/50 px-4 py-3">
              <p className="flex items-center gap-2 font-accent text-base font-semibold">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {venue.name}
              </p>
              <p className="mt-0.5 pl-6 text-sm text-muted-foreground">
                {venue.address}
              </p>
            </div>
            {venue.upcomingShifts > 0 && (
              <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                {venue.upcomingShifts} upcoming{" "}
                {venue.upcomingShifts === 1 ? "shift" : "shifts"} at this venue
                will stay active and visible to volunteers.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={busy}
            data-testid="disable-location-confirm-button"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            Disable location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
