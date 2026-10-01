"use client";

import { motion } from "motion/react";
import { AlertTriangle, BellOff, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiTile } from "@/components/admin/kpi-tile";

interface CoverageOverviewProps {
  totalLocations: number;
  covered: number;
  muted: number;
  gaps: number;
  totalManagers: number;
  onFixCoverage: () => void;
}

export function CoverageOverview({
  totalLocations,
  covered,
  muted,
  gaps,
  totalManagers,
  onFixCoverage,
}: CoverageOverviewProps) {
  const healthy = gaps === 0 && muted === 0;
  const critical = gaps > 0;

  return (
    <div className="space-y-4">
      {/* Status banner — the single most important read on the page */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "relative overflow-hidden rounded-xl border p-5 shadow-sm sm:p-6",
          healthy &&
            "border-forest-500 bg-gradient-to-br from-forest-500 to-forest-400 text-white",
          !healthy &&
            critical &&
            "border-destructive/25 bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/40 dark:to-red-950/30",
          !healthy &&
            !critical &&
            "border-amber-300/50 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20"
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
                healthy && "bg-white/15 text-sun-200",
                !healthy && critical && "bg-destructive/15 text-destructive",
                !healthy &&
                  !critical &&
                  "bg-amber-400/20 text-amber-600 dark:text-amber-400"
              )}
            >
              {healthy ? (
                <ShieldCheck className="h-6 w-6" />
              ) : (
                <AlertTriangle className="h-6 w-6" />
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
                  ? "Every location is covered"
                  : critical
                    ? `${gaps} ${gaps === 1 ? "location has" : "locations have"} no one receiving alerts`
                    : `${muted} ${muted === 1 ? "location is" : "locations are"} covered but muted`}
              </h2>
              <p
                className={cn(
                  "mt-0.5 text-sm",
                  healthy ? "text-white/80" : "text-muted-foreground"
                )}
              >
                {healthy
                  ? "Cancellations and signups awaiting approval will always reach at least one manager."
                  : critical
                    ? "Cancellations and approval requests at these venues currently reach nobody. Assign a recipient to close the gap."
                    : "Managers are linked to these venues but their alerts are switched off."}
              </p>
            </div>
          </div>

          {!healthy && (
            <button
              type="button"
              onClick={onFixCoverage}
              className={cn(
                "shrink-0 self-start rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-colors sm:self-center",
                critical
                  ? "bg-destructive text-white hover:bg-destructive/90"
                  : "bg-amber-500 text-white hover:bg-amber-600"
              )}
            >
              Review coverage
            </button>
          )}
        </div>
      </motion.div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Covered"
          value={covered}
          suffix={`/ ${totalLocations}`}
          tone="forest"
        />
        <KpiTile
          icon={<BellOff className="h-4 w-4" />}
          label="Muted"
          value={muted}
          tone={muted > 0 ? "amber" : "neutral"}
        />
        <KpiTile
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Coverage gaps"
          value={gaps}
          tone={gaps > 0 ? "rose" : "neutral"}
        />
        <KpiTile
          icon={<Users className="h-4 w-4" />}
          label="Recipients"
          value={totalManagers}
          tone="neutral"
        />
      </div>
    </div>
  );
}
