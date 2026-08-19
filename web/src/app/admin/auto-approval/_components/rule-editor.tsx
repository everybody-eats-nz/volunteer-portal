"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CircleSlash, Loader2, Tag, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { VOLUNTEER_GRADE_OPTIONS } from "@/lib/volunteer-grades";

import type { AdminOptions } from "./shared";
import type { SerializedRuleClient } from "./rules-tab";

const NONE = "NONE";
const ALL_LOCATIONS = "ALL";
const GLOBAL = "GLOBAL";

interface Draft {
  name: string;
  description: string;
  kind: "APPROVE" | "BLOCK";
  enabled: boolean;
  priority: number;
  scope: string; // GLOBAL or a shiftTypeId
  location: string;
  criteriaLogic: "AND" | "OR";
  requiredLabelIds: string[];
  minVolunteerGrade: string;
  minVolunteerAge: string;
  maxVolunteerAge: string;
  minAccountAgeDays: string;
  minCompletedShifts: string;
  minAttendanceRate: string;
  requireShiftTypeExperience: boolean;
  maxDaysInAdvance: string;
}

const EMPTY: Draft = {
  name: "",
  description: "",
  kind: "APPROVE",
  enabled: true,
  priority: 0,
  scope: GLOBAL,
  location: ALL_LOCATIONS,
  criteriaLogic: "AND",
  requiredLabelIds: [],
  minVolunteerGrade: NONE,
  minVolunteerAge: "",
  maxVolunteerAge: "",
  minAccountAgeDays: "",
  minCompletedShifts: "",
  minAttendanceRate: "",
  requireShiftTypeExperience: false,
  maxDaysInAdvance: "",
};

function toDraft(rule: SerializedRuleClient): Draft {
  return {
    name: rule.name,
    description: rule.description ?? "",
    kind: rule.kind,
    enabled: rule.enabled,
    priority: rule.priority,
    scope: rule.global ? GLOBAL : (rule.shiftTypeId ?? GLOBAL),
    location: rule.location ?? ALL_LOCATIONS,
    criteriaLogic: rule.criteriaLogic,
    requiredLabelIds: rule.requiredLabelIds ?? [],
    minVolunteerGrade: rule.minVolunteerGrade ?? NONE,
    minVolunteerAge: rule.minVolunteerAge?.toString() ?? "",
    maxVolunteerAge: rule.maxVolunteerAge?.toString() ?? "",
    minAccountAgeDays: rule.minAccountAgeDays?.toString() ?? "",
    minCompletedShifts: rule.minCompletedShifts?.toString() ?? "",
    minAttendanceRate: rule.minAttendanceRate?.toString() ?? "",
    requireShiftTypeExperience: rule.requireShiftTypeExperience,
    maxDaysInAdvance: rule.maxDaysInAdvance?.toString() ?? "",
  };
}

const numeric = (v: string) => (v.trim() === "" ? null : Number(v));

function toPayload(draft: Draft) {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    kind: draft.kind,
    enabled: draft.enabled,
    priority: draft.priority,
    global: draft.scope === GLOBAL,
    shiftTypeId: draft.scope === GLOBAL ? null : draft.scope,
    location: draft.location === ALL_LOCATIONS ? null : draft.location,
    criteriaLogic: draft.criteriaLogic,
    requiredLabelIds: draft.requiredLabelIds,
    minVolunteerGrade: draft.minVolunteerGrade === NONE ? null : draft.minVolunteerGrade,
    minVolunteerAge: numeric(draft.minVolunteerAge),
    maxVolunteerAge: numeric(draft.maxVolunteerAge),
    minAccountAgeDays: numeric(draft.minAccountAgeDays),
    minCompletedShifts: numeric(draft.minCompletedShifts),
    minAttendanceRate: numeric(draft.minAttendanceRate),
    requireShiftTypeExperience: draft.requireShiftTypeExperience,
    maxDaysInAdvance: numeric(draft.maxDaysInAdvance),
  };
}

function countConditions(draft: Draft) {
  return [
    draft.requiredLabelIds.length > 0,
    draft.minVolunteerGrade !== NONE,
    draft.minVolunteerAge.trim() !== "",
    draft.maxVolunteerAge.trim() !== "",
    draft.minAccountAgeDays.trim() !== "",
    draft.minCompletedShifts.trim() !== "",
    draft.minAttendanceRate.trim() !== "",
    draft.requireShiftTypeExperience,
    draft.maxDaysInAdvance.trim() !== "",
  ].filter(Boolean).length;
}

export function RuleEditor({
  open,
  onOpenChange,
  rule,
  options,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: SerializedRuleClient | null;
  options: AdminOptions;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(rule ? toDraft(rule) : EMPTY);
  }, [open, rule]);

  const set = useCallback(
    <K extends keyof Draft>(key: K, value: Draft[K]) =>
      setDraft((d) => ({ ...d, [key]: value })),
    []
  );

  const conditionCount = countConditions(draft);
  const canSave = draft.name.trim().length > 0 && conditionCount > 0 && !saving;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        rule
          ? `/api/admin/auto-approval/rules/${rule.id}`
          : "/api/admin/auto-approval/rules",
        {
          method: rule ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toPayload(draft)),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't save the rule");
      }
      toast.success(rule ? "Rule updated" : "Rule created");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the rule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] sm:max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit rule" : "New rule"}</DialogTitle>
          <DialogDescription>
            {draft.kind === "BLOCK"
              ? "Block rules run first. Anyone who matches is held for a person, whatever the approval rules say."
              : "Approval rules confirm a signup on the spot when every condition you set is met."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-6">
            <KindPicker value={draft.kind} onChange={(v) => set("kind", v)} />

            <section className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <div className="space-y-1.5">
                  <Label htmlFor="rule-name">Name</Label>
                  <Input
                    id="rule-name"
                    value={draft.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Trusted regulars"
                    data-testid="rule-name-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rule-priority">Priority</Label>
                  <Input
                    id="rule-priority"
                    type="number"
                    min={0}
                    value={draft.priority}
                    onChange={(e) =>
                      set("priority", Number(e.target.value) || 0)
                    }
                    className="tabular-nums"
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher runs first
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rule-description">
                  Note{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="rule-description"
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Why this rule exists, so the next person knows."
                  rows={2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rule-scope">Applies to</Label>
                  <Select value={draft.scope} onValueChange={(v) => set("scope", v)}>
                    <SelectTrigger id="rule-scope">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={GLOBAL}>Every shift type</SelectItem>
                      {options.shiftTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rule-location">At</Label>
                  <Select
                    value={draft.location}
                    onValueChange={(v) => set("location", v)}
                  >
                    <SelectTrigger id="rule-location">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_LOCATIONS}>Every location</SelectItem>
                      {options.locations.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium">Conditions</h3>
                  <p className="text-sm text-muted-foreground">
                    Leave a field empty to ignore it.
                  </p>
                </div>
                <Select
                  value={draft.criteriaLogic}
                  onValueChange={(v) => set("criteriaLogic", v as "AND" | "OR")}
                >
                  <SelectTrigger className="w-auto" aria-label="Condition logic">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">Must meet all</SelectItem>
                    <SelectItem value="OR">Must meet any one</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 rounded-md border border-dashed p-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <Label className="font-medium">Volunteer tags</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Name specific people by the tag they carry. Tag someone on
                  their profile and this rule picks them up — no other condition
                  needed.
                </p>
                {options.labels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No tags exist yet. Create them under Custom Labels.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2 pt-1">
                    {options.labels.map((label) => {
                      const checked = draft.requiredLabelIds.includes(label.id);
                      return (
                        <li key={label.id}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                              checked
                                ? "border-primary bg-primary/10"
                                : "hover:bg-muted"
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) =>
                                set(
                                  "requiredLabelIds",
                                  v
                                    ? [...draft.requiredLabelIds, label.id]
                                    : draft.requiredLabelIds.filter(
                                        (id) => id !== label.id
                                      )
                                )
                              }
                            />
                            <span>
                              {label.icon ? `${label.icon} ` : ""}
                              {label.name}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {label.volunteerCount}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rule-grade">Minimum grade</Label>
                  <Select
                    value={draft.minVolunteerGrade}
                    onValueChange={(v) => set("minVolunteerGrade", v)}
                  >
                    <SelectTrigger id="rule-grade">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Any grade</SelectItem>
                      {VOLUNTEER_GRADE_OPTIONS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.icon} {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <NumberField
                  id="rule-age"
                  label="Minimum age"
                  suffix="years"
                  value={draft.minVolunteerAge}
                  onChange={(v) => set("minVolunteerAge", v)}
                  placeholder="18"
                />
                <NumberField
                  id="rule-max-age"
                  label="Under"
                  suffix="years old"
                  value={draft.maxVolunteerAge}
                  onChange={(v) => set("maxVolunteerAge", v)}
                  placeholder="18"
                  max={120}
                />
                <NumberField
                  id="rule-account-age"
                  label="Signed up at least"
                  suffix="days ago"
                  value={draft.minAccountAgeDays}
                  onChange={(v) => set("minAccountAgeDays", v)}
                  placeholder="30"
                />
                <NumberField
                  id="rule-shifts"
                  label="Completed shifts"
                  suffix="or more"
                  value={draft.minCompletedShifts}
                  onChange={(v) => set("minCompletedShifts", v)}
                  placeholder="5"
                />
                <NumberField
                  id="rule-attendance"
                  label="Attendance"
                  suffix="% or better"
                  value={draft.minAttendanceRate}
                  onChange={(v) => set("minAttendanceRate", v)}
                  placeholder="85"
                  max={100}
                />
                <NumberField
                  id="rule-lead-time"
                  label="Shift starts within"
                  suffix="days"
                  value={draft.maxDaysInAdvance}
                  onChange={(v) => set("maxDaysInAdvance", v)}
                  placeholder="14"
                />
              </div>

              <label className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  checked={draft.requireShiftTypeExperience}
                  onCheckedChange={(v) =>
                    set("requireShiftTypeExperience", Boolean(v))
                  }
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-medium">
                    Has done this shift type before
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Only counts shifts that have already finished.
                  </span>
                </span>
              </label>

              {conditionCount === 0 && (
                <p className="text-sm text-destructive" role="alert">
                  Set at least one condition. A rule with none can never match
                  anyone.
                </p>
              )}
            </section>

            <label className="flex items-center justify-between rounded-lg border p-3">
              <span>
                <span className="block text-sm font-medium">Rule is on</span>
                <span className="block text-sm text-muted-foreground">
                  Turn off to keep the rule without it deciding anything.
                </span>
              </span>
              <Switch
                checked={draft.enabled}
                onCheckedChange={(v) => set("enabled", v)}
                aria-label="Rule is on"
              />
            </label>
          </div>

          <LivePreview draft={draft} options={options} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave} data-testid="save-rule">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {rule ? "Save changes" : "Create rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KindPicker({
  value,
  onChange,
}: {
  value: "APPROVE" | "BLOCK";
  onChange: (v: "APPROVE" | "BLOCK") => void;
}) {
  const kinds = [
    {
      value: "APPROVE" as const,
      icon: CheckCircle2,
      title: "Approve",
      blurb: "Confirm the signup straight away",
      active: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      value: "BLOCK" as const,
      icon: CircleSlash,
      title: "Block",
      blurb: "Always hold for a person, overriding approvals",
      active: "border-rose-400 bg-rose-50 dark:bg-rose-950/30",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Rule type">
      {kinds.map((kind) => {
        const Icon = kind.icon;
        const selected = value === kind.value;
        return (
          <button
            key={kind.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(kind.value)}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              selected ? kind.active : "hover:bg-muted"
            )}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <span>
              <span className="block text-sm font-medium">{kind.title}</span>
              <span className="block text-sm text-muted-foreground">
                {kind.blurb}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function NumberField({
  id,
  label,
  suffix,
  value,
  onChange,
  placeholder,
  max,
}: {
  id: string;
  label: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          min={0}
          max={max}
          inputMode="numeric"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="tabular-nums"
        />
        <span className="shrink-0 text-sm text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

/**
 * Live answer to "who does this actually catch?" while the rule is still being
 * written. Runs the draft on its own - deliberately not alongside the other
 * rules - so you can see the rule's own reach before worrying about priority.
 */
function LivePreview({
  draft,
  options,
}: {
  draft: Draft;
  options: AdminOptions;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  const payload = useMemo(() => toPayload(draft), [draft]);
  const conditions = countConditions(draft);

  const previewShiftTypeId =
    draft.scope === GLOBAL ? options.shiftTypes[0]?.id : draft.scope;

  useEffect(() => {
    if (conditions === 0 || !previewShiftTypeId) {
      setCount(null);
      return;
    }

    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/auto-approval/coverage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "draft",
            shiftTypeId: previewShiftTypeId,
            location: payload.location,
            daysInAdvance: 7,
            // Totals cover the whole roster; we only pull back a handful of
            // names to show, never all 10k.
            outcome: draft.kind === "BLOCK" ? "BLOCKED" : "APPROVED",
            pageSize: 6,
            draft: { ...payload, name: payload.name || "Draft rule" },
          }),
        });
        if (!res.ok || id !== requestId.current) return;
        const json = await res.json();
        setCount(json.matched);
        setTotal(json.summary.total);
        setNames(
          json.volunteers.map(
            (v: { name: string | null; email: string }) => v.name ?? v.email
          )
        );
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [payload, conditions, previewShiftTypeId, draft.kind]);

  return (
    <aside className="h-fit space-y-3 rounded-lg border bg-muted/30 p-4 lg:sticky lg:top-0">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="font-medium">Who this catches</h3>
      </div>

      {conditions === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a condition and the reach shows up here.
        </p>
      ) : !previewShiftTypeId ? (
        <p className="text-sm text-muted-foreground">
          No shift types exist yet, so there&rsquo;s nothing to preview against.
        </p>
      ) : (
        <div aria-live="polite">
          <p className="text-3xl font-semibold tabular-nums">
            {loading && count === null ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              (count ?? 0).toLocaleString("en-NZ")
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            of {(total ?? 0).toLocaleString("en-NZ")} active volunteers would be{" "}
            {draft.kind === "BLOCK" ? "blocked" : "approved"} by this rule alone
            {draft.scope === GLOBAL
              ? `, on a ${options.shiftTypes[0]?.name ?? "shift"} a week out`
              : " a week out"}
            .
          </p>

          {names.length > 0 && (
            <ul className="mt-3 space-y-1 border-t pt-3 text-sm text-muted-foreground">
              {names.map((n, i) => (
                <li key={`${n}-${i}`} className="truncate">
                  {n}
                </li>
              ))}
              {count !== null && count > names.length && (
                <li className="text-xs">
                  and {(count - names.length).toLocaleString("en-NZ")} more
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      <p className="border-t pt-3 text-xs text-muted-foreground">
        This rule on its own. The Coverage tab shows what happens once every
        rule runs together.
      </p>
    </aside>
  );
}
