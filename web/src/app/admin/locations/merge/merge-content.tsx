"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  Clock,
  Home,
  LayoutTemplate,
  Loader2,
  MapPin,
  Megaphone,
  Merge,
  Search,
  Sparkles,
  Users,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { LocationMergePlan } from "@/lib/location-merge";

export interface MergeLocationOption {
  id: string;
  name: string;
  isActive: boolean;
}

export interface MergeSuggestion {
  from: string;
  into: string;
}

interface MergeContentProps {
  locations: MergeLocationOption[];
  /** Shift venues with no Location row — mergeable as a source only. */
  orphanNames: string[];
  /** Total shifts (all time) referencing each name. */
  shiftCounts: Record<string, number>;
  /** Auto-detected near-identical name pairs, ready to prefill. */
  suggestions: MergeSuggestion[];
}

export function MergeContent({
  locations,
  orphanNames,
  shiftCounts,
  suggestions,
}: MergeContentProps) {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [into, setInto] = useState("");
  const [plan, setPlan] = useState<LocationMergePlan | null>(null);
  const [result, setResult] = useState<LocationMergePlan | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  const ready = from !== "" && into !== "" && from !== into;

  const selectFrom = (value: string) => {
    setFrom(value);
    setPlan(null);
    setResult(null);
  };
  const selectInto = (value: string) => {
    setInto(value);
    setPlan(null);
    setResult(null);
  };

  const requestMerge = async (
    fromName: string,
    intoName: string,
    apply: boolean
  ) => {
    const response = await fetch("/api/admin/locations/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromName, into: intoName, apply }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Merge API error:", data);
      throw new Error(data.error || "Failed to merge locations");
    }
    return data.plan as LocationMergePlan;
  };

  const runPreview = async (fromName: string, intoName: string) => {
    setPreviewing(true);
    setResult(null);
    try {
      setPlan(await requestMerge(fromName, intoName, false));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to preview merge"
      );
    } finally {
      setPreviewing(false);
    }
  };

  const applySuggestion = (suggestion: MergeSuggestion) => {
    setFrom(suggestion.from);
    setInto(suggestion.into);
    setPlan(null);
    setResult(null);
    void runPreview(suggestion.from, suggestion.into);
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const applied = await requestMerge(from, into, true);
      setResult(applied);
      setPlan(null);
      setFrom("");
      setInto("");
      toast.success(`Merged "${applied.from}" into "${applied.into}"`);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to merge locations"
      );
    } finally {
      setApplying(false);
    }
  };

  const fromIsOrphan = orphanNames.includes(from);
  const fromOption = locations.find((location) => location.name === from);
  const intoOption = locations.find((location) => location.name === into);

  return (
    <PageContainer
      className="max-w-4xl space-y-6"
      data-testid="admin-merge-locations-page"
    >
      <Link
        href="/admin/locations"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All locations
      </Link>

      {/* Success — the outcome replaces the plan, selections reset */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
          data-testid="merge-success"
        >
          <div className="relative overflow-hidden rounded-2xl border border-[#1d5337]/15 bg-gradient-to-br from-[#1d5337] to-[#2e6438] p-5 text-white sm:p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[#f8fb69]/20 blur-2xl"
            />
            <div className="relative flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-[#f8fb69]">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-accent text-lg font-semibold leading-tight sm:text-xl">
                    Merged &quot;{result.from}&quot; into &quot;{result.into}
                    &quot;
                  </h2>
                  <p className="mt-0.5 text-sm text-white/80">
                    Everything that referenced the duplicate now points at the
                    kept location.
                  </p>
                </div>
              </div>

              {result.shifts.twinWarnings.length > 0 && (
                <p className="rounded-xl bg-amber-400/20 px-4 py-3 text-sm font-medium text-[#f8fb69]">
                  {result.shifts.twinWarnings.length === 1
                    ? `1 moved shift with signups now sits alongside an identical shift at "${result.into}" - consolidate it on the shifts page.`
                    : `${result.shifts.twinWarnings.length} moved shifts with signups now sit alongside identical shifts at "${result.into}" - consolidate them on the shifts page.`}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  asChild
                  size="sm"
                  className="bg-white text-[#1d5337] hover:bg-white/90"
                >
                  <Link href="/admin/locations">Back to locations</Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/15 hover:text-white"
                  onClick={() => setResult(null)}
                >
                  Merge another
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border dark:bg-white/[0.02]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              What moved
            </p>
            <div className="mt-3">
              <MergeManifest plan={result} applied />
            </div>
          </div>
        </motion.div>
      )}

      {/* Auto-detected duplicates */}
      {suggestions.length > 0 && !result && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl border border-amber-300/50 bg-gradient-to-br from-amber-50 to-yellow-50 p-5 dark:border-amber-300/25 dark:from-amber-950/30 dark:to-yellow-950/20"
          data-testid="merge-suggestions"
        >
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-600 dark:text-amber-400">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-accent text-base font-semibold leading-tight">
                {suggestions.length === 1
                  ? "These names look like the same venue"
                  : `${suggestions.length} name pairs look like the same venue`}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                The names below differ only in spacing, casing or punctuation.
                Pick one to prefill the merge and preview it.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <li key={`${suggestion.from}→${suggestion.into}`}>
                    <button
                      type="button"
                      onClick={() => applySuggestion(suggestion)}
                      className="inline-flex items-center gap-2 rounded-full bg-card px-3.5 py-1.5 text-sm font-medium shadow-sm ring-1 ring-amber-400/40 transition-colors hover:bg-amber-400/10 dark:bg-white/[0.04]"
                      data-testid={`merge-suggestion-${suggestion.from}`}
                    >
                      <span className="text-muted-foreground line-through decoration-destructive/60">
                        {suggestion.from}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-semibold text-[#1d5337] dark:text-emerald-300">
                        {suggestion.into}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 1 — choose the pair */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border dark:bg-white/[0.02] sm:p-6"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Step 1 · Choose the pair
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Everything filed under the duplicate moves to the location you keep,
          then the duplicate is removed. Nothing with volunteer signups is ever
          deleted.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
          <div className="rounded-xl bg-destructive/[0.04] p-4 ring-1 ring-destructive/20 dark:bg-destructive/10">
            <Label
              htmlFor="merge-from"
              className="text-xs font-semibold uppercase tracking-wide text-destructive"
            >
              Duplicate to remove
            </Label>
            <Select value={from} onValueChange={selectFrom}>
              <SelectTrigger
                id="merge-from"
                className="mt-2 w-full bg-card"
                data-testid="merge-from-select"
              >
                <SelectValue placeholder="Select duplicate..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem
                    key={location.id}
                    value={location.name}
                    disabled={location.name === into}
                  >
                    {location.name}
                    {!location.isActive && " (inactive)"}
                  </SelectItem>
                ))}
                {orphanNames.map((name) => (
                  <SelectItem
                    key={`orphan-${name}`}
                    value={name}
                    disabled={name === into}
                  >
                    {name} (shifts only, no location record)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SlotMeta
              name={from}
              shiftCount={from ? (shiftCounts[from] ?? 0) : null}
              badge={
                from === ""
                  ? null
                  : fromIsOrphan
                    ? "No location record"
                    : fromOption && !fromOption.isActive
                      ? "Inactive"
                      : null
              }
            />
          </div>

          <div className="hidden items-center sm:flex">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>

          <div className="rounded-xl bg-[#1d5337]/[0.04] p-4 ring-1 ring-[#1d5337]/20 dark:bg-emerald-400/5 dark:ring-emerald-400/20">
            <Label
              htmlFor="merge-into"
              className="text-xs font-semibold uppercase tracking-wide text-[#1d5337] dark:text-emerald-300"
            >
              Location to keep
            </Label>
            <Select value={into} onValueChange={selectInto}>
              <SelectTrigger
                id="merge-into"
                className="mt-2 w-full bg-card"
                data-testid="merge-into-select"
              >
                <SelectValue placeholder="Select target..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem
                    key={location.id}
                    value={location.name}
                    disabled={location.name === from}
                  >
                    {location.name}
                    {!location.isActive && " (inactive)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SlotMeta
              name={into}
              shiftCount={into ? (shiftCounts[into] ?? 0) : null}
              badge={
                intoOption && !intoOption.isActive ? "Inactive" : null
              }
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            onClick={() => runPreview(from, into)}
            disabled={!ready || previewing}
            data-testid="merge-preview-button"
          >
            {previewing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
            Preview merge
          </Button>
        </div>
      </motion.section>

      {/* Step 2 — review what moves */}
      {plan && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl bg-card shadow-sm ring-1 ring-border dark:bg-white/[0.02]"
          data-testid="merge-plan"
        >
          <div className="border-b border-border/60 p-5 sm:p-6 sm:pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Step 2 · Review what moves
            </p>
            <h2 className="mt-1 font-accent text-lg font-semibold leading-tight">
              &quot;{plan.from}&quot;{" "}
              <ArrowRight className="inline h-4 w-4 text-muted-foreground" />{" "}
              &quot;{plan.into}&quot;
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Nothing has been changed yet.
            </p>
          </div>

          <div className="space-y-4 p-5 sm:p-6 sm:pt-5">
            {!plan.fromLocationExists && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-400/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  &quot;{plan.from}&quot; has no location record - this merge
                  only tidies up rows still referencing the name.
                </span>
              </p>
            )}

            <MergeManifest plan={plan} />

            {plan.shifts.toDelete.length > 0 && (
              <div className="rounded-xl bg-muted/50 px-4 py-3">
                <h4 className="text-sm font-medium">
                  Duplicate shifts removed (empty, identical shift already at
                  &quot;{plan.into}&quot;)
                </h4>
                <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-sm text-muted-foreground">
                  {plan.shifts.toDelete.map((shift) => (
                    <li key={shift.id}>
                      {shift.date} - {shift.shiftTypeName}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {plan.templates.toDelete.length > 0 && (
              <div className="rounded-xl bg-muted/50 px-4 py-3">
                <h4 className="text-sm font-medium">
                  Duplicate templates removed (same name already at &quot;
                  {plan.into}&quot;)
                </h4>
                <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-sm text-muted-foreground">
                  {plan.templates.toDelete.map((template) => (
                    <li key={template.id}>{template.name}</li>
                  ))}
                </ul>
              </div>
            )}

            {plan.shifts.twinWarnings.length > 0 && (
              <div
                className="rounded-xl border border-amber-300/50 bg-amber-400/10 px-4 py-3"
                data-testid="merge-twin-warnings"
              >
                <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  Needs a follow-up
                </h4>
                <p className="mt-1 text-sm text-amber-700/90 dark:text-amber-300/90">
                  These shifts have signups or walk-ins and an identical shift
                  already exists at &quot;{plan.into}&quot;. They will be moved
                  (not deleted), so they will show as duplicates until you
                  consolidate them on the shifts page:
                </p>
                <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-sm text-amber-700/90 dark:text-amber-300/90">
                  {plan.shifts.twinWarnings.map((shift) => (
                    <li key={shift.id}>
                      {shift.date} - {shift.shiftTypeName} ({shift.signups}{" "}
                      signup{shift.signups === 1 ? "" : "s"}
                      {shift.placeholders > 0 &&
                        `, ${shift.placeholders} walk-in${
                          shift.placeholders === 1 ? "" : "s"
                        }`}
                      )
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end border-t border-border/60 pt-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={applying}
                    data-testid="merge-apply-button"
                  >
                    {applying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Merge className="h-4 w-4" aria-hidden="true" />
                    )}
                    Merge locations
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Merge &quot;{plan.from}&quot; into &quot;{plan.into}
                      &quot;?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Everything referencing &quot;{plan.from}&quot; moves to
                      &quot;{plan.into}&quot;
                      {plan.fromLocationExists &&
                        ` and the "${plan.from}" location is removed`}
                      . This can&apos;t be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleApply}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      data-testid="merge-confirm-button"
                    >
                      Merge locations
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </motion.section>
      )}
    </PageContainer>
  );
}

function SlotMeta({
  name,
  shiftCount,
  badge,
}: {
  name: string;
  shiftCount: number | null;
  badge: string | null;
}) {
  if (!name) {
    return (
      <p className="mt-2 text-xs text-muted-foreground/70">
        Nothing selected yet
      </p>
    );
  }
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>
        <span className="font-semibold tabular-nums text-foreground">
          {shiftCount}
        </span>{" "}
        {shiftCount === 1 ? "shift references" : "shifts reference"} this name
      </span>
      {badge && (
        <span className="inline-flex items-center rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          {badge}
        </span>
      )}
    </p>
  );
}

const MANIFEST_ICONS: Record<string, React.ReactNode> = {
  Shifts: <CalendarDays className="h-3.5 w-3.5" />,
  "Shift templates": <LayoutTemplate className="h-3.5 w-3.5" />,
  "Service night records": <UtensilsCrossed className="h-3.5 w-3.5" />,
  "Daily menus": <ChefHat className="h-3.5 w-3.5" />,
  "Messaging hours": <Clock className="h-3.5 w-3.5" />,
  "Regular volunteers": <Users className="h-3.5 w-3.5" />,
  "Auto-accept rules": <Zap className="h-3.5 w-3.5" />,
  "Volunteers' home location": <Home className="h-3.5 w-3.5" />,
  "Volunteers' available locations": <MapPin className="h-3.5 w-3.5" />,
  "Restaurant managers": <BellRing className="h-3.5 w-3.5" />,
  "Announcement targeting": <Megaphone className="h-3.5 w-3.5" />,
};

function MergeManifest({
  plan,
  applied = false,
}: {
  plan: LocationMergePlan;
  applied?: boolean;
}) {
  const moved = applied ? "moved" : "will move";
  const removed = applied ? "removed" : "will be removed";
  const count = (n: number, noun: string) =>
    `${n} ${noun}${n === 1 ? "" : "s"}`;
  // Long-lived venues can collide on hundreds of dates — keep the row
  // readable; 6 dates is roughly one manifest line at desktop width.
  const listDates = (dates: string[], max = 6) =>
    dates.length <= max
      ? dates.join(", ")
      : `${dates.slice(0, max).join(", ")} and ${dates.length - max} more`;

  const rows: { label: string; detail: string }[] = [];

  if (plan.shifts.total > 0) {
    const parts = [];
    if (plan.shifts.toRepoint > 0) {
      parts.push(`${plan.shifts.toRepoint} ${moved}`);
    }
    if (plan.shifts.toDelete.length > 0) {
      parts.push(
        `${count(plan.shifts.toDelete.length, "empty duplicate")} ${removed}`
      );
    }
    rows.push({ label: "Shifts", detail: parts.join(", ") });
  }
  if (plan.templates.total > 0) {
    const parts = [];
    if (plan.templates.toRepoint > 0) {
      parts.push(`${plan.templates.toRepoint} ${moved}`);
    }
    if (plan.templates.toDelete.length > 0) {
      parts.push(
        `${count(plan.templates.toDelete.length, "duplicate")} ${removed}`
      );
    }
    rows.push({ label: "Shift templates", detail: parts.join(", ") });
  }
  if (plan.mealsServed.total > 0) {
    rows.push({
      label: "Service night records",
      detail:
        `${plan.mealsServed.total} ${moved}` +
        (plan.mealsServed.collisionDates.length > 0
          ? ` (${plan.mealsServed.collisionDates.length} merged into existing nights: ${listDates(plan.mealsServed.collisionDates)})`
          : ""),
    });
  }
  if (plan.dailyMenus.total > 0) {
    rows.push({
      label: "Daily menus",
      detail:
        `${plan.dailyMenus.total} ${moved}` +
        (plan.dailyMenus.collisionDates.length > 0
          ? ` (${count(plan.dailyMenus.collisionDates.length, "duplicate")} ${removed}: ${listDates(plan.dailyMenus.collisionDates)})`
          : ""),
    });
  }
  if (plan.messagingHours.total > 0) {
    rows.push({
      label: "Messaging hours",
      detail:
        `${plan.messagingHours.total} ${moved}` +
        (plan.messagingHours.collisions > 0
          ? ` (${count(plan.messagingHours.collisions, "duplicate")} ${removed})`
          : ""),
    });
  }
  if (plan.regularVolunteers > 0) {
    rows.push({
      label: "Regular volunteers",
      detail: `${plan.regularVolunteers} ${moved}`,
    });
  }
  if (plan.autoAcceptRules > 0) {
    rows.push({
      label: "Auto-accept rules",
      detail: `${plan.autoAcceptRules} ${moved}`,
    });
  }
  if (plan.usersDefaultLocation > 0) {
    rows.push({
      label: "Volunteers' home location",
      detail: `${plan.usersDefaultLocation} updated`,
    });
  }
  if (plan.usersAvailableLocations > 0) {
    rows.push({
      label: "Volunteers' available locations",
      detail: `${plan.usersAvailableLocations} updated`,
    });
  }
  if (plan.restaurantManagers > 0) {
    rows.push({
      label: "Restaurant managers",
      detail: `${plan.restaurantManagers} updated`,
    });
  }
  if (plan.announcements > 0) {
    rows.push({
      label: "Announcement targeting",
      detail: `${plan.announcements} updated`,
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing references &quot;{plan.from}&quot;
        {plan.fromLocationExists &&
          !applied &&
          " - only the empty location record will be removed"}
        .
      </p>
    );
  }

  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start gap-2.5 text-sm">
          <span
            aria-hidden
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#1d5337]/10 text-[#1d5337] dark:bg-emerald-400/15 dark:text-emerald-300"
          >
            {MANIFEST_ICONS[row.label] ?? (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
          </span>
          <dt className="shrink-0 font-medium leading-6">{row.label}:</dt>
          <dd className="min-w-0 leading-6 text-muted-foreground">
            {row.detail}
          </dd>
        </div>
      ))}
    </dl>
  );
}
