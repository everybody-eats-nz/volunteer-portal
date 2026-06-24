"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MapPin, Trash2, Users } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import type { RestaurantManager } from "./types";
import { getInitials, getUserDisplayName } from "./types";

interface RestaurantManagersTableProps {
  managers: RestaurantManager[];
  loading: boolean;
  editingId: string | null;
  onToggleNotifications: (managerId: string, currentState: boolean) => void;
  onDelete: (managerId: string) => void;
}

export default function RestaurantManagersTable({
  managers,
  loading,
  editingId,
  onToggleNotifications,
  onDelete,
}: RestaurantManagersTableProps) {
  if (loading) {
    return (
      <div className="space-y-2" data-testid="loading-managers">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl bg-muted/60"
          />
        ))}
      </div>
    );
  }

  if (managers.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#1d5337]/20 bg-[#fdf8ef] px-6 py-12 text-center dark:border-white/10 dark:bg-white/[0.02]"
        data-testid="empty-managers-state"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1d5337]/10 text-[#1d5337] dark:bg-emerald-400/15 dark:text-emerald-200">
          <Users className="h-5 w-5" />
        </span>
        <p className="font-medium">No recipients yet</p>
        <p className="text-sm text-muted-foreground">
          Use the panel to assign your first manager.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="managers-table" className="overflow-hidden">
      {/* Column header row — carries the e2e testids in a clean list header */}
      <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto_auto] items-center gap-4 border-b px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
        <span data-testid="manager-column-header">Recipient</span>
        <span data-testid="locations-column-header">Locations</span>
        <span data-testid="notifications-column-header" className="text-center">
          Alerts
        </span>
        <span data-testid="actions-column-header" className="sr-only">
          Actions
        </span>
      </div>

      <ul className="divide-y">
        {managers.map((manager) => {
          const muted = !manager.receiveNotifications;
          return (
            <li
              key={manager.id}
              className="grid grid-cols-1 items-center gap-3 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto_auto] sm:gap-4 sm:px-3"
            >
              {/* Recipient */}
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    muted
                      ? "bg-muted text-muted-foreground"
                      : "bg-[#1d5337]/10 text-[#1d5337] dark:bg-emerald-400/15 dark:text-emerald-200"
                  )}
                >
                  {getInitials(manager.user)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {getUserDisplayName(manager.user)}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {manager.user.email}
                  </div>
                </div>
              </div>

              {/* Locations */}
              <div className="flex flex-wrap gap-1.5">
                {manager.locations.length > 0 ? (
                  manager.locations.map((location) => (
                    <span
                      key={location}
                      className="inline-flex items-center gap-1 rounded-full bg-[#eef4ef] px-2 py-0.5 text-xs font-medium text-[#1d5337] dark:bg-white/10 dark:text-emerald-100"
                    >
                      <MapPin className="h-3 w-3 opacity-60" />
                      {location}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    No locations
                  </span>
                )}
              </div>

              {/* Notifications */}
              <div className="flex items-center gap-2 sm:justify-center">
                <Switch
                  checked={manager.receiveNotifications}
                  disabled={editingId === manager.id}
                  onCheckedChange={() =>
                    onToggleNotifications(
                      manager.id,
                      manager.receiveNotifications
                    )
                  }
                  data-testid={`notification-toggle-${manager.id}`}
                  className="data-[state=checked]:bg-[#1d5337]"
                  aria-label={`Toggle venue alerts for ${getUserDisplayName(manager.user)}`}
                />
                <span
                  className={cn(
                    "text-xs font-medium sm:hidden",
                    muted ? "text-muted-foreground" : "text-[#1d5337]"
                  )}
                >
                  {muted ? "Muted" : "On"}
                </span>
              </div>

              {/* Actions */}
              <div className="flex justify-end sm:justify-center">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      data-testid={`delete-manager-${manager.id}`}
                      aria-label={`Remove ${getUserDisplayName(manager.user)}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Remove Manager Assignment
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove{" "}
                        {getUserDisplayName(manager.user)} as a restaurant
                        manager? They will no longer be alerted to cancellations
                        or signups awaiting approval at any location.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="cancel-delete-button">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(manager.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Remove Assignment
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
