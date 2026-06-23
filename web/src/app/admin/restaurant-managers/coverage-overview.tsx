"use client";

import { motion } from "motion/react";
import { AlertTriangle, BellOff, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

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
          "relative overflow-hidden rounded-2xl border p-5 sm:p-6",
          healthy &&
            "border-[#1d5337]/15 bg-gradient-to-br from-[#1d5337] to-[#2e6438] text-white",
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
            className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[#f8fb69]/20 blur-2xl"
          />
        )}
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                healthy && "bg-white/15 text-[#f8fb69]",
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

type Tone = "forest" | "amber" | "rose" | "neutral";

const TONE_STYLES: Record<
  Tone,
  { ring: string; iconWrap: string; value: string }
> = {
  forest: {
    ring: "ring-[#1d5337]/12",
    iconWrap: "bg-[#1d5337]/10 text-[#1d5337] dark:bg-emerald-400/15 dark:text-emerald-300",
    value: "text-[#1d5337] dark:text-emerald-200",
  },
  amber: {
    ring: "ring-amber-400/30",
    iconWrap: "bg-amber-400/15 text-amber-600 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-400",
  },
  rose: {
    ring: "ring-destructive/25",
    iconWrap: "bg-destructive/12 text-destructive",
    value: "text-destructive",
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
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg",
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
