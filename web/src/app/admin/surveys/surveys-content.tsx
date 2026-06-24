"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Edit,
  Trash2,
  Users,
  ClipboardList,
  Power,
  UserPlus,
  MoreHorizontal,
  Search,
  BarChart3,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { SurveyDialog } from "./survey-dialog";
import { AssignSurveyDialog } from "./assign-survey-dialog";
import { BulkAssignSurveyDialog } from "./bulk-assign-survey-dialog";
import {
  CompletionRing,
  CountChip,
  StatTile,
  StatusBar,
  TRIGGER_META,
} from "./_components/survey-ui";
import { useToast } from "@/hooks/use-toast";
import { useAdminPageTitle } from "@/hooks/use-admin-page-title";
import { cn } from "@/lib/utils";
import type { Survey, SurveyTriggerType } from "@/generated/client";
import Link from "next/link";

type SurveyWithStats = Survey & {
  creator: {
    id: string;
    name: string | null;
    email: string;
  };
  _count: {
    assignments: number;
  };
  stats: {
    totalAssignments: number;
    pending: number;
    completed: number;
    dismissed: number;
    expired: number;
  };
};

interface SurveysContentProps {
  initialSurveys: SurveyWithStats[];
}

type StatusFilter = "all" | "active" | "inactive";

function completionRate(s: SurveyWithStats["stats"]) {
  return s.totalAssignments > 0
    ? Math.round((s.completed / s.totalAssignments) * 100)
    : 0;
}

export function SurveysContent({ initialSurveys }: SurveysContentProps) {
  const [surveys, setSurveys] = useState<SurveyWithStats[]>(initialSurveys);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<SurveyWithStats | null>(
    null
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [surveyToDelete, setSurveyToDelete] = useState<SurveyWithStats | null>(
    null
  );
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [surveyToAssign, setSurveyToAssign] = useState<SurveyWithStats | null>(
    null
  );
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [surveyToBulkAssign, setSurveyToBulkAssign] =
    useState<SurveyWithStats | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [triggerFilter, setTriggerFilter] = useState<SurveyTriggerType | "all">(
    "all"
  );

  const { toast } = useToast();

  /* ----------------------------- mutations ------------------------------- */

  const handleCreateSurvey = async (data: {
    title: string;
    description?: string;
    questions: unknown[];
    triggerType: SurveyTriggerType;
    triggerValue: number;
    triggerMaxValue?: number | null;
    isActive?: boolean;
  }) => {
    try {
      const response = await fetch("/api/admin/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create survey");
      }

      const newSurvey = await response.json();
      setSurveys((prev) => [
        {
          ...newSurvey,
          _count: { assignments: 0 },
          stats: {
            totalAssignments: 0,
            pending: 0,
            completed: 0,
            dismissed: 0,
            expired: 0,
          },
        },
        ...prev,
      ]);

      toast({ title: "Success", description: "Survey created successfully" });
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create survey",
        variant: "destructive",
      });
    }
  };

  const handleUpdateSurvey = async (
    id: string,
    data: {
      title?: string;
      description?: string;
      questions?: unknown[];
      triggerType?: SurveyTriggerType;
      triggerValue?: number;
      triggerMaxValue?: number | null;
      isActive?: boolean;
    }
  ) => {
    try {
      const response = await fetch(`/api/admin/surveys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update survey");
      }

      const updatedSurvey = await response.json();
      setSurveys((prev) =>
        prev.map((survey) =>
          survey.id === id
            ? { ...updatedSurvey, _count: survey._count, stats: survey.stats }
            : survey
        )
      );

      toast({ title: "Success", description: "Survey updated successfully" });
      setDialogOpen(false);
      setEditingSurvey(null);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update survey",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (survey: SurveyWithStats) => {
    await handleUpdateSurvey(survey.id, { isActive: !survey.isActive });
  };

  const handleDeleteSurvey = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/surveys/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete survey");
      }

      const result = await response.json();

      if (result.deactivated) {
        setSurveys((prev) =>
          prev.map((survey) =>
            survey.id === id ? { ...survey, isActive: false } : survey
          )
        );
        toast({
          title: "Survey Deactivated",
          description:
            "Survey has existing responses and was deactivated instead of deleted",
        });
      } else {
        setSurveys((prev) => prev.filter((survey) => survey.id !== id));
        toast({ title: "Success", description: "Survey deleted successfully" });
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete survey",
        variant: "destructive",
      });
    }
  };

  const confirmDeleteSurvey = async () => {
    if (surveyToDelete) {
      await handleDeleteSurvey(surveyToDelete.id);
      setDeleteDialogOpen(false);
      setSurveyToDelete(null);
    }
  };

  const openCreateDialog = () => {
    setEditingSurvey(null);
    setDialogOpen(true);
  };

  const headerActions = useMemo(
    () => (
      <Button
        size="sm"
        onClick={() => {
          setEditingSurvey(null);
          setDialogOpen(true);
        }}
        data-testid="create-survey-button"
      >
        <Plus className="mr-2 h-4 w-4" />
        Create survey
      </Button>
    ),
    []
  );

  useAdminPageTitle(
    "Surveys",
    "Design, deploy and track volunteer feedback across the motu.",
    headerActions
  );

  const handleAssignmentComplete = () => {
    window.location.reload();
  };

  /* ----------------------------- derived --------------------------------- */

  const overview = useMemo(() => {
    const active = surveys.filter((s) => s.isActive).length;
    const responses = surveys.reduce((sum, s) => sum + s.stats.completed, 0);
    const totalAssigned = surveys.reduce(
      (sum, s) => sum + s.stats.totalAssignments,
      0
    );
    const avgCompletion =
      totalAssigned > 0 ? Math.round((responses / totalAssigned) * 100) : 0;
    return { active, responses, avgCompletion, total: surveys.length };
  }, [surveys]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return surveys.filter((s) => {
      if (statusFilter === "active" && !s.isActive) return false;
      if (statusFilter === "inactive" && s.isActive) return false;
      if (triggerFilter !== "all" && s.triggerType !== triggerFilter)
        return false;
      if (q) {
        const haystack = `${s.title} ${s.description ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [surveys, query, statusFilter, triggerFilter]);

  const triggerOptions: (SurveyTriggerType | "all")[] = [
    "all",
    "SHIFTS_COMPLETED",
    "HOURS_VOLUNTEERED",
    "FIRST_SHIFT",
    "MANUAL",
  ];

  /* ------------------------------ render --------------------------------- */

  return (
    <div className="space-y-6">
      {/* Overview KPIs */}
      {surveys.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            icon={ClipboardList}
            label="Surveys"
            value={overview.total}
            hint={`${overview.active} active`}
            iconWrap="bg-[var(--ee-primary-light)] text-[var(--ee-primary-text)]"
          />
          <StatTile
            icon={Power}
            label="Active"
            value={overview.active}
            hint={
              overview.total - overview.active > 0
                ? `${overview.total - overview.active} paused`
                : "all live"
            }
            accent="text-emerald-600 dark:text-emerald-400"
            iconWrap="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          />
          <StatTile
            icon={Inbox}
            label="Responses"
            value={overview.responses.toLocaleString()}
            hint="completed to date"
            iconWrap="bg-sky-500/10 text-sky-600 dark:text-sky-400"
          />
          <StatTile
            icon={BarChart3}
            label="Avg completion"
            value={`${overview.avgCompletion}%`}
            hint="across all assignments"
            accent="text-[var(--ee-primary-text)]"
            iconWrap="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          />
        </div>
      )}

      {/* Toolbar */}
      {surveys.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search surveys…"
              className="pl-9"
              data-testid="survey-search"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
              {(["all", "active", "inactive"] as StatusFilter[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setStatusFilter(opt)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                    statusFilter === opt
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {triggerOptions.map((opt) => {
                const active = triggerFilter === opt;
                const label =
                  opt === "all" ? "All triggers" : TRIGGER_META[opt].label;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setTriggerFilter(opt)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-transparent bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty / list */}
      {surveys.length === 0 ? (
        <EmptyState onCreate={openCreateDialog} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Search className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No surveys match your filters</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
              setTriggerFilter("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filtered.map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              onEdit={() => {
                setEditingSurvey(survey);
                setDialogOpen(true);
              }}
              onAssign={() => {
                setSurveyToAssign(survey);
                setAssignDialogOpen(true);
              }}
              onBulkAssign={() => {
                setSurveyToBulkAssign(survey);
                setBulkAssignDialogOpen(true);
              }}
              onToggle={() => handleToggleActive(survey)}
              onDelete={() => {
                setSurveyToDelete(survey);
                setDeleteDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <SurveyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        survey={editingSurvey}
        onSave={
          editingSurvey
            ? (data) => handleUpdateSurvey(editingSurvey.id, data)
            : handleCreateSurvey
        }
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete survey
            </AlertDialogTitle>
            <AlertDialogDescription>
              {surveyToDelete?.stats.totalAssignments &&
              surveyToDelete.stats.totalAssignments > 0 ? (
                <>
                  This survey has {surveyToDelete.stats.totalAssignments}{" "}
                  assignment(s). It will be deactivated instead of deleted to
                  preserve historical data.
                </>
              ) : (
                "Are you sure you want to delete this survey? This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSurvey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {surveyToDelete?.stats.totalAssignments &&
              surveyToDelete.stats.totalAssignments > 0
                ? "Deactivate"
                : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {surveyToAssign && (
        <AssignSurveyDialog
          survey={surveyToAssign}
          open={assignDialogOpen}
          onOpenChange={(open) => {
            setAssignDialogOpen(open);
            if (!open) setSurveyToAssign(null);
          }}
          onAssigned={handleAssignmentComplete}
        />
      )}

      {surveyToBulkAssign && (
        <BulkAssignSurveyDialog
          survey={surveyToBulkAssign}
          open={bulkAssignDialogOpen}
          onOpenChange={(open) => {
            setBulkAssignDialogOpen(open);
            if (!open) setSurveyToBulkAssign(null);
          }}
          onAssigned={handleAssignmentComplete}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Survey card                                                                 */
/* -------------------------------------------------------------------------- */

function SurveyCard({
  survey,
  onEdit,
  onAssign,
  onBulkAssign,
  onToggle,
  onDelete,
}: {
  survey: SurveyWithStats;
  onEdit: () => void;
  onAssign: () => void;
  onBulkAssign: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const trigger = TRIGGER_META[survey.triggerType];
  const TriggerIcon = trigger.icon;
  const rate = completionRate(survey.stats);
  const triggerRange =
    survey.triggerType === "MANUAL"
      ? null
      : survey.triggerMaxValue
      ? `${survey.triggerValue}–${survey.triggerMaxValue}`
      : `${survey.triggerValue}+`;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md",
        !survey.isActive && "opacity-75"
      )}
      data-testid={`survey-card-${survey.id}`}
    >
      {/* status accent rail */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          survey.isActive ? "bg-[var(--ee-primary-text)]" : "bg-muted"
        )}
      />

      <div className="flex flex-col gap-4 p-5 pl-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold leading-tight">
                {survey.title}
              </h3>
              {survey.isActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              ) : (
                <Badge variant="secondary" className="text-[11px]">
                  Inactive
                </Badge>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <TriggerIcon className={cn("h-3.5 w-3.5", trigger.accent)} />
              <span className="font-medium text-foreground/80">
                {trigger.label}
              </span>
              {triggerRange && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] tabular-nums">
                  {triggerRange}
                </span>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground"
                data-testid={`survey-actions-${survey.id}`}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Survey actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Manage</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={onEdit}
                data-testid={`edit-survey-${survey.id}`}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit survey
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onAssign}
                data-testid={`assign-survey-${survey.id}`}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Assign to users
              </DropdownMenuItem>
              {survey.triggerType !== "MANUAL" && (
                <DropdownMenuItem
                  onClick={onBulkAssign}
                  data-testid={`bulk-assign-survey-${survey.id}`}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Bulk assign
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={onToggle}
                data-testid={`toggle-survey-${survey.id}`}
              >
                <Power className="mr-2 h-4 w-4" />
                {survey.isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
                data-testid={`delete-survey-${survey.id}`}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {survey.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {survey.description}
          </p>
        )}

        {/* Metrics */}
        <div className="flex items-center gap-4 rounded-lg bg-muted/40 p-3">
          <CompletionRing value={rate} sublabel="done" />
          <div className="min-w-0 flex-1 space-y-2">
            {survey.stats.totalAssignments === 0 ? (
              <p className="text-sm text-muted-foreground">
                Not assigned to anyone yet.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    {survey.stats.totalAssignments} assigned
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {survey.stats.completed}/{survey.stats.totalAssignments}
                  </span>
                </div>
                <StatusBar
                  segments={[
                    { key: "completed", value: survey.stats.completed },
                    { key: "pending", value: survey.stats.pending },
                    { key: "dismissed", value: survey.stats.dismissed },
                    { key: "expired", value: survey.stats.expired },
                  ]}
                />
                <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                  <CountChip status="completed" value={survey.stats.completed} />
                  <CountChip status="pending" value={survey.stats.pending} />
                  {survey.stats.dismissed > 0 && (
                    <CountChip
                      status="dismissed"
                      value={survey.stats.dismissed}
                    />
                  )}
                  {survey.stats.expired > 0 && (
                    <CountChip status="expired" value={survey.stats.expired} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <p className="truncate text-xs text-muted-foreground">
            By {survey.creator.name || survey.creator.email}
          </p>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="shrink-0"
            data-testid={`view-responses-${survey.id}`}
          >
            <Link href={`/admin/surveys/${survey.id}/responses`}>
              View responses
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Empty state                                                                 */
/* -------------------------------------------------------------------------- */

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-card/50 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ee-primary-light)]">
        <ClipboardList className="h-7 w-7 text-[var(--ee-primary-text)]" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">No surveys yet</h3>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Create your first survey to start gathering feedback from your
          volunteer whānau.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Plus className="mr-2 h-4 w-4" />
        Create first survey
      </Button>
    </div>
  );
}
