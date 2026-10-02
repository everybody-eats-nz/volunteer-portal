"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, UserCog, UserPlus, X } from "lucide-react";

import type { ManagerUser, Location } from "./types";
import { getUserDisplayName, getInitials } from "./types";

interface RestaurantManagerFormProps {
  adminUsers: ManagerUser[];
  locations: Location[];
  selectedUser: string;
  selectedLocations: string[];
  receiveNotifications: boolean;
  onUserChange: (userId: string) => void;
  onAddLocation: (location: string) => void;
  onRemoveLocation: (location: string) => void;
  onToggleNotifications: (value: boolean) => void;
  onSubmit: () => void;
  loading: boolean;
  isEditingExisting: boolean;
}

export default function RestaurantManagerForm({
  adminUsers,
  locations,
  selectedUser,
  selectedLocations,
  receiveNotifications,
  onUserChange,
  onAddLocation,
  onRemoveLocation,
  onToggleNotifications,
  onSubmit,
  loading,
  isEditingExisting,
}: RestaurantManagerFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const selected = adminUsers.find((u) => u.id === selectedUser);

  if (adminUsers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-background px-4 py-8 text-center text-sm text-muted-foreground">
        No admin users are available to assign as recipients.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Admin selection */}
      <div className="space-y-2">
        <Label
          htmlFor="user-select"
          data-testid="admin-user-label"
          className="text-xs font-semibold uppercase tracking-wide text-primary-text/70"
        >
          Admin recipient
        </Label>
        <Select value={selectedUser} onValueChange={onUserChange}>
          <SelectTrigger data-testid="user-select" className="h-auto py-2.5">
            <SelectValue placeholder="Select an admin user..." />
          </SelectTrigger>
          <SelectContent>
            {adminUsers.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-light text-[11px] font-semibold text-primary-text">
                    {getInitials(user)}
                  </span>
                  <span className="flex flex-col text-left">
                    <span className="font-medium leading-tight">
                      {getUserDisplayName(user)}
                    </span>
                    <span className="text-xs text-muted-foreground leading-tight">
                      {user.email}
                    </span>
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isEditingExisting && selected && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <UserCog className="h-3.5 w-3.5" />
            {getUserDisplayName(selected)} already has an assignment — saving will
            update it.
          </p>
        )}
      </div>

      {/* Location selection */}
      <div className="space-y-2">
        <Label
          data-testid="restaurant-locations-label"
          className="text-xs font-semibold uppercase tracking-wide text-primary-text/70"
        >
          Locations covered
        </Label>
        <Select value="" onValueChange={onAddLocation}>
          <SelectTrigger data-testid="location-select">
            <SelectValue placeholder="Add a location…" />
          </SelectTrigger>
          <SelectContent>
            {locations.filter((l) => !selectedLocations.includes(l.value))
              .length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                All locations added
              </div>
            ) : (
              locations
                .filter((location) => !selectedLocations.includes(location.value))
                .map((location) => (
                  <SelectItem key={location.value} value={location.value}>
                    <span className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-primary-text/60" />
                      {location.label}
                    </span>
                  </SelectItem>
                ))
            )}
          </SelectContent>
        </Select>

        {selectedLocations.length > 0 ? (
          <div
            className="flex flex-wrap gap-2 rounded-xl border bg-primary-light/60 p-3"
            data-testid="selected-locations"
          >
            {selectedLocations.map((location) => (
              <span
                key={location}
                className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-sm font-medium text-primary-text shadow-sm ring-1 ring-border"
              >
                <MapPin className="h-3 w-3 opacity-70" />
                {location}
                <button
                  type="button"
                  onClick={() => onRemoveLocation(location)}
                  className="ml-0.5 rounded-full p-0.5 text-primary-text/50 transition-colors hover:bg-destructive/15 hover:text-destructive"
                  data-testid={`remove-location-${location}`}
                  aria-label={`Remove ${location}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Pick every restaurant this person should be alerted about.
          </p>
        )}
      </div>

      {/* Notification preference */}
      <label
        htmlFor="notifications"
        className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card px-3.5 py-3 transition-colors hover:border-primary-text/25"
      >
        <Checkbox
          id="notifications"
          checked={receiveNotifications}
          onCheckedChange={(checked) => onToggleNotifications(checked === true)}
          data-testid="notifications-checkbox"
          className="mt-0.5"
        />
        <span className="space-y-0.5">
          <span className="block text-sm font-medium leading-tight">
            Send venue alerts to this person
          </span>
          <span className="block text-xs text-muted-foreground leading-snug">
            Cancellation emails and in-app approval requests. When off, they stay
            linked to the location but aren&apos;t notified.
          </span>
        </span>
      </label>

      <Button
        type="submit"
        disabled={loading || !selectedUser || selectedLocations.length === 0}
        data-testid="assign-manager-button"
        className="w-full gap-2"
      >
        {isEditingExisting ? (
          <UserCog className="h-4 w-4" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        {loading
          ? "Saving…"
          : isEditingExisting
            ? "Update assignment"
            : "Assign recipient"}
      </Button>
    </form>
  );
}
