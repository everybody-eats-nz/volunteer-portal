"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Loader2, MapPin, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { budgetYearLabel, budgetYearSpan } from "@/lib/budget-calculations";
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

  const navigate = (next: { location?: string; year?: number }) => {
    const params = new URLSearchParams({
      location: next.location ?? location,
      year: String(next.year ?? data.year),
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
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,16rem)_minmax(0,10rem)]">
          <div className="space-y-1.5">
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
            <Label
              htmlFor="budget-year"
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Financial year
            </Label>
            <Select
              value={String(data.year)}
              onValueChange={(v) => navigate({ year: Number(v) })}
            >
              <SelectTrigger
                id="budget-year"
                className="w-full"
                data-testid="budget-year-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {budgetYearLabel(y)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:pb-2.5">
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {budgetYearSpan(data.year)} · koha = cash + EFTPOS + Stripe
        </p>
      </div>

      <div
        className={cn(
          "transition-opacity",
          isPending && "pointer-events-none opacity-50"
        )}
      >
        {data.selected ? (
          <LocationBudgetView
            key={`${data.selected.location}-${data.year}`}
            data={data}
            selected={data.selected}
            tokens={tokens}
            onEditBudget={() => editBudget(data.selected!)}
          />
        ) : (
          <NetworkBudgetView
            key={data.year}
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
