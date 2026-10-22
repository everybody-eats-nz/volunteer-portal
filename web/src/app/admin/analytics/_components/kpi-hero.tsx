"use client";

import { useTheme } from "next-themes";
import {
  Calendar,
  HandCoins,
  Percent,
  Salad,
  ShoppingBag,
  UserPlus,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import type { RestaurantAnalyticsData } from "@/lib/restaurant-analytics";
import type { RestaurantReports } from "@/lib/restaurant-reports";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DeltaBadge, Sparkline } from "./primitives";
import {
  chartModeFrom,
  chartTokens,
  nzd,
  num,
  type ChartTokens,
} from "../_lib/chart-theme";

function PrimaryCard({
  icon: Icon,
  label,
  value,
  accent,
  tint,
  spark,
  sparkColor,
  tokens,
  footer,
  tooltip,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
  tint: string;
  spark: number[];
  sparkColor: string;
  tokens: ChartTokens;
  footer?: React.ReactNode;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative flex h-full cursor-help flex-col overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
          <div
            className={cn(
              "pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.08] blur-2xl",
              tint
            )}
          />
          <div className="flex items-center gap-2 text-muted-foreground">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg bg-muted/60",
                accent
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide">
              {label}
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold leading-none tracking-tight tabular-nums">
            {value}
          </p>
          <div className="mt-2 min-h-5">{footer}</div>
          <div className="-mx-1 mt-2">
            <Sparkline data={spark} color={sparkColor} tokens={tokens} />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-60">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  accent,
  sub,
  tooltip,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
  sub?: string;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-full cursor-help items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60",
              accent
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="text-lg font-bold leading-tight tabular-nums">
              {value}
              {sub && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {sub}
                </span>
              )}
            </p>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-60">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function KpiHero({
  data,
  reports,
  rangeLabel,
}: {
  data: RestaurantAnalyticsData;
  reports: RestaurantReports;
  rangeLabel: string;
}) {
  const { resolvedTheme } = useTheme();
  const tokens = chartTokens(chartModeFrom(resolvedTheme));
  const s = data.serviceStats;
  const m = reports.monthly;

  const primaries = [
    {
      icon: UtensilsCrossed,
      label: "Guests served",
      value: num(data.summary.totalMeals),
      accent: "text-emerald-600 dark:text-emerald-400",
      tint: "bg-emerald-500",
      spark: m.customers,
      sparkColor: tokens.palette.guests,
      footer: (
        <DeltaBadge
          percent={data.summary.yoyChangePercent}
          base={data.summary.prevYearTotalMeals}
        />
      ),
      tooltip: `Total guests served in the ${rangeLabel}, from recorded service-night counts.`,
    },
    {
      icon: HandCoins,
      label: "Total koha",
      value: nzd(s.totalKoha),
      accent: "text-amber-600 dark:text-amber-400",
      tint: "bg-amber-500",
      spark: m.koha,
      sparkColor: tokens.palette.koha,
      footer: (
        <div className="flex flex-wrap items-center gap-1.5">
          <DeltaBadge percent={s.kohaYoyPercent} base={s.prevTotalKoha} />
          {s.kohaTargetPercent !== null && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                s.kohaTargetPercent >= 100
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {s.kohaTargetPercent}% of target
            </span>
          )}
        </div>
      ),
      tooltip:
        "Total koha collected (cash + eftpos + Stripe) across recorded service nights, with progress against each night's koha target (from the year's budget, or the location's per-night target).",
    },
    {
      icon: Wallet,
      label: "Koha / head",
      value: s.perHead === null ? "—" : nzd(s.perHead, 2),
      accent: "text-amber-600 dark:text-amber-400",
      tint: "bg-amber-500",
      spark: m.perHead.map((v) => v ?? 0),
      sparkColor: tokens.palette.koha,
      footer: (
        <span className="text-xs text-muted-foreground">
          {s.perPaying === null
            ? "per guest served"
            : `${nzd(s.perPaying, 2)} per paying guest`}
        </span>
      ),
      tooltip:
        "Average koha per guest on nights where koha was recorded. Footer shows koha per paying guest (excluding non-paying).",
    },
    {
      icon: UserPlus,
      label: "New volunteers",
      value: num(s.newVolunteers),
      accent: "text-violet-600 dark:text-violet-400",
      tint: "bg-violet-500",
      spark: m.newVolunteers,
      sparkColor: tokens.palette.volunteers,
      footer: (
        <span className="text-xs text-muted-foreground">
          first-time volunteers
        </span>
      ),
      tooltip:
        "First-time volunteers across the period (their first confirmed shift fell in this window).",
    },
  ];

  const chips = [
    {
      icon: Calendar,
      label: "Avg / day",
      value: num(data.summary.avgPerDay),
      accent: "text-sky-600 dark:text-sky-400",
      sub: `${num(data.summary.daysWithShifts)} days`,
      tooltip:
        "Average guests served per operational day. 'Days' counts service nights with records.",
    },
    {
      icon: Percent,
      label: "Non-paying",
      value: s.nonPayingPercent === null ? "—" : `${s.nonPayingPercent}%`,
      accent: "text-rose-600 dark:text-rose-400",
      sub: `${num(s.nonPayingCount)} guests`,
      tooltip:
        "Share of recorded guests who didn't contribute koha (non-paying ÷ guests served).",
    },
    {
      icon: ShoppingBag,
      label: "Takeaways",
      value: num(s.takeaways),
      accent: "text-violet-600 dark:text-violet-400",
      tooltip: "Total takeaway meals across recorded service nights.",
    },
    {
      icon: Salad,
      label: "Vege meals",
      value: num(s.vege),
      accent: "text-green-600 dark:text-green-400",
      tooltip: "Total vegetarian meals across recorded service nights.",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {primaries.map((p) => (
          <PrimaryCard key={p.label} {...p} tokens={tokens} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {chips.map((c) => (
          <StatChip key={c.label} {...c} />
        ))}
      </div>
      {!data.hasServiceStats && (
        <p className="text-xs text-muted-foreground">
          Koha, volunteer and service-mix figures come from recorded service
          nights — none found for this period yet.
        </p>
      )}
    </div>
  );
}
