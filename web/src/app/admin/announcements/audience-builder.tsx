"use client";

import { useEffect, useState, type ReactNode } from "react";
import { format, subMonths } from "date-fns";
import {
  Award,
  CalendarClock,
  Check,
  ChevronDown,
  History,
  MapPin,
  Search,
  Tag,
  UserPlus2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import {
  VOLUNTEER_GRADES,
  describeActivityTargeting,
  orJoin,
  userDisplayName,
  type LabelOption,
  type ShiftOption,
  type UserOption,
} from "./types";

/** Everything the audience section of the composer edits. */
export interface AudienceDraft {
  targetLocations: string[];
  targetGrades: string[];
  targetLabelIds: string[];
  targetUsers: UserOption[];
  targetShifts: ShiftOption[];
  activityEnabled: boolean;
  activityLocations: string[];
  activityFrom: string; // yyyy-MM-dd or ""
  activityTo: string;
  activityMinShifts: number;
  /** Upper bound on worked shifts; null = no limit. */
  activityMaxShifts: number | null;
}

export const EMPTY_AUDIENCE: AudienceDraft = {
  targetLocations: [],
  targetGrades: [],
  targetLabelIds: [],
  targetUsers: [],
  targetShifts: [],
  activityEnabled: false,
  activityLocations: [],
  activityFrom: "",
  activityTo: "",
  activityMinShifts: 1,
  activityMaxShifts: null,
};

export function countActiveAudienceFilters(d: AudienceDraft): number {
  return [
    d.targetLocations.length > 0,
    d.activityEnabled,
    d.targetGrades.length > 0,
    d.targetLabelIds.length > 0,
    d.targetUsers.length > 0,
    d.targetShifts.length > 0,
  ].filter(Boolean).length;
}

/** Quick date ranges for shift-history targeting, newest window first. */
const ACTIVITY_RANGE_PRESETS = [
  { months: 3, label: "Last 3 months" },
  { months: 6, label: "Last 6 months" },
  { months: 12, label: "Last 12 months" },
];

const GRADE_DOT: Record<string, string> = {
  GREEN: "bg-emerald-500",
  YELLOW: "bg-amber-400",
  PINK: "bg-pink-400",
};

interface AudienceBuilderProps {
  draft: AudienceDraft;
  onPatch: (patch: Partial<AudienceDraft>) => void;
  labels: LabelOption[];
  locations: string[];
}

/**
 * The audience section of the composer: six narrowing dimensions as
 * collapsible rows. Every filter narrows the audience (AND across rows);
 * choices inside a row widen it (OR within a row). Empty everywhere means
 * every volunteer.
 */
export function AudienceBuilder({
  draft,
  onPatch,
  labels,
  locations,
}: AudienceBuilderProps) {
  const activeCount = countActiveAudienceFilters(draft);

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const activitySummary = draft.activityEnabled
    ? (describeActivityTargeting({
        targetActivityLocations: draft.activityLocations,
        targetActivityFrom: draft.activityFrom
          ? new Date(`${draft.activityFrom}T00:00:00`).toISOString()
          : null,
        targetActivityTo: draft.activityTo
          ? new Date(`${draft.activityTo}T00:00:00`).toISOString()
          : null,
        targetActivityMinShifts: draft.activityMinShifts,
        targetActivityMaxShifts: draft.activityMaxShifts,
      }) ?? "Worked at least one shift")
    : null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {activeCount === 0
            ? "No filters — every volunteer receives this."
            : "Each filter narrows the audience; options inside a filter widen it."}
        </p>
        {activeCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onPatch({ ...EMPTY_AUDIENCE })}
            data-testid="audience-clear-filters"
          >
            <X className="h-3 w-3" />
            Clear all
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-forest-500/15 dark:border-white/10">
        {/* Location */}
        <FilterGroup
          icon={<MapPin className="h-4 w-4" />}
          label="Location"
          active={draft.targetLocations.length > 0}
          summary={
            draft.targetLocations.length > 0
              ? `Based in ${orJoin(draft.targetLocations)}`
              : "Anywhere"
          }
        >
          <ChipRow>
            {locations.map((loc) => (
              <Chip
                key={loc}
                pressed={draft.targetLocations.includes(loc)}
                onToggle={() =>
                  onPatch({
                    targetLocations: toggleIn(draft.targetLocations, loc),
                  })
                }
                data-testid={`audience-location-${loc}`}
              >
                {loc}
              </Chip>
            ))}
          </ChipRow>
          <p className="mt-2 text-xs text-muted-foreground">
            Matches the locations on a volunteer&apos;s profile — including
            people who have never worked a shift there. To reach volunteers who
            actually turned up, use Shift history below.
          </p>
        </FilterGroup>

        {/* Shift history */}
        <FilterGroup
          icon={<History className="h-4 w-4" />}
          label="Shift history"
          active={draft.activityEnabled}
          summary={activitySummary ?? "Any history"}
        >
          <label className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              checked={draft.activityEnabled}
              onCheckedChange={(checked) =>
                onPatch({ activityEnabled: checked === true })
              }
              className="mt-0.5"
              data-testid="announcement-activity-toggle"
            />
            <span className="text-sm leading-snug">
              Only volunteers who have worked a shift
              <span className="block text-xs text-muted-foreground">
                Counts shifts they were confirmed on that have already
                finished.
              </span>
            </span>
          </label>

          {draft.activityEnabled && (
            <div
              className="mt-3 space-y-4 rounded-lg border border-forest-500/15 bg-cream-50/60 p-3 dark:border-white/10 dark:bg-white/[0.03]"
              data-testid="announcement-activity-filters"
            >
              {locations.length > 0 && (
                <div>
                  <Label className="mb-1.5 block text-xs font-medium">
                    Worked at
                  </Label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {locations.map((loc) => (
                      <label
                        key={loc}
                        className="flex cursor-pointer items-center gap-1.5"
                      >
                        <Checkbox
                          checked={draft.activityLocations.includes(loc)}
                          onCheckedChange={() =>
                            onPatch({
                              activityLocations: toggleIn(
                                draft.activityLocations,
                                loc
                              ),
                            })
                          }
                          data-testid={`announcement-activity-location-${loc}`}
                        />
                        <span className="text-sm">{loc}</span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Leave empty to count shifts at any location.
                  </p>
                </div>
              )}

              <div>
                <Label className="mb-1.5 block text-xs font-medium">
                  Shift finished between
                </Label>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <Label
                      htmlFor="activity-from"
                      className="mb-1 block text-xs text-muted-foreground"
                    >
                      From
                    </Label>
                    <Input
                      id="activity-from"
                      type="date"
                      value={draft.activityFrom}
                      max={draft.activityTo || undefined}
                      onChange={(e) =>
                        onPatch({ activityFrom: e.target.value })
                      }
                      className="h-9 w-[10.5rem]"
                      data-testid="announcement-activity-from"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="activity-to"
                      className="mb-1 block text-xs text-muted-foreground"
                    >
                      To
                    </Label>
                    <Input
                      id="activity-to"
                      type="date"
                      value={draft.activityTo}
                      min={draft.activityFrom || undefined}
                      onChange={(e) => onPatch({ activityTo: e.target.value })}
                      className="h-9 w-[10.5rem]"
                      data-testid="announcement-activity-to"
                    />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ACTIVITY_RANGE_PRESETS.map((preset) => {
                    const presetFrom = format(
                      subMonths(new Date(), preset.months),
                      "yyyy-MM-dd"
                    );
                    const isActive =
                      draft.activityFrom === presetFrom &&
                      draft.activityTo === "";
                    return (
                      <Button
                        key={preset.months}
                        type="button"
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        aria-pressed={isActive}
                        className="h-7 text-xs"
                        onClick={() =>
                          onPatch({ activityFrom: presetFrom, activityTo: "" })
                        }
                        data-testid={`announcement-activity-preset-${preset.months}`}
                      >
                        {preset.label}
                      </Button>
                    );
                  })}
                  {(draft.activityFrom || draft.activityTo) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        onPatch({ activityFrom: "", activityTo: "" })
                      }
                    >
                      Clear dates
                    </Button>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Leave both empty to count shifts from any time.
                </p>
              </div>

              <div>
                <Label className="mb-1.5 block text-xs font-medium">
                  Number of shifts worked
                </Label>
                <div className="flex items-end gap-3">
                  <div>
                    <Label
                      htmlFor="activity-min-shifts"
                      className="mb-1 block text-xs text-muted-foreground"
                    >
                      At least
                    </Label>
                    <Input
                      id="activity-min-shifts"
                      type="number"
                      min={1}
                      max={999}
                      value={draft.activityMinShifts}
                      onChange={(e) => {
                        const next = parseInt(e.target.value, 10);
                        onPatch({
                          activityMinShifts: Number.isNaN(next)
                            ? 1
                            : Math.min(Math.max(next, 1), 999),
                        });
                      }}
                      className="h-9 w-24"
                      data-testid="announcement-activity-min-shifts"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="activity-max-shifts"
                      className="mb-1 block text-xs text-muted-foreground"
                    >
                      At most
                    </Label>
                    <Input
                      id="activity-max-shifts"
                      type="number"
                      min={draft.activityMinShifts}
                      max={999}
                      value={draft.activityMaxShifts ?? ""}
                      placeholder="No limit"
                      onChange={(e) => {
                        if (e.target.value === "") {
                          onPatch({ activityMaxShifts: null });
                          return;
                        }
                        const next = parseInt(e.target.value, 10);
                        onPatch({
                          activityMaxShifts: Number.isNaN(next)
                            ? null
                            : Math.min(Math.max(next, 1), 999),
                        });
                      }}
                      className="h-9 w-28"
                      data-testid="announcement-activity-max-shifts"
                    />
                  </div>
                </div>
                {draft.activityMaxShifts !== null &&
                  draft.activityMaxShifts < draft.activityMinShifts && (
                    <p className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      &ldquo;At most&rdquo; is below &ldquo;at least&rdquo; —
                      it will be treated as {draft.activityMinShifts}.
                    </p>
                  )}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Set both to 1 to reach people after their first shift.
                </p>
              </div>
            </div>
          )}
        </FilterGroup>

        {/* Grade */}
        <FilterGroup
          icon={<Award className="h-4 w-4" />}
          label="Volunteer grade"
          active={draft.targetGrades.length > 0}
          summary={
            draft.targetGrades.length > 0
              ? orJoin(
                  draft.targetGrades.map(
                    (g) =>
                      VOLUNTEER_GRADES.find((vg) => vg.value === g)?.label ?? g
                  )
                )
              : "Any grade"
          }
        >
          <ChipRow>
            {VOLUNTEER_GRADES.map((g) => (
              <Chip
                key={g.value}
                pressed={draft.targetGrades.includes(g.value)}
                onToggle={() =>
                  onPatch({
                    targetGrades: toggleIn(draft.targetGrades, g.value),
                  })
                }
                data-testid={`audience-grade-${g.value}`}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    GRADE_DOT[g.value] ?? "bg-muted-foreground"
                  )}
                />
                {g.label}
                <span className="font-normal opacity-70">
                  {g.description}
                </span>
              </Chip>
            ))}
          </ChipRow>
        </FilterGroup>

        {/* Labels */}
        {labels.length > 0 && (
          <FilterGroup
            icon={<Tag className="h-4 w-4" />}
            label="Custom labels"
            active={draft.targetLabelIds.length > 0}
            summary={
              draft.targetLabelIds.length > 0
                ? orJoin(
                    draft.targetLabelIds.map(
                      (id) => labels.find((l) => l.id === id)?.name ?? id
                    )
                  )
                : "Any label"
            }
          >
            <ChipRow>
              {labels.map((label) => {
                const pressed = draft.targetLabelIds.includes(label.id);
                return (
                  <button
                    key={label.id}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() =>
                      onPatch({
                        targetLabelIds: toggleIn(
                          draft.targetLabelIds,
                          label.id
                        ),
                      })
                    }
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                      label.color,
                      pressed
                        ? "ring-2 ring-forest-500 ring-offset-1 ring-offset-background dark:ring-[#86d99b]"
                        : "opacity-75 hover:opacity-100"
                    )}
                    data-testid={`audience-label-${label.id}`}
                  >
                    {pressed && <Check className="h-3 w-3" />}
                    {label.icon && <span>{label.icon}</span>}
                    {label.name}
                  </button>
                );
              })}
            </ChipRow>
          </FilterGroup>
        )}

        {/* Specific volunteers */}
        <FilterGroup
          icon={<UserPlus2 className="h-4 w-4" />}
          label="Specific volunteers"
          active={draft.targetUsers.length > 0}
          summary={
            draft.targetUsers.length > 0
              ? `Only ${draft.targetUsers.length} chosen volunteer${draft.targetUsers.length === 1 ? "" : "s"}`
              : "Everyone who matches"
          }
        >
          <SpecificUsersPicker
            selected={draft.targetUsers}
            onChange={(next) => onPatch({ targetUsers: next })}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Restricts the announcement to these volunteers only — other
            filters still apply on top.
          </p>
        </FilterGroup>

        {/* Specific shifts */}
        <FilterGroup
          icon={<CalendarClock className="h-4 w-4" />}
          label="Specific shifts"
          active={draft.targetShifts.length > 0}
          summary={
            draft.targetShifts.length > 0
              ? `Signed up to ${draft.targetShifts.length} chosen shift${draft.targetShifts.length === 1 ? "" : "s"}`
              : "Any shift"
          }
          last
        >
          <SpecificShiftsPicker
            selected={draft.targetShifts}
            onChange={(next) => onPatch({ targetShifts: next })}
            locations={locations}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Reaches volunteers with a current signup on these shifts —
            confirmed, pending or waitlisted.
          </p>
        </FilterGroup>
      </div>
    </div>
  );
}

// ─── Filter group row ───────────────────────────────────────────────────────

function FilterGroup({
  icon,
  label,
  summary,
  active,
  last,
  children,
}: {
  icon: ReactNode;
  label: string;
  summary: string;
  active: boolean;
  last?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "bg-card",
        !last && "border-b border-forest-500/10 dark:border-white/[0.07]"
      )}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-cream-50/70 dark:hover:bg-white/[0.03]"
          aria-expanded={open}
          data-testid={`audience-group-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
              active
                ? "bg-forest-500 text-white dark:bg-[#86d99b] dark:text-[#0f1114]"
                : "bg-forest-500/[0.07] text-forest-500 dark:bg-white/[0.06] dark:text-[#86d99b]"
            )}
          >
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium leading-tight">
              {label}
            </span>
            <span
              className={cn(
                "block truncate text-xs leading-tight",
                active
                  ? "font-medium text-forest-500 dark:text-[#86d99b]"
                  : "text-muted-foreground"
              )}
            >
              {summary}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 pl-[3.75rem]">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ChipRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function Chip({
  pressed,
  onToggle,
  children,
  ...rest
}: {
  pressed: boolean;
  onToggle: () => void;
  children: ReactNode;
} & Record<`data-${string}`, string>) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-all",
        pressed
          ? "border-forest-500 bg-forest-500 font-medium text-white dark:border-[#86d99b] dark:bg-[#86d99b] dark:text-[#0f1114]"
          : "border-forest-500/25 bg-transparent text-foreground hover:border-forest-500/60 hover:bg-forest-500/[0.05] dark:border-white/15 dark:hover:border-white/30 dark:hover:bg-white/[0.04]"
      )}
      {...rest}
    >
      {pressed && <Check className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

// ─── Specific volunteers picker ─────────────────────────────────────────────

function SpecificUsersPicker({
  selected,
  onChange,
}: {
  selected: UserOption[];
  onChange: (next: UserOption[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 250);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("q", debouncedSearch);
        params.set("limit", "50");
        const r = await fetch(`/api/admin/users?${params}`, {
          signal: controller.signal,
        });
        if (!r.ok) throw new Error("fetch failed");
        const data = await r.json();
        if (!cancelled) setResults(data);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, debouncedSearch]);

  const selectedIds = new Set(selected.map((u) => u.id));

  const toggle = (u: UserOption) => {
    onChange(
      selectedIds.has(u.id)
        ? selected.filter((s) => s.id !== u.id)
        : [...selected, u]
    );
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <UserPlus2 className="h-4 w-4" />
            {selected.length > 0
              ? `${selected.length} selected · add more`
              : "Pick volunteers"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="h-9 pl-8"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {loading ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">
                Searching…
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">
                No matching volunteers.
              </p>
            ) : (
              results.map((u) => {
                const isSelected = selectedIds.has(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u)}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/60",
                      isSelected && "bg-muted"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {userDisplayName(u)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {u.email}
                      </span>
                    </span>
                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-forest-500 dark:text-[#86d99b]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <Badge
              key={u.id}
              variant="secondary"
              className="gap-1 py-0.5 pl-2 pr-1"
            >
              <span className="text-xs">{userDisplayName(u)}</span>
              <button
                type="button"
                onClick={() => onChange(selected.filter((s) => s.id !== u.id))}
                className="cursor-pointer rounded p-0.5 hover:bg-background/60"
                aria-label={`Remove ${userDisplayName(u)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Specific shifts picker ─────────────────────────────────────────────────

function shiftDisplayLabel(s: ShiftOption) {
  const start = new Date(s.start);
  const datePart = format(start, "EEE d MMM");
  const timePart = format(start, "h:mma").toLowerCase();
  const loc = s.location ?? "—";
  return `${s.shiftTypeName} · ${datePart} ${timePart} · ${loc}`;
}

function SpecificShiftsPicker({
  selected,
  onChange,
  locations,
}: {
  selected: ShiftOption[];
  onChange: (next: ShiftOption[]) => void;
  locations: string[];
}) {
  const [open, setOpen] = useState(false);
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    if (locationFilter) params.set("location", locationFilter);
    fetch(`/api/admin/announcements/shifts?${params}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => {
        if (!cancelled) setShifts(data.shifts ?? []);
      })
      .catch(() => {
        if (!cancelled) setShifts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, locationFilter]);

  const selectedIds = new Set(selected.map((s) => s.id));

  const toggle = (s: ShiftOption) => {
    onChange(
      selectedIds.has(s.id)
        ? selected.filter((x) => x.id !== s.id)
        : [...selected, s]
    );
  };

  // Group shifts by date for a scannable list.
  const grouped = shifts.reduce<Record<string, ShiftOption[]>>((acc, s) => {
    const key = format(new Date(s.start), "EEE d MMM yyyy");
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <CalendarClock className="h-4 w-4" />
            {selected.length > 0
              ? `${selected.length} selected · add more`
              : "Pick shifts"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="start">
          <div className="flex items-center gap-2 border-b p-2">
            <Label className="text-xs text-muted-foreground">Location</Label>
            <select
              className="flex-1 rounded border bg-background px-2 py-1 text-sm"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="">All locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {loading ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">
                Loading shifts…
              </p>
            ) : shifts.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">
                No upcoming shifts.
              </p>
            ) : (
              Object.entries(grouped).map(([date, dayShifts]) => (
                <div key={date} className="px-1 pb-1">
                  <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {date}
                  </p>
                  {dayShifts.map((s) => {
                    const isSelected = selectedIds.has(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggle(s)}
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between gap-2 rounded px-3 py-2 text-left hover:bg-muted/60",
                          isSelected && "bg-muted"
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {s.shiftTypeName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {format(new Date(s.start), "h:mma").toLowerCase()}
                            {" – "}
                            {format(new Date(s.end), "h:mma").toLowerCase()}
                            {" · "}
                            {s.location ?? "—"}
                            {" · "}
                            {s.signupCount} signed up
                          </span>
                        </span>
                        {isSelected && (
                          <Check className="h-4 w-4 shrink-0 text-forest-500 dark:text-[#86d99b]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <Badge
              key={s.id}
              variant="secondary"
              className="gap-1 py-0.5 pl-2 pr-1"
            >
              <span className="text-xs">{shiftDisplayLabel(s)}</span>
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x.id !== s.id))}
                className="cursor-pointer rounded p-0.5 hover:bg-background/60"
                aria-label="Remove shift"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
