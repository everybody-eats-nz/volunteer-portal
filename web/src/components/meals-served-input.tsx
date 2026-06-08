"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Utensils,
  Save,
  Loader2,
  ChevronDown,
  CloudSun,
  HandCoins,
  ClipboardList,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { computeNightDerived } from "@/lib/restaurant-stats";

interface MealsServedInputProps {
  date: string; // ISO date string (YYYY-MM-DD)
  location: string;
}

// Keys for every stored stat field (mirrors the API / Prisma model).
type StatKey =
  | "mealsServed"
  | "notes"
  | "weather"
  | "bookingsPax"
  | "nonPayingCount"
  | "vege"
  | "takeaways"
  | "eftposTransactions"
  | "cash"
  | "eftpos"
  | "stripe"
  | "protein";

type FormState = Record<StatKey, string>; // all held as strings; "" === empty

const EMPTY_FORM: FormState = {
  mealsServed: "",
  notes: "",
  weather: "",
  bookingsPax: "",
  nonPayingCount: "",
  vege: "",
  takeaways: "",
  eftposTransactions: "",
  cash: "",
  eftpos: "",
  stripe: "",
  protein: "",
};

const NZD = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
});

const PROTEIN_OPTIONS = [
  "Beef",
  "Chicken",
  "Pork",
  "Lamb",
  "Ham",
  "Fish",
  "Vegetarian",
  "Other",
] as const;

const toFormString = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v);
const num = (v: string | undefined | null): number | null => {
  if (!v || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function MealsServedInput({ date, location }: MealsServedInputProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [defaultValue, setDefaultValue] = useState<number>(60);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [hasExistingRecord, setHasExistingRecord] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // New volunteers are derived from attendance (read-only), not entered.
  const [newVolunteers, setNewVolunteers] = useState<number | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const set = (key: StatKey, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Pull the day's weather from Open-Meteo and fill the field. `silent` skips
  // toasts (used for the automatic fetch when no weather is recorded yet).
  const applyWeather = useCallback(
    async (silent: boolean) => {
      setWeatherLoading(true);
      try {
        const res = await fetch(
          `/api/admin/weather?date=${date}&location=${encodeURIComponent(
            location
          )}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.weather) {
            setForm((prev) => ({ ...prev, weather: data.weather }));
            if (!silent) toast.success(`Weather updated: ${data.weather}`);
            return;
          }
        }
        if (!silent) toast.error("Couldn't fetch weather for this night");
      } catch {
        if (!silent) toast.error("Couldn't fetch weather");
      } finally {
        setWeatherLoading(false);
      }
    },
    [date, location]
  );

  // Fetch existing record for this date + location
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      setFetching(true);
      try {
        const response = await fetch(
          `/api/admin/meals-served?date=${date}&location=${encodeURIComponent(
            location
          )}`
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;

        const next: FormState = { ...EMPTY_FORM };
        let hasRecord = false;
        (Object.keys(EMPTY_FORM) as StatKey[]).forEach((key) => {
          if (data[key] !== undefined && data[key] !== null) {
            next[key] = toFormString(data[key]);
            if (next[key] !== "") hasRecord = true;
          }
        });

        setForm(next);
        setHasExistingRecord(hasRecord);
        setNewVolunteers(
          typeof data.newVolunteers === "number" ? data.newVolunteers : null
        );
        // Reveal the detailed section if any advanced field is already filled.
        setDetailsOpen(
          hasRecord &&
            (Object.keys(next) as StatKey[]).some(
              (k) =>
                k !== "mealsServed" && k !== "notes" && next[k] !== ""
            )
        );
        if (typeof data.defaultMealsServed === "number") {
          setDefaultValue(data.defaultMealsServed);
        }

        // Auto-fill weather when none is recorded yet for this night.
        if (next.weather === "") {
          applyWeather(true);
        }
      } catch (error) {
        console.error("Error fetching service-night stats:", error);
      } finally {
        if (active) setFetching(false);
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, [date, location, applyWeather]);

  // Live derived figures (mirror the spreadsheet formulas)
  const derived = useMemo(
    () =>
      computeNightDerived({
        customers: num(form.mealsServed),
        nonPayingCount: num(form.nonPayingCount),
        cash: num(form.cash),
        eftpos: num(form.eftpos),
        stripe: num(form.stripe),
      }),
    [
      form.mealsServed,
      form.nonPayingCount,
      form.cash,
      form.eftpos,
      form.stripe,
    ]
  );

  const canSave = (Object.keys(form) as StatKey[]).some(
    (k) => form[k].trim() !== ""
  );

  // Placeholder for the future Stripe API integration — the UI is in place but
  // the figure is still entered manually until the backend sync is built.
  const handleStripeSync = () => {
    toast.info("Stripe sync is coming soon", {
      description: "For now, enter tonight's Stripe total manually.",
    });
  };

  const handleSave = async () => {
    if (!canSave) {
      toast.error("Enter at least one stat before saving");
      return;
    }

    setLoading(true);
    try {
      // Send raw strings — the API's Zod schema coerces/validates them.
      const payload: Record<string, unknown> = { date, location };
      (Object.keys(form) as StatKey[]).forEach((key) => {
        payload[key] = form[key].trim() === "" ? null : form[key].trim();
      });

      const response = await fetch("/api/admin/meals-served", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setHasExistingRecord(true);
        toast.success("Service-night stats saved");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save stats");
      }
    } catch (error) {
      console.error("Error saving service-night stats:", error);
      toast.error("Failed to save stats");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Utensils className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Service Night Stats
          {hasExistingRecord && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (Recorded)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {/* Headline count */}
          <div>
            <Label htmlFor="mealsServed">
              Customers served{" "}
              {!hasExistingRecord && (
                <span className="text-xs text-muted-foreground">
                  (Default: {defaultValue})
                </span>
              )}
            </Label>
            <Input
              id="mealsServed"
              type="number"
              inputMode="numeric"
              min="0"
              value={form.mealsServed}
              onChange={(e) => set("mealsServed", e.target.value)}
              placeholder={`e.g., ${defaultValue}`}
              className="max-w-xs mt-1.5 tabular-nums"
            />
            <p className="text-xs text-muted-foreground mt-1">
              People served tonight — the headline count.
            </p>
          </div>

          {/* Derived metrics readout */}
          <DerivedMetrics
            total={derived.totalDonations}
            perHead={derived.perHead}
            perPaying={derived.perPaying}
            nonPayingRatio={derived.nonPayingRatio}
          />

          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-between px-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100/60 dark:hover:bg-blue-900/30"
              >
                <span>Full service-night stats</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    detailsOpen ? "rotate-180" : ""
                  }`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 pt-4">
              {/* Attendance */}
              <Section icon={CloudSun} title="Attendance & conditions">
                <NumberField
                  id="bookingsPax"
                  label="Bookings (pax)"
                  value={form.bookingsPax}
                  onChange={(v) => set("bookingsPax", v)}
                />
                {/* New volunteers — derived from confirmed attendance, read-only */}
                <div>
                  <Label className="text-xs">New volunteers</Label>
                  <div className="mt-1 flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums text-foreground">
                    {newVolunteers === null ? "—" : newVolunteers}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Counted automatically from confirmed attendance.
                  </p>
                </div>
                {/* Weather — auto-pulled from Open-Meteo, still editable */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="weather" className="text-xs">
                      Weather
                    </Label>
                    <button
                      type="button"
                      onClick={() => applyWeather(false)}
                      disabled={weatherLoading}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100/70 dark:text-blue-300 dark:hover:bg-blue-900/40 cursor-pointer disabled:opacity-60 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {weatherLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      {weatherLoading ? "Fetching…" : "Get weather"}
                    </button>
                  </div>
                  <Input
                    id="weather"
                    type="text"
                    value={form.weather}
                    onChange={(e) => set("weather", e.target.value)}
                    placeholder="e.g., Overcast"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="protein" className="text-xs">
                    Protein
                  </Label>
                  <Select
                    value={form.protein || undefined}
                    onValueChange={(v) => set("protein", v)}
                  >
                    <SelectTrigger id="protein" className="mt-1 w-full">
                      <SelectValue placeholder="Select protein" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROTEIN_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Section>

              <Separator className="bg-blue-200/60 dark:bg-blue-800/60" />

              {/* Donations */}
              <Section icon={HandCoins} title="Koha / donations">
                <NumberField
                  id="cash"
                  label="Cash ($)"
                  step="0.01"
                  value={form.cash}
                  onChange={(v) => set("cash", v)}
                />
                <NumberField
                  id="eftpos"
                  label="Eftpos ($)"
                  step="0.01"
                  value={form.eftpos}
                  onChange={(v) => set("eftpos", v)}
                />
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="stripe" className="text-xs">
                      Stripe ($)
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="secondary"
                        className="h-4 px-1.5 text-[10px] font-medium uppercase tracking-wide"
                      >
                        Soon
                      </Badge>
                      <button
                        type="button"
                        onClick={handleStripeSync}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100/70 dark:text-blue-300 dark:hover:bg-blue-900/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Sync from Stripe
                      </button>
                    </div>
                  </div>
                  <Input
                    id="stripe"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={form.stripe}
                    onChange={(e) => set("stripe", e.target.value)}
                    className="mt-1 tabular-nums"
                  />
                </div>
                <NumberField
                  id="eftposTransactions"
                  label="Eftpos transactions"
                  value={form.eftposTransactions}
                  onChange={(v) => set("eftposTransactions", v)}
                />
                <div>
                  <NumberField
                    id="nonPayingCount"
                    label="Non-paying customers"
                    value={form.nonPayingCount}
                    onChange={(v) => set("nonPayingCount", v)}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {derived.nonPayingRatio === null
                      ? "Ratio is calculated from customers served."
                      : `${Math.round(
                          derived.nonPayingRatio * 100
                        )}% of customers served`}
                  </p>
                </div>
              </Section>

              <Separator className="bg-blue-200/60 dark:bg-blue-800/60" />

              {/* Service details */}
              <Section icon={ClipboardList} title="Service details">
                <NumberField
                  id="takeaways"
                  label="Takeaways"
                  value={form.takeaways}
                  onChange={(v) => set("takeaways", v)}
                />
                <NumberField
                  id="vege"
                  label="Vege"
                  value={form.vege}
                  onChange={(v) => set("vege", v)}
                />
              </Section>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="bg-blue-200/60 dark:bg-blue-800/60" />

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Any notes about tonight's service..."
              className="mt-1.5"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Save anytime — fill in the rest of the figures when you have them.
            </p>
            <Button
              onClick={handleSave}
              disabled={loading || !canSave}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {hasExistingRecord ? "Update" : "Save"}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Shared presentational helpers (module scope so identity is stable) ---

function DerivedMetrics({
  total,
  perHead,
  perPaying,
  nonPayingRatio,
}: {
  total: number | null;
  perHead: number | null;
  perPaying: number | null;
  nonPayingRatio: number | null;
}) {
  const items: { label: string; value: string }[] = [
    { label: "Total koha", value: total === null ? "—" : NZD.format(total) },
    { label: "$ per head", value: perHead === null ? "—" : NZD.format(perHead) },
    {
      label: "Per paying",
      value: perPaying === null ? "—" : NZD.format(perPaying),
    },
    {
      label: "Non-paying",
      value:
        nonPayingRatio === null ? "—" : `${Math.round(nonPayingRatio * 100)}%`,
    },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-md border border-blue-200/70 dark:border-blue-800/70 bg-background/60 px-3 py-2"
        >
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {item.label}
          </div>
          <div className="text-base font-semibold tabular-nums text-blue-900 dark:text-blue-100">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-200">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  step,
  min = "0",
  max,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
  min?: string;
  max?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 tabular-nums"
      />
    </div>
  );
}

