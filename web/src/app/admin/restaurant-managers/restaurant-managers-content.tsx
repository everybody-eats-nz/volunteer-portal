"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { MapPinned, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { EmailPreviewDialog } from "@/components/email-preview-dialog";
import { CoverageOverview } from "./coverage-overview";
import { LocationCoverageGrid } from "./location-coverage-grid";
import RestaurantManagerForm from "./restaurant-manager-form";
import RestaurantManagersTable from "./restaurant-managers-table";
import {
  computeCoverage,
  getUserDisplayName,
  sortCoverageByRisk,
  type Location,
  type ManagerUser,
  type RestaurantManager,
} from "./types";

interface RestaurantManagersContentProps {
  adminUsers: ManagerUser[];
  locations: Location[];
}

export function RestaurantManagersContent({
  adminUsers,
  locations,
}: RestaurantManagersContentProps) {
  const [managers, setManagers] = useState<RestaurantManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Lifted assign-form state so location cards can seed it.
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [receiveNotifications, setReceiveNotifications] = useState(true);

  const assignRef = useRef<HTMLDivElement | null>(null);
  const coverageRef = useRef<HTMLDivElement | null>(null);

  const fetchManagers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/restaurant-managers");
      if (!response.ok) throw new Error("Failed to fetch managers");
      setManagers(await response.json());
    } catch (error) {
      console.error("Error fetching managers:", error);
      toast.error("Failed to load restaurant managers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);

  const coverage = useMemo(
    () => sortCoverageByRisk(computeCoverage(locations, managers)),
    [locations, managers]
  );

  const stats = useMemo(() => {
    const covered = coverage.filter((c) => c.status === "active").length;
    const muted = coverage.filter((c) => c.status === "muted").length;
    const gaps = coverage.filter((c) => c.status === "gap").length;
    return { covered, muted, gaps };
  }, [coverage]);

  const existingForUser = useMemo(
    () => managers.find((m) => m.userId === selectedUser),
    [managers, selectedUser]
  );

  // When an existing manager is chosen, hydrate the form with their current
  // assignment so saving never silently wipes their other locations.
  const handleUserChange = useCallback(
    (userId: string) => {
      setSelectedUser(userId);
      const existing = managers.find((m) => m.userId === userId);
      if (existing) {
        setSelectedLocations(existing.locations);
        setReceiveNotifications(existing.receiveNotifications);
      } else {
        setReceiveNotifications(true);
      }
    },
    [managers]
  );

  const handleAddLocation = useCallback((location: string) => {
    if (!location) return;
    setSelectedLocations((prev) =>
      prev.includes(location) ? prev : [...prev, location]
    );
  }, []);

  const handleRemoveLocation = useCallback((location: string) => {
    setSelectedLocations((prev) => prev.filter((l) => l !== location));
  }, []);

  const scrollToAssign = useCallback(() => {
    assignRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // From a location card: seed the form with that location (merging with the
  // selected user's existing locations) and bring the form into view.
  const handleAssignToLocation = useCallback(
    (location: string) => {
      setSelectedLocations((prev) =>
        prev.includes(location) ? prev : [...prev, location]
      );
      scrollToAssign();
    },
    [scrollToAssign]
  );

  const resetForm = useCallback(() => {
    setSelectedUser("");
    setSelectedLocations([]);
    setReceiveNotifications(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedUser) {
      toast.error("Please select an admin user");
      return;
    }
    if (selectedLocations.length === 0) {
      toast.error("Please select at least one location");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/restaurant-managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser,
          locations: selectedLocations,
          receiveNotifications,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to assign manager");
      }

      const result: RestaurantManager = await response.json();
      const wasEditing = Boolean(existingForUser);
      const name = getUserDisplayName(result.user);
      toast.success(
        wasEditing
          ? `Updated ${name}'s assignment`
          : `Successfully assigned ${name}`
      );
      resetForm();
      await fetchManagers();
    } catch (error) {
      console.error("Error assigning manager:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to assign manager"
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedUser,
    selectedLocations,
    receiveNotifications,
    existingForUser,
    resetForm,
    fetchManagers,
  ]);

  const handleToggleNotifications = useCallback(
    async (managerId: string, currentState: boolean) => {
      const manager = managers.find((m) => m.id === managerId);
      if (!manager) return;
      setEditingId(managerId);
      try {
        const response = await fetch(
          `/api/admin/restaurant-managers/${managerId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              locations: manager.locations,
              receiveNotifications: !currentState,
            }),
          }
        );
        if (!response.ok) throw new Error("Failed to update notifications");
        const updated: RestaurantManager = await response.json();
        setManagers((prev) =>
          prev.map((m) => (m.id === managerId ? updated : m))
        );
        toast.success(
          `Notifications ${!currentState ? "enabled" : "disabled"} for ${getUserDisplayName(manager.user)}`
        );
      } catch (error) {
        console.error("Error updating notifications:", error);
        toast.error("Failed to update notification settings");
      } finally {
        setEditingId(null);
      }
    },
    [managers]
  );

  const handleDelete = useCallback(
    async (managerId: string) => {
      const manager = managers.find((m) => m.id === managerId);
      try {
        const response = await fetch(
          `/api/admin/restaurant-managers/${managerId}`,
          { method: "DELETE" }
        );
        if (!response.ok) throw new Error("Failed to delete assignment");
        setManagers((prev) => prev.filter((m) => m.id !== managerId));
        toast.success(
          manager
            ? `Removed ${getUserDisplayName(manager.user)}`
            : "Assignment removed"
        );
      } catch (error) {
        console.error("Error deleting manager:", error);
        toast.error("Failed to remove manager assignment");
      }
    },
    [managers]
  );

  return (
    <div className="space-y-8">
      {/* 1 — Coverage health: the operational alarm */}
      <CoverageOverview
        totalLocations={locations.length}
        covered={stats.covered}
        muted={stats.muted}
        gaps={stats.gaps}
        totalManagers={managers.length}
        onFixCoverage={() =>
          coverageRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        }
      />

      {/* 2 — Coverage by location: who hears about a cancellation, where */}
      <section ref={coverageRef} className="scroll-mt-6 space-y-3">
        <div className="flex items-center gap-2">
          <MapPinned className="h-5 w-5 text-[#1d5337] dark:text-emerald-300" />
          <h2 className="font-accent text-xl font-semibold">
            Coverage by location
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Who gets alerted at each venue. Riskiest locations appear first.
        </p>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl bg-muted/60"
              />
            ))}
          </div>
        ) : (
          <LocationCoverageGrid
            coverage={coverage}
            onAssignToLocation={handleAssignToLocation}
          />
        )}
      </section>

      {/* 3 — Recipients list + assign/edit panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="space-y-3">
          <h2 className="font-accent text-xl font-semibold">
            Current Assignments
          </h2>
          <p className="text-sm text-muted-foreground">
            Every admin receiving venue alerts and the locations they cover.
          </p>
          <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border dark:bg-white/[0.02] sm:p-5">
            <RestaurantManagersTable
              managers={managers}
              loading={loading}
              editingId={editingId}
              onToggleNotifications={handleToggleNotifications}
              onDelete={handleDelete}
            />
          </div>
        </section>

        <motion.section
          ref={assignRef}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="scroll-mt-6 space-y-3 lg:sticky lg:top-6 lg:self-start"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-accent text-xl font-semibold">
              <UserPlus className="h-5 w-5 text-[#1d5337] dark:text-emerald-300" />
              {existingForUser ? "Edit assignment" : "Assign recipient"}
            </h2>
            <EmailPreviewDialog
              emailType="cancellation"
              triggerLabel="Preview cancellation email"
              triggerVariant="ghost"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Assign admins to restaurant locations to receive cancellation and
            approval alerts.
          </p>
          <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border dark:bg-white/[0.02]">
            <RestaurantManagerForm
              adminUsers={adminUsers}
              locations={locations}
              selectedUser={selectedUser}
              selectedLocations={selectedLocations}
              receiveNotifications={receiveNotifications}
              onUserChange={handleUserChange}
              onAddLocation={handleAddLocation}
              onRemoveLocation={handleRemoveLocation}
              onToggleNotifications={setReceiveNotifications}
              onSubmit={handleSubmit}
              loading={submitting}
              isEditingExisting={Boolean(existingForUser)}
            />
          </div>
        </motion.section>
      </div>
    </div>
  );
}
