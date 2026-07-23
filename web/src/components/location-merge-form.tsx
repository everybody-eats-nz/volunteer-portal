"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Merge,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

interface LocationOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface LocationMergeFormProps {
  locations: LocationOption[];
  /** Shift venues with no Location row - mergeable as a source only. */
  orphanNames: string[];
}

export function LocationMergeForm({
  locations,
  orphanNames,
}: LocationMergeFormProps) {
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

  const requestMerge = async (apply: boolean) => {
    const response = await fetch("/api/admin/locations/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, into, apply }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to merge locations");
    }
    return data.plan as LocationMergePlan;
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setResult(null);
    try {
      setPlan(await requestMerge(false));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to preview merge"
      );
    } finally {
      setPreviewing(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const applied = await requestMerge(true);
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

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" aria-hidden="true" />
            Choose locations
          </CardTitle>
          <CardDescription>
            Everything filed under the duplicate moves to the location you
            keep, then the duplicate is removed. Nothing with volunteer
            signups is ever deleted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="merge-from">Duplicate to remove</Label>
              <Select value={from} onValueChange={selectFrom}>
                <SelectTrigger
                  id="merge-from"
                  className="w-full"
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
            </div>
            <ArrowRight
              className="hidden sm:block h-4 w-4 mb-3 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="space-y-2">
              <Label htmlFor="merge-into">Location to keep</Label>
              <Select value={into} onValueChange={selectInto}>
                <SelectTrigger
                  id="merge-into"
                  className="w-full"
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
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={handlePreview}
              disabled={!ready || previewing}
              data-testid="merge-preview-button"
            >
              {previewing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" aria-hidden="true" />
              )}
              Preview merge
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Alert data-testid="merge-success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>
            Merged &quot;{result.from}&quot; into &quot;{result.into}&quot;
          </AlertTitle>
          <AlertDescription>
            <MergeSummary plan={result} applied />
            {result.shifts.twinWarnings.length > 0 && (
              <p className="mt-2 font-medium">
                {result.shifts.twinWarnings.length === 1
                  ? `1 moved shift with signups now sits alongside an identical shift at "${result.into}" - consolidate it on the shifts page.`
                  : `${result.shifts.twinWarnings.length} moved shifts with signups now sit alongside identical shifts at "${result.into}" - consolidate them on the shifts page.`}
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {plan && (
        <Card data-testid="merge-plan">
          <CardHeader>
            <CardTitle>Merge preview</CardTitle>
            <CardDescription>
              What happens when &quot;{plan.from}&quot; is folded into &quot;
              {plan.into}&quot;. Nothing has been changed yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!plan.fromLocationExists && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  &quot;{plan.from}&quot; has no location record - this merge
                  only tidies up rows still referencing the name.
                </AlertDescription>
              </Alert>
            )}

            <MergeSummary plan={plan} />

            {plan.shifts.toDelete.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-1">
                  Duplicate shifts removed (empty, identical shift already at
                  &quot;{plan.into}&quot;)
                </h4>
                <ul className="text-sm text-muted-foreground list-disc pl-5">
                  {plan.shifts.toDelete.map((shift) => (
                    <li key={shift.id}>
                      {shift.date} - {shift.shiftTypeName}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {plan.templates.toDelete.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-1">
                  Duplicate templates removed (same name already at &quot;
                  {plan.into}&quot;)
                </h4>
                <ul className="text-sm text-muted-foreground list-disc pl-5">
                  {plan.templates.toDelete.map((template) => (
                    <li key={template.id}>{template.name}</li>
                  ))}
                </ul>
              </div>
            )}

            {plan.shifts.twinWarnings.length > 0 && (
              <Alert variant="destructive" data-testid="merge-twin-warnings">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Needs a follow-up</AlertTitle>
                <AlertDescription>
                  These shifts have signups or walk-ins and an identical shift
                  already exists at &quot;{plan.into}&quot;. They will be moved
                  (not deleted), so they will show as duplicates until you
                  consolidate them on the shifts page:
                  <ul className="list-disc pl-5 mt-1">
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
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            <div className="flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={applying}
                    data-testid="merge-apply-button"
                  >
                    {applying ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Merge className="h-4 w-4 mr-2" aria-hidden="true" />
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MergeSummary({
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
          ? ` (${plan.mealsServed.collisionDates.length} merged into existing nights: ${plan.mealsServed.collisionDates.join(", ")})`
          : ""),
    });
  }
  if (plan.dailyMenus.total > 0) {
    rows.push({
      label: "Daily menus",
      detail:
        `${plan.dailyMenus.total} ${moved}` +
        (plan.dailyMenus.collisionDates.length > 0
          ? ` (${count(plan.dailyMenus.collisionDates.length, "duplicate")} ${removed}: ${plan.dailyMenus.collisionDates.join(", ")})`
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
    <dl className="text-sm space-y-1">
      {rows.map((row) => (
        <div key={row.label} className="flex gap-2">
          <dt className="font-medium shrink-0">{row.label}:</dt>
          <dd className="text-muted-foreground">{row.detail}</dd>
        </div>
      ))}
    </dl>
  );
}
