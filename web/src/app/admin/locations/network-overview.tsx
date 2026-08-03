"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Archive, CalendarClock, Eye, EyeOff, Tent, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

import type { Venue } from "./types";

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
            "relative overflow-hidden rounded-2xl border p-5 sm:p-6",
            healthy
              ? "border-[#1d5337]/15 bg-gradient-to-br from-[#1d5337] to-[#2e6438] text-white"
              : "border-amber-300/50 bg-gradient-to-br from-amber-50 to-yellow-50 dark:border-amber-300/25 dark:from-amber-950/30 dark:to-yellow-950/20"
          )}
        >
          {healthy && (
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[#f8fb69]/20 blur-2xl"
            />
          )}
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                  healthy
                    ? "bg-white/15 text-[#f8fb69]"
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

type Tone = "forest" | "amber" | "sun" | "neutral";

const TONE_STYLES: Record<
  Tone,
  { ring: string; iconWrap: string; value: string }
> = {
  forest: {
    ring: "ring-[#1d5337]/12",
    iconWrap:
      "bg-[#1d5337]/10 text-[#1d5337] dark:bg-emerald-400/15 dark:text-emerald-300",
    value: "text-[#1d5337] dark:text-emerald-200",
  },
  amber: {
    ring: "ring-amber-400/30",
    iconWrap: "bg-amber-400/15 text-amber-600 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-400",
  },
  sun: {
    ring: "ring-[#d3d84a]/50 dark:ring-[#f8fb69]/20",
    iconWrap: "bg-[#f8fb69]/60 text-[#4a4d20] dark:bg-[#f8fb69]/15 dark:text-[#f8fb69]",
    value: "text-foreground",
  },
  neutral: {
    ring: "ring-border",
    iconWrap: "bg-muted text-muted-foreground",
    value: "text-foreground",
  },
};

function KpiTile({
  icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  tone: Tone;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-2xl bg-card p-4 shadow-sm ring-1 dark:bg-white/[0.02]",
        styles.ring
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            styles.iconWrap
          )}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span
          className={cn(
            "font-accent text-3xl font-semibold tabular-nums leading-none",
            styles.value
          )}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-sm font-medium text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </motion.div>
  );
}
