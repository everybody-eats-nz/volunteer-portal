"use client";

import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Narrowing, and what you have narrowed to.
 *
 * The old strip of selects gave no answer to "what am I actually looking at" —
 * a value chosen two minutes ago sat inside a control that looked identical to
 * an empty one. Every active choice is now restated as a chip you can drop, so
 * the figures above can never be read as the month's totals by mistake.
 */

export interface TripFilterOptions {
  vehicles: Array<{ id: string; name: string; rego: string }>;
  drivers: Array<{ id: string; name: string }>;
  purposes: Array<{ id: string; label: string; isActive: boolean }>;
  orgLabels: string[];
}

export interface TripFilters {
  query: string;
  vehicleId: string;
  orgLabel: string;
  purposeId: string;
  driverId: string;
}

export const EMPTY_FILTERS: TripFilters = {
  query: "",
  vehicleId: "",
  orgLabel: "",
  purposeId: "",
  driverId: "",
};

const FIELD =
  "h-9 rounded-lg border border-input bg-background px-2.5 text-[13px] outline-none transition-colors hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function TripFilterBar({
  filters,
  onChange,
  options,
}: {
  filters: TripFilters;
  onChange: (filters: TripFilters) => void;
  options: TripFilterOptions;
}) {
  const set = (patch: Partial<TripFilters>) => onChange({ ...filters, ...patch });

  const chips = [
    filters.query && {
      key: "query",
      label: `“${filters.query}”`,
      clear: () => set({ query: "" }),
    },
    filters.vehicleId && {
      key: "vehicle",
      label:
        options.vehicles.find((v) => v.id === filters.vehicleId)?.name ?? "Van",
      clear: () => set({ vehicleId: "" }),
    },
    filters.orgLabel && {
      key: "org",
      label: filters.orgLabel,
      clear: () => set({ orgLabel: "" }),
    },
    filters.purposeId && {
      key: "purpose",
      label:
        options.purposes.find((p) => p.id === filters.purposeId)?.label ??
        "Purpose",
      clear: () => set({ purposeId: "" }),
    },
    filters.driverId && {
      key: "driver",
      label:
        options.drivers.find((d) => d.id === filters.driverId)?.name ?? "Driver",
      clear: () => set({ driverId: "" }),
    },
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;

  return (
    <div className="space-y-2.5" data-testid="van-trips-filters">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[13rem] flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            aria-label="Search trips"
            placeholder="Driver, van, rego or note"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            data-testid="van-trips-search"
            className={cn(FIELD, "w-full pl-8")}
          />
        </div>

        <Facet
          label="Filter by van"
          empty="All vans"
          value={filters.vehicleId}
          onChange={(vehicleId) => set({ vehicleId })}
          testid="van-trips-filter-vehicle"
          options={options.vehicles.map((v) => ({ value: v.id, label: v.name }))}
        />
        <Facet
          label="Filter by organisation"
          empty="All organisations"
          value={filters.orgLabel}
          onChange={(orgLabel) => set({ orgLabel })}
          options={options.orgLabels.map((label) => ({ value: label, label }))}
        />
        <Facet
          label="Filter by purpose"
          empty="All purposes"
          value={filters.purposeId}
          onChange={(purposeId) => set({ purposeId })}
          options={options.purposes.map((p) => ({
            value: p.id,
            label: p.isActive ? p.label : `${p.label} (retired)`,
          }))}
        />
        <Facet
          label="Filter by driver"
          empty="All drivers"
          value={filters.driverId}
          onChange={(driverId) => set({ driverId })}
          options={options.drivers.map((d) => ({ value: d.id, label: d.name }))}
        />
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] text-muted-foreground">Showing only</span>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="group inline-flex max-w-[14rem] items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary/20 dark:text-forest-100"
            >
              <span className="truncate">{chip.label}</span>
              <X className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden />
              <span className="sr-only">Remove this filter</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="ml-1 rounded-lg px-2 py-1 text-[13px] font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function Facet({
  label,
  empty,
  value,
  onChange,
  options,
  testid,
}: {
  label: string;
  empty: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  testid?: string;
}) {
  return (
    <select
      className={cn(FIELD, value && "border-primary/50 bg-primary/5 font-medium")}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testid}
    >
      <option value="">{empty}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
