"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ChevronRight, GitMerge, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { NetworkOverview } from "./network-overview";
import { VenueRow, DisabledVenueRow } from "./venue-row";
import { VenueFormDialog, type VenueFormValues } from "./venue-form-dialog";
import { DisableVenueDialog } from "./disable-venue-dialog";
import { mergeApiLocation, type Venue } from "./types";

interface LocationsContentProps {
  initialVenues: Venue[];
}

function sortByName(venues: Venue[]): Venue[] {
  return [...venues].sort((a, b) => a.name.localeCompare(b.name));
}

export function LocationsContent({ initialVenues }: LocationsContentProps) {
  const [venues, setVenues] = useState(initialVenues);
  const [formOpen, setFormOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [disableTarget, setDisableTarget] = useState<Venue | null>(null);
  const [enablingId, setEnablingId] = useState<string | null>(null);
  const [disabledOpen, setDisabledOpen] = useState(false);

  const activeVenues = venues.filter((venue) => venue.isActive);
  const disabledVenues = venues.filter((venue) => !venue.isActive);

  const openCreate = useCallback(() => {
    setEditingVenue(null);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((venue: Venue) => {
    setEditingVenue(venue);
    setFormOpen(true);
  }, []);

  const handleFormSubmit = useCallback(
    async (values: VenueFormValues): Promise<boolean> => {
      const isEdit = editingVenue !== null;
      try {
        const response = await fetch("/api/admin/locations", {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(isEdit ? { id: editingVenue.id } : {}),
            name: values.name,
            address: values.address,
            defaultMealsServed: values.defaultMealsServed,
            targetPerNight: values.targetPerNight,
            isPopup: values.isPopup,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          toast.error(
            error.error ||
              (isEdit ? "Failed to update location" : "Failed to create location")
          );
          return false;
        }

        const raw = await response.json();
        if (isEdit) {
          setVenues((prev) =>
            sortByName(
              prev.map((venue) =>
                venue.id === editingVenue.id
                  ? mergeApiLocation(venue, raw)
                  : venue
              )
            )
          );
          toast.success("Location updated successfully!");
        } else {
          const created: Venue = {
            id: raw.id,
            name: raw.name,
            address: raw.address,
            defaultMealsServed: raw.defaultMealsServed,
            targetPerNight:
              raw.targetPerNight === null ? null : Number(raw.targetPerNight),
            isActive: true,
            isPopup: raw.isPopup,
            upcomingShifts: 0,
            nextServiceAt: null,
            managers: [],
          };
          setVenues((prev) => sortByName([...prev, created]));
          toast.success("Location created successfully!");
        }
        return true;
      } catch (error) {
        console.error("Error saving location:", error);
        toast.error(
          isEdit ? "Failed to update location" : "Failed to create location"
        );
        return false;
      }
    },
    [editingVenue]
  );

  const handleDisable = useCallback(async (venue: Venue) => {
    try {
      const response = await fetch(`/api/admin/locations/${venue.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to disable location");
        return;
      }

      const data = await response.json();
      setVenues((prev) =>
        prev.map((item) =>
          item.id === venue.id ? { ...item, isActive: false } : item
        )
      );
      toast.success(
        `Location disabled successfully${
          data.upcomingShifts > 0
            ? ` (${data.upcomingShifts} upcoming shifts remain active)`
            : ""
        }`
      );
    } catch (error) {
      console.error("Error disabling location:", error);
      toast.error("Failed to disable location");
    }
  }, []);

  const handleEnable = useCallback(async (venue: Venue) => {
    setEnablingId(venue.id);
    try {
      const response = await fetch(`/api/admin/locations/${venue.id}`, {
        method: "PUT",
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to re-enable location");
        return;
      }

      const raw = await response.json();
      setVenues((prev) =>
        sortByName(
          prev.map((item) =>
            item.id === venue.id
              ? { ...mergeApiLocation(item, raw), isActive: true }
              : item
          )
        )
      );
      toast.success("Location re-enabled successfully!");
    } catch (error) {
      console.error("Error re-enabling location:", error);
      toast.error("Failed to re-enable location");
    } finally {
      setEnablingId(null);
    }
  }, []);

  return (
    <AdminPageWrapper
      title="Restaurant locations"
      description="Keep every venue visible to volunteers and its service settings up to date"
    >
      <PageContainer className="space-y-8">
        <NetworkOverview venues={venues} />

        {/* Active venues ledger */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div data-testid="active-locations-section">
              <h2 className="font-accent text-lg font-semibold">
                Active locations ({activeVenues.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                Offered when scheduling shifts. Volunteers see a venue once it
                has upcoming shifts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link
                  href="/admin/locations/merge"
                  data-testid="merge-locations-link"
                >
                  <GitMerge className="h-4 w-4" />
                  Merge duplicates
                </Link>
              </Button>
              <Button
                size="sm"
                onClick={openCreate}
                data-testid="add-location-button"
              >
                <Plus className="h-4 w-4" />
                Add location
              </Button>
            </div>
          </div>

          {activeVenues.length > 0 ? (
            <ul className="space-y-3">
              {activeVenues.map((venue, index) => (
                <VenueRow
                  key={venue.id}
                  venue={venue}
                  index={index}
                  onEdit={openEdit}
                  onDisable={setDisableTarget}
                />
              ))}
            </ul>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1d5337]/10 text-[#1d5337] dark:bg-emerald-400/15 dark:text-emerald-300">
                <MapPin className="h-6 w-6" />
              </span>
              <div>
                <p className="font-accent text-base font-semibold">
                  No active locations
                </p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Add your first venue to start scheduling shifts and welcoming
                  volunteers.
                </p>
              </div>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add location
              </Button>
            </motion.div>
          )}
        </section>

        {/* Disabled venues */}
        {disabledVenues.length > 0 && (
          <Collapsible open={disabledOpen} onOpenChange={setDisabledOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                data-testid="inactive-locations-section"
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-muted/40 px-4 py-3 ring-1 ring-border/60 transition-colors hover:bg-muted/70"
              >
                <span className="flex items-center gap-2">
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      disabledOpen && "rotate-90"
                    )}
                  />
                  <span className="font-accent text-base font-semibold text-muted-foreground">
                    Disabled locations ({disabledVenues.length})
                  </span>
                </span>
                <span className="hidden text-xs text-muted-foreground sm:block">
                  Hidden when scheduling new shifts
                </span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="mt-3 space-y-2">
                {disabledVenues.map((venue) => (
                  <DisabledVenueRow
                    key={venue.id}
                    venue={venue}
                    onEnable={handleEnable}
                    enabling={enablingId === venue.id}
                  />
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}

        <VenueFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          venue={editingVenue}
          onSubmit={handleFormSubmit}
        />

        <DisableVenueDialog
          venue={disableTarget}
          onOpenChange={(open) => {
            if (!open) setDisableTarget(null);
          }}
          onConfirm={handleDisable}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}
