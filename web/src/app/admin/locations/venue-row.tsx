"use client";

import { motion } from "motion/react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  BellOff,
  CalendarDays,
  MapPin,
  MoreHorizontal,
  Pencil,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatInNZT } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { formatKoha, type Venue } from "./types";

const MAX_MANAGER_AVATARS = 4;

interface VenueRowProps {
  venue: Venue;
  index: number;
  onEdit: (venue: Venue) => void;
  onDisable: (venue: Venue) => void;
}

export function VenueRow({ venue, index, onEdit, onDisable }: VenueRowProps) {
  const isLive = venue.upcomingShifts > 0;

  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
      data-testid={`venue-row-${venue.id}`}
      className="group relative list-none overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border transition-shadow hover:shadow-md dark:bg-white/[0.02]"
    >
      {/* Status spine */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          isLive ? "bg-[#1d5337]" : "bg-amber-500"
        )}
      />

      <div className="flex flex-col gap-4 p-5 pl-6 lg:flex-row lg:items-center lg:gap-6">
        {/* Identity */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h3 className="font-accent text-lg font-semibold leading-tight">
              {venue.name}
            </h3>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                isLive
                  ? "bg-[#1d5337]/10 text-[#1d5337] dark:bg-emerald-400/15 dark:text-emerald-200"
                  : "bg-amber-400/20 text-amber-700 dark:text-amber-300"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isLive ? "bg-[#1d5337] dark:bg-emerald-300" : "bg-amber-500"
                )}
              />
              {isLive ? "Open to volunteers" : "Awaiting shifts"}
            </span>
            {venue.isPopup && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-[#f8fb69]/60 px-2.5 py-0.5 text-xs font-semibold text-[#4a4d20] dark:bg-[#f8fb69]/15 dark:text-[#f8fb69]">
                Pop-up
              </span>
            )}
          </div>

          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{venue.address}</span>
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Alerts
            </span>
            {venue.managers.length > 0 ? (
              <span className="flex items-center -space-x-1.5">
                {venue.managers.slice(0, MAX_MANAGER_AVATARS).map((manager) => (
                  <Tooltip key={manager.id}>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-card",
                          manager.muted
                            ? "bg-muted text-muted-foreground"
                            : "bg-[#1d5337]/10 text-[#1d5337] dark:bg-emerald-400/20 dark:text-emerald-200"
                        )}
                      >
                        {manager.initials}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="flex items-center gap-1.5">
                      {manager.name}
                      {manager.muted && (
                        <span className="inline-flex items-center gap-1 text-amber-500">
                          <BellOff className="h-3 w-3" /> muted
                        </span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
                {venue.managers.length > MAX_MANAGER_AVATARS && (
                  <span className="flex h-6 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
                    +{venue.managers.length - MAX_MANAGER_AVATARS}
                  </span>
                )}
              </span>
            ) : (
              <Link
                href="/admin/restaurant-managers"
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 underline-offset-2 hover:underline dark:text-amber-400"
              >
                <UserPlus className="h-3.5 w-3.5" />
                No manager receives alerts — assign one
              </Link>
            )}
          </div>
        </div>

        {/* Service figures */}
        <dl className="grid shrink-0 grid-cols-3 gap-4 border-border/60 lg:w-80 lg:border-l lg:pl-6 xl:w-88">
          <Figure
            label="Services"
            value={String(venue.upcomingShifts)}
            sub={
              venue.nextServiceAt
                ? `next ${formatInNZT(venue.nextServiceAt, "EEE d MMM")}`
                : "none scheduled"
            }
            subTone={venue.nextServiceAt ? "neutral" : "amber"}
          />
          <Figure
            label="Meals / night"
            value={String(venue.defaultMealsServed)}
          />
          <Figure
            label="Koha / night"
            value={formatKoha(venue.targetPerNight)}
            sub={venue.targetPerNight === null ? "no target" : undefined}
          />
        </dl>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1 self-start lg:self-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(venue)}
            data-testid={`edit-location-button-${venue.id}`}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`More actions for ${venue.name}`}
                data-testid={`location-actions-${venue.id}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link
                  href={`/admin/shifts?location=${encodeURIComponent(venue.name)}`}
                >
                  <CalendarDays className="h-4 w-4" />
                  View shifts
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onDisable(venue)}
                data-testid={`disable-location-button-${venue.id}`}
              >
                <Archive className="h-4 w-4" />
                Disable location
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.li>
  );
}

function Figure({
  label,
  value,
  sub,
  subTone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: "neutral" | "amber";
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1">
        <span className="font-accent text-2xl font-semibold tabular-nums leading-none">
          {value}
        </span>
        {sub && (
          <span
            className={cn(
              "mt-0.5 block text-xs leading-tight",
              subTone === "amber"
                ? "font-medium text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
            )}
          >
            {sub}
          </span>
        )}
      </dd>
    </div>
  );
}

interface DisabledVenueRowProps {
  venue: Venue;
  onEnable: (venue: Venue) => void;
  enabling: boolean;
}

export function DisabledVenueRow({
  venue,
  onEnable,
  enabling,
}: DisabledVenueRowProps) {
  return (
    <li className="flex flex-col gap-3 rounded-xl bg-muted/40 px-4 py-3 ring-1 ring-border/60 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-accent text-base font-semibold text-muted-foreground">
            {venue.name}
          </span>
          {venue.isPopup && (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              Pop-up
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground/80">
          {venue.address}
        </p>
        {venue.upcomingShifts > 0 && (
          <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            {venue.upcomingShifts} upcoming{" "}
            {venue.upcomingShifts === 1 ? "shift" : "shifts"} still scheduled
            here
          </p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 self-start sm:self-center"
        onClick={() => onEnable(venue)}
        disabled={enabling}
        data-testid={`enable-location-button-${venue.id}`}
      >
        <ArchiveRestore className="h-4 w-4" />
        Restore
      </Button>
    </li>
  );
}
