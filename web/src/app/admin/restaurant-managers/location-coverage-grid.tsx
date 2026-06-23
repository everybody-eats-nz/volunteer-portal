"use client";

import { motion } from "motion/react";
import { Bell, BellOff, MapPin, Plus, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

import type { LocationCoverage, RestaurantManager } from "./types";
import { getInitials, getUserDisplayName } from "./types";

interface LocationCoverageGridProps {
  coverage: LocationCoverage[];
  onAssignToLocation: (location: string) => void;
}

const STATUS_META = {
  active: {
    label: "Covered",
    bar: "bg-[#1d5337]",
    pill: "bg-[#1d5337]/10 text-[#1d5337] dark:bg-emerald-400/15 dark:text-emerald-200",
    dot: "bg-[#1d5337]",
  },
  muted: {
    label: "Muted",
    bar: "bg-amber-500",
    pill: "bg-amber-400/20 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  gap: {
    label: "No coverage",
    bar: "bg-destructive",
    pill: "bg-destructive/12 text-destructive",
    dot: "bg-destructive",
  },
} as const;

export function LocationCoverageGrid({
  coverage,
  onAssignToLocation,
}: LocationCoverageGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {coverage.map((item, index) => (
        <LocationCard
          key={item.location}
          item={item}
          index={index}
          onAssign={() => onAssignToLocation(item.location)}
        />
      ))}
    </div>
  );
}

function LocationCard({
  item,
  index,
  onAssign,
}: {
  item: LocationCoverage;
  index: number;
  onAssign: () => void;
}) {
  const meta = STATUS_META[item.status];
  const isGap = item.status === "gap";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 transition-shadow hover:shadow-md dark:bg-white/[0.02]",
        isGap ? "ring-destructive/25" : "ring-border"
      )}
    >
      {/* Status spine */}
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1", meta.bar)}
      />

      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4 pl-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h3 className="truncate font-accent text-base font-semibold">
              {item.location}
            </h3>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            meta.pill
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
          {meta.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-5 pb-4 pl-6">
        {isGap ? (
          <div className="flex flex-1 flex-col items-start gap-3 rounded-xl border border-dashed border-destructive/25 bg-destructive/[0.03] px-4 py-4">
            <p className="text-sm text-muted-foreground">
              Cancellations &amp; approval requests here alert{" "}
              <span className="font-semibold text-destructive">no one</span>.
            </p>
            <button
              type="button"
              onClick={onAssign}
              className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-destructive/90"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Assign a recipient
            </button>
          </div>
        ) : (
          <>
            <ul className="space-y-1.5">
              {item.activeRecipients.map((m) => (
                <RecipientRow key={m.id} manager={m} active />
              ))}
              {item.mutedRecipients.map((m) => (
                <RecipientRow key={m.id} manager={m} active={false} />
              ))}
            </ul>
            <button
              type="button"
              onClick={onAssign}
              className="mt-auto inline-flex items-center gap-1.5 self-start rounded-full px-2 py-1 text-xs font-semibold text-[#1d5337] opacity-70 transition-opacity hover:opacity-100 dark:text-emerald-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add recipient
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

function RecipientRow({
  manager,
  active,
}: {
  manager: RestaurantManager;
  active: boolean;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
          active
            ? "bg-[#1d5337]/10 text-[#1d5337] dark:bg-emerald-400/15 dark:text-emerald-200"
            : "bg-muted text-muted-foreground"
        )}
      >
        {getInitials(manager.user)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {getUserDisplayName(manager.user)}
      </span>
      {active ? (
        <Bell className="h-3.5 w-3.5 shrink-0 text-[#1d5337] dark:text-emerald-400" />
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          <BellOff className="h-3.5 w-3.5" />
          muted
        </span>
      )}
    </li>
  );
}
