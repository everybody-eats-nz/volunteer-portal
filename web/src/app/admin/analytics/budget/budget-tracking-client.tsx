"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Loader2, MapPin, CalendarRange, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  budgetPeriodSearchParams,
  switchBudgetPeriod,
  type BudgetPeriod,
} from "@/lib/budget-periods";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  BudgetTrackingData,
  LocationBudgetSummary,
} from "@/lib/budget-tracking";
import { chartTokens } from "../_lib/chart-theme";
import { BudgetFormDialog, type BudgetFormTarget } from "./budget-form-dialog";
import { LocationBudgetView } from "./location-budget-view";
import { NetworkBudgetView } from "./network-budget-view";
import {
  PERIOD_CONTROL_LABEL,
  PeriodKindControl,
  PeriodValueControl,
} from "./budget-period-picker";
import { RangeLocationView, RangeNetworkView } from "./range-budget-views";

const ALL = "all";

export function BudgetTrackingClient({
  data,
  location,
}: {
  data: BudgetTrackingData;
  /** Selected location name, or "all". */
  location: string;
}) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [isPending, startTransition] = useTransition();
  const [formTarget, setFormTarget] = useState<BudgetFormTarget | null>(null);

  const tokens = useMemo(
    () => chartTokens(resolvedTheme === "dark" ? "dark" : "light"),
    [resolvedTheme]
  );

  const { period } = data;
  const isYear = period.kind === "year";

  const navigate = (next: { location?: string; period?: BudgetPeriod }) => {
    const params = new URLSearchParams({
      location: next.location ?? location,
      ...budgetPeriodSearchParams(next.period ?? period),
    });
    startTransition(() => {
      router.push(`/admin/analytics/budget?${params}`, { scroll: false });
    });
  };

  const editBudget = (summary: LocationBudgetSummary) =>
    setFormTarget({
      locationId: summary.locationId,
      location: summary.location,
      year: data.year,
      budget: summary.budget,
    });

  return (
    <div className="space-y-4 pb-12">
      {/* Wraps by its own width, not the viewport: the admin sidebar takes a
          variable share of the screen. */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="w-full space-y-1.5 sm:w-56">
            <Label
              htmlFor="budget-location"
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <MapPin className="h-3.5 w-3.5" />
              Restaurant
            </Label>
            <Select
              value={location}
              onValueChange={(v) => navigate({ location: v })}
            >
              <SelectTrigger
                id="budget-location"
                className="w-full"
                data-testid="budget-location-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All restaurants</SelectItem>
                {data.locations.map((l) => (
                  <SelectItem key={l.locationId} value={l.location}>
                    {l.location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Period
            </p>
            <PeriodKindControl
              period={period}
              today={data.today}
              onChange={(next) => navigate({ period: next })}
            />
          </div>
          <div className="min-w-60 flex-1 space-y-1.5 sm:max-w-72">
            <Label
              htmlFor="budget-period-value"
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <CalendarRange className="h-3.5 w-3.5" />
              {PERIOD_CONTROL_LABEL[period.kind]}
            </Label>
            <PeriodValueControl
              id="budget-period-value"
              period={period}
              years={data.years}
              today={data.today}
              onChange={(next) => navigate({ period: next })}
            />
          </div>
        <p className="ml-auto flex items-center gap-1.5 pb-2.5 text-xs text-muted-foreground">
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {(period.kind === "year" || period.kind === "month") &&
            `${period.span} · `}
          koha = cash + EFTPOS + Stripe
        </p>
      </div>

      <div
        className={cn(
          "transition-opacity",
          isPending && "pointer-events-none opacity-50"
        )}
      >
        {data.selected ? (
          isYear ? (
            <LocationBudgetView
              key={`${data.selected.location}-${data.year}`}
              data={data}
              selected={data.selected}
              tokens={tokens}
              onEditBudget={() => editBudget(data.selected!)}
            />
          ) : (
            <RangeLocationView
              key={`${data.selected.location}-${period.start}-${period.end}`}
              data={data}
              selected={data.selected}
              tokens={tokens}
              onEditBudget={() => editBudget(data.selected!)}
              onShowYear={() =>
                navigate({ period: switchBudgetPeriod(period, "year", data.today) })
              }
            />
          )
        ) : isYear ? (
          <NetworkBudgetView
            key={data.year}
            data={data}
            onOpenLocation={(name) => navigate({ location: name })}
            onEditBudget={editBudget}
          />
        ) : (
          <RangeNetworkView
            key={`${period.start}-${period.end}`}
            data={data}
            onOpenLocation={(name) => navigate({ location: name })}
            onEditBudget={editBudget}
          />
        )}
      </div>

      <BudgetFormDialog
        target={formTarget}
        onOpenChange={(open) => {
          if (!open) setFormTarget(null);
        }}
      />
    </div>
  );
}
