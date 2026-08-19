"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowDown,
  CheckCircle2,
  CircleSlash,
  Eye,
  Pencil,
  Plus,
  ShieldQuestion,
  Tag,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  CoverageResults,
  DEFAULT_QUERY,
  fetchCoverage,
  type CoverageQuery,
  type CoverageRequest,
  type CoverageResult,
} from "./coverage-tab";
import { RuleEditor } from "./rule-editor";
import { EmptyState, ScopeBadges, TableSkeleton, type AdminOptions } from "./shared";

export interface SerializedRuleClient {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  kind: "APPROVE" | "BLOCK";
  priority: number;
  global: boolean;
  shiftTypeId: string | null;
  location: string | null;
  shiftType: { id: string; name: string } | null;
  creator: { id: string; name: string | null; email: string };
  minVolunteerGrade: "GREEN" | "YELLOW" | "PINK" | null;
  minCompletedShifts: number | null;
  minAttendanceRate: number | null;
  minAccountAgeDays: number | null;
  maxDaysInAdvance: number | null;
  minVolunteerAge: number | null;
  maxVolunteerAge: number | null;
  requiredLabelIds: string[];
  requireShiftTypeExperience: boolean;
  criteriaLogic: "AND" | "OR";
  archivedAt: string | null;
  requirements: string[];
  criteriaCount: number;
  decisionCount: number;
  approvalCount: number;
}

export function RulesTab({
  rules,
  loading,
  options,
  onRefresh,
}: {
  rules: SerializedRuleClient[];
  loading: boolean;
  options: AdminOptions;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<SerializedRuleClient | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<SerializedRuleClient | null>(
    null
  );
  const [preview, setPreview] = useState<{
    rule: SerializedRuleClient;
    request: CoverageRequest;
  } | null>(null);

  /**
   * Previews one rule on its own against a shift a week out, so an admin can
   * see that rule's own reach without the other rules shadowing it.
   */
  const openPreview = useCallback(
    (rule: SerializedRuleClient) => {
      const shiftTypeId = rule.global
        ? options.shiftTypes[0]?.id
        : rule.shiftTypeId;
      if (!shiftTypeId) {
        toast.error("No shift type to preview this rule against");
        return;
      }
      setPreview({
        rule,
        request: {
          mode: "rule",
          ruleId: rule.id,
          shiftTypeId,
          location: rule.location,
          daysInAdvance: 7,
        },
      });
    },
    [options.shiftTypes]
  );

  const blocks = useMemo(
    () => rules.filter((r) => r.kind === "BLOCK" && !r.archivedAt),
    [rules]
  );
  const approvals = useMemo(
    () => rules.filter((r) => r.kind === "APPROVE" && !r.archivedAt),
    [rules]
  );
  const tagRules = useMemo(
    () => rules.filter((r) => !r.archivedAt && r.requiredLabelIds.length > 0),
    [rules]
  );

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (rule: SerializedRuleClient) => {
    setEditing(rule);
    setEditorOpen(true);
  };

  const toggle = useCallback(
    async (rule: SerializedRuleClient) => {
      const res = await fetch(`/api/admin/auto-approval/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (res.ok) {
        toast.success(`${rule.name} turned ${rule.enabled ? "off" : "on"}`);
        onRefresh();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Couldn't change the rule");
      }
    },
    [onRefresh]
  );

  const archive = useCallback(async () => {
    if (!pendingArchive) return;
    const res = await fetch(
      `/api/admin/auto-approval/rules/${pendingArchive.id}`,
      { method: "DELETE" }
    );
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success(body.message, { description: body.detail });
      onRefresh();
    } else {
      toast.error(body.error ?? "Couldn't remove the rule");
    }
    setPendingArchive(null);
  }, [pendingArchive, onRefresh]);

  if (loading && rules.length === 0) return <TableSkeleton rows={4} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Rules run top to bottom. Blocks are checked first — anyone they catch
          is held for a person no matter what. Then approval rules run in
          priority order and the first match confirms the signup.
        </p>
        <Button onClick={openNew} data-testid="new-rule">
          <Plus className="h-4 w-4" />
          New rule
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4 text-muted-foreground" aria-hidden />
            Per-volunteer overrides
          </CardTitle>
          <CardDescription>
            Tags are how a named individual gets treated differently to
            everyone else. Tag someone under Custom Labels, point a rule at that
            tag, and they&rsquo;re handled by name without loosening the rules
            for anybody else.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tagRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rule uses tags yet. Create one with a volunteer tag condition to
              always approve — or always hold — specific people.
            </p>
          ) : (
            <ul className="space-y-2">
              {tagRules.map((rule) => {
                const labels = rule.requiredLabelIds
                  .map((id) => options.labels.find((l) => l.id === id))
                  .filter((l): l is AdminOptions["labels"][number] => Boolean(l));
                const covered = labels.reduce(
                  (sum, l) => sum + l.volunteerCount,
                  0
                );
                return (
                  <li
                    key={rule.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border p-3"
                  >
                    {rule.kind === "BLOCK" ? (
                      <CircleSlash className="h-4 w-4 text-rose-500" aria-hidden />
                    ) : (
                      <CheckCircle2
                        className="h-4 w-4 text-emerald-500"
                        aria-hidden
                      />
                    )}
                    <span className="text-sm font-medium">{rule.name}</span>
                    {labels.map((l) => (
                      <span
                        key={l.id}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs",
                          l.color
                        )}
                      >
                        {l.icon ? `${l.icon} ` : ""}
                        {l.name}
                      </span>
                    ))}
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {covered} volunteer{covered === 1 ? "" : "s"} tagged
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <RuleGroup
        title="Blocks"
        description="Checked first. Anyone caught here is held for a person, whatever the approval rules say."
        icon={CircleSlash}
        rules={blocks}
        emptyText="No block rules. Nobody is being held deliberately."
        onEdit={openEdit}
        onToggle={toggle}
        onArchive={setPendingArchive}
        onPreview={openPreview}
      />

      <div className="flex items-center justify-center" aria-hidden>
        <ArrowDown className="h-5 w-5 text-muted-foreground/40" />
      </div>

      <RuleGroup
        title="Approvals"
        description="Run in priority order. The first one that matches confirms the signup."
        icon={CheckCircle2}
        rules={approvals}
        emptyText="No approval rules yet, so every signup waits for a person."
        onEdit={openEdit}
        onToggle={toggle}
        onArchive={setPendingArchive}
        onPreview={openPreview}
      />

      <RulePreviewDialog
        preview={preview}
        options={options}
        onClose={() => setPreview(null)}
      />

      <RuleEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        rule={editing}
        options={options}
        onSaved={onRefresh}
      />

      <AlertDialog
        open={pendingArchive !== null}
        onOpenChange={(open) => !open && setPendingArchive(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove &ldquo;{pendingArchive?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingArchive && pendingArchive.decisionCount > 0
                ? `This rule decided ${pendingArchive.decisionCount} signup${pendingArchive.decisionCount === 1 ? "" : "s"}. It will be archived and switched off, so the decision log keeps making sense.`
                : "This rule has never decided anything, so it will be deleted outright."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={archive} data-testid="confirm-archive">
              {pendingArchive && pendingArchive.decisionCount > 0
                ? "Archive"
                : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * One rule's reach, shown over the rules list rather than pushed to the top of
 * it - you stay next to the rule you clicked.
 */
function RulePreviewDialog({
  preview,
  options,
  onClose,
}: {
  preview: { rule: SerializedRuleClient; request: CoverageRequest } | null;
  options: AdminOptions;
  onClose: () => void;
}) {
  const [query, setQuery] = useState<CoverageQuery>(DEFAULT_QUERY);
  const [result, setResult] = useState<CoverageResult | null>(null);
  const [loading, setLoading] = useState(false);

  const ruleId = preview?.rule.id;

  // A fresh rule starts from an unfiltered first page.
  useEffect(() => {
    setQuery(DEFAULT_QUERY);
    setResult(null);
  }, [ruleId]);

  const request = preview?.request;

  const load = useCallback(async () => {
    if (!request) return;
    setLoading(true);
    try {
      setResult(await fetchCoverage(request, query));
    } catch {
      toast.error("Couldn't preview this rule");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [request, query]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Dialog open={preview !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90vh] sm:max-w-3xl overflow-y-auto"
        data-testid="rule-preview-dialog"
      >
        <DialogHeader>
          <DialogTitle>
            Who &ldquo;{preview?.rule.name}&rdquo; catches
          </DialogTitle>
          <DialogDescription>
            This rule on its own, against{" "}
            {preview?.rule.global
              ? (options.shiftTypes[0]?.name ?? "a shift")
              : (preview?.rule.shiftType?.name ?? "its shift type")}
            {preview?.rule.location ? ` at ${preview.rule.location}` : ""} a week
            from now. The Coverage tab shows what happens once every rule runs
            together.
          </DialogDescription>
        </DialogHeader>

        <CoverageResults
          result={result}
          loading={loading}
          query={query}
          onQueryChange={setQuery}
          options={options}
          request={preview?.request ?? null}
          emphasis={preview?.rule.kind === "BLOCK" ? "BLOCKED" : "APPROVED"}
        />
      </DialogContent>
    </Dialog>
  );
}

function RuleGroup({
  title,
  description,
  icon: Icon,
  rules,
  emptyText,
  onEdit,
  onToggle,
  onArchive,
  onPreview,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  rules: SerializedRuleClient[];
  emptyText: string;
  onEdit: (rule: SerializedRuleClient) => void;
  onToggle: (rule: SerializedRuleClient) => void;
  onArchive: (rule: SerializedRuleClient) => void;
  onPreview: (rule: SerializedRuleClient) => void;
}) {
  return (
    <section className="space-y-3" data-testid={`rule-group-${title.toLowerCase()}`}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      {rules.length === 0 ? (
        <Card>
          <EmptyState icon={ShieldQuestion} title={emptyText} className="py-8" />
        </Card>
      ) : (
        <ul className="space-y-3">
          {rules.map((rule) => (
            <li key={rule.id}>
              <RuleCard
                rule={rule}
                onEdit={onEdit}
                onToggle={onToggle}
                onArchive={onArchive}
                onPreview={onPreview}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RuleCard({
  rule,
  onEdit,
  onToggle,
  onArchive,
  onPreview,
}: {
  rule: SerializedRuleClient;
  onEdit: (rule: SerializedRuleClient) => void;
  onToggle: (rule: SerializedRuleClient) => void;
  onArchive: (rule: SerializedRuleClient) => void;
  onPreview: (rule: SerializedRuleClient) => void;
}) {
  const inert = rule.criteriaCount === 0;

  return (
    <Card
      className={cn(
        "transition-opacity",
        !rule.enabled && "opacity-60",
        rule.kind === "BLOCK" &&
          rule.enabled &&
          "border-rose-200 dark:border-rose-900"
      )}
      data-testid="rule-card"
    >
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">{rule.name}</h3>
              <Badge variant="outline" className="tabular-nums">
                Priority {rule.priority}
              </Badge>
              {!rule.enabled && <Badge variant="secondary">Off</Badge>}
            </div>
            {rule.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {rule.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPreview(rule)}
              aria-label={`Preview who ${rule.name} catches`}
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(rule)}
              aria-label={`Edit ${rule.name}`}
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onArchive(rule)}
              aria-label={`Remove ${rule.name}`}
            >
              <Archive className="h-4 w-4" />
            </Button>
            <Switch
              checked={rule.enabled}
              onCheckedChange={() => onToggle(rule)}
              aria-label={`${rule.name} is ${rule.enabled ? "on" : "off"}`}
            />
          </div>
        </div>

        <ScopeBadges
          global={rule.global}
          shiftTypeName={rule.shiftType?.name ?? null}
          location={rule.location}
        />

        {inert ? (
          <p className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
            No conditions set — this rule can never match anyone.
          </p>
        ) : (
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {rule.kind === "BLOCK" ? "Holds anyone" : "Approves anyone"}{" "}
              {rule.criteriaLogic === "AND" ? "who is" : "who is any of"}
            </p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {rule.requirements.map((req, i) => (
                <li key={req} className="flex gap-2">
                  <span className="text-muted-foreground">
                    {i === 0 ? "" : rule.criteriaLogic === "AND" ? "and" : "or"}
                  </span>
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted-foreground tabular-nums">
          Decided {rule.decisionCount} signup
          {rule.decisionCount === 1 ? "" : "s"}
          {rule.approvalCount > 0 && ` · confirmed ${rule.approvalCount}`} ·
          created by {rule.creator.name ?? rule.creator.email}
        </p>
      </CardContent>
    </Card>
  );
}
