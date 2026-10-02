"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Archive, CalendarClock, Eye, EyeOff, Tent, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

import type { Venue } from "./types";
import { KpiTile } from "@/components/admin/kpi-tile";

interface NetworkOverviewProps {
  venues: Venue[];
}

function listNames(names: string[]): string {
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  const joined =
    shown.length === 1
      ? shown[0]
      : `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
  return rest > 0 ? `${joined} and ${rest} more` : joined;
}

export function NetworkOverview({ venues }: NetworkOverviewProps) {
  const active = venues.filter((venue) => venue.isActive);
  const hidden = active.filter((venue) => venue.upcomingShifts === 0);
  const visibleCount = active.length - hidden.length;
  const popupCount = active.filter((venue) => venue.isPopup).length;
  const disabledCount = venues.length - active.length;
  const healthy = hidden.length === 0;

  if (active.length === 0 && disabledCount === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Status banner — the single most important read on the page */}
      {active.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "relative overflow-hidden rounded-xl border p-5 shadow-sm sm:p-6",
            healthy
              ? "border-forest-500 bg-gradient-to-br from-forest-500 to-forest-400 text-white"
              : "border-amber-300/50 bg-gradient-to-br from-amber-50 to-yellow-50 dark:border-amber-300/25 dark:from-amber-950/30 dark:to-yellow-950/20"
          )}
        >
          {healthy && (
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-sun-200/20 blur-2xl"
            />
          )}
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                  healthy
                    ? "bg-white/15 text-sun-200"
                    : "bg-amber-400/20 text-amber-600 dark:text-amber-400"
                )}
              >
                {healthy ? (
                  <UtensilsCrossed className="h-6 w-6" />
                ) : (
                  <EyeOff className="h-6 w-6" />
                )}
              </span>
              <div>
                <h2
                  className={cn(
                    "font-accent text-lg font-semibold leading-tight sm:text-xl",
                    healthy ? "text-white" : "text-foreground"
                  )}
                >
                  {healthy
                    ? active.length === 1
                      ? "Your venue is open to volunteers"
                      : `All ${active.length} venues are open to volunteers`
                    : `${hidden.length} ${
                        hidden.length === 1 ? "venue is" : "venues are"
                      } invisible to volunteers`}
                </h2>
                <p
                  className={cn(
                    "mt-0.5 text-sm",
                    healthy ? "text-white/80" : "text-muted-foreground"
                  )}
                >
                  {healthy
                    ? "Every active location has upcoming shifts, so volunteers can browse and book them all."
                    : `A location only appears to volunteers once it has upcoming shifts. Publish shifts at ${listNames(
                        hidden.map((venue) => venue.name)
                      )} to take ${hidden.length === 1 ? "it" : "them"} live.`}
                </p>
              </div>
            </div>

            {!healthy && (
              <Link
                href="/admin/shifts"
                className="shrink-0 self-start rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 sm:self-center"
              >
                Plan shifts
              </Link>
            )}
          </div>
        </motion.div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          icon={<Eye className="h-4 w-4" />}
          label="Open to volunteers"
          value={visibleCount}
          suffix={`/ ${active.length}`}
          tone="forest"
        />
        <KpiTile
          icon={<CalendarClock className="h-4 w-4" />}
          label="Awaiting shifts"
          value={hidden.length}
          tone={hidden.length > 0 ? "amber" : "neutral"}
        />
        <KpiTile
          icon={<Tent className="h-4 w-4" />}
          label="Pop-up venues"
          value={popupCount}
          tone={popupCount > 0 ? "sun" : "neutral"}
        />
        <KpiTile
          icon={<Archive className="h-4 w-4" />}
          label="Disabled"
          value={disabledCount}
          tone="neutral"
        />
      </div>
    </div>
  );
}
