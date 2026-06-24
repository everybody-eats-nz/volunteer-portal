"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  ChevronDown,
  ArrowLeft,
  MapPin,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Download,
  Shield,
  CalendarDays,
  Hash,
  X,
  MessageSquareQuote,
  Star,
  ListChecks,
  ToggleLeft,
  Type,
  ArrowDownUp,
  UserSearch,
} from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { SurveyQuestion, SurveyQuestionType } from "@/types/survey";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  CompletionRing,
  STATUS_META,
  STATUS_ORDER,
  type AssignmentStatusKey,
} from "../../_components/survey-ui";

/* -------------------------------------------------------------------------- */
/*  Types                                                                       */
/* -------------------------------------------------------------------------- */

interface QuestionStats {
  questionId: string;
  questionText: string;
  questionType: string;
  totalResponses: number;
  distribution?: Record<string, number>;
  average?: number;
  textResponses?: string[];
}

interface UserData {
  id: string;
  name: string | null;
  email: string;
  defaultLocation?: string | null;
  createdAt: Date | string;
  volunteerGrade?: string;
  completedShifts?: number;
}

type AnswerValue = string | string[] | number | boolean | null;

interface ResponseData {
  id: string;
  user: UserData;
  completedAt: Date | null;
  answers?: Array<{ questionId: string; value: AnswerValue }>;
}

interface AssignmentData {
  id: string;
  status: string;
  assignedAt: Date;
  completedAt: Date | null;
  dismissedAt: Date | null;
  user: UserData;
}

/** A single person the survey reached, plus their answers if completed. */
type Respondent = AssignmentData & {
  answers?: Array<{ questionId: string; value: AnswerValue }>;
};

interface ResponsesContentProps {
  survey: {
    id: string;
    title: string;
    description: string | null;
    questions: SurveyQuestion[];
  };
  totalResponses: number;
  questionStats: QuestionStats[];
  responses: ResponseData[];
  assignments: AssignmentData[];
  locations: string[];
  selectedLocation?: string;
  selectedGrade?: string;
  selectedTenure?: string;
  selectedShifts?: string;
}

const QUESTION_ICON: Record<SurveyQuestionType, typeof Type> = {
  text_short: Type,
  text_long: MessageSquareQuote,
  multiple_choice_single: ListChecks,
  multiple_choice_multi: ListChecks,
  rating_scale: Star,
  yes_no: ToggleLeft,
};

type View = "insights" | "respondents";
type StatusFilter = "all" | AssignmentStatusKey;
type SortKey = "recent" | "name" | "shifts" | "member";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Latest activity",
  name: "Name",
  shifts: "Shifts completed",
  member: "Time as member",
};

/* -------------------------------------------------------------------------- */
/*  Main                                                                        */
/* -------------------------------------------------------------------------- */

export function ResponsesContent({
  survey,
  totalResponses,
  questionStats,
  responses,
  assignments,
  locations,
  selectedLocation,
  selectedGrade,
  selectedTenure,
  selectedShifts,
}: ResponsesContentProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [view, setView] = useState<View>(
    totalResponses > 0 ? "insights" : "respondents"
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  /* ----------------------------- merge data ------------------------------ */

  const respondents = useMemo<Respondent[]>(() => {
    const answersById = new Map(responses.map((r) => [r.id, r.answers]));
    return assignments.map((a) => ({ ...a, answers: answersById.get(a.id) }));
  }, [assignments, responses]);

  const statusOf = (a: AssignmentData): AssignmentStatusKey =>
    a.status.toLowerCase() as AssignmentStatusKey;

  const updateTime = (a: AssignmentData) =>
    a.completedAt
      ? new Date(a.completedAt).getTime()
      : a.dismissedAt
      ? new Date(a.dismissedAt).getTime()
      : new Date(a.assignedAt).getTime();

  /* ----------------------------- stats ----------------------------------- */

  const counts = useMemo(() => {
    const c: Record<AssignmentStatusKey, number> = {
      completed: 0,
      pending: 0,
      dismissed: 0,
      expired: 0,
    };
    assignments.forEach((a) => {
      const k = statusOf(a);
      if (k in c) c[k] += 1;
    });
    return c;
  }, [assignments]);

  const total = assignments.length;
  const completionRate =
    total > 0 ? Math.round((counts.completed / total) * 100) : 0;

  /* ----------------------------- filtered list --------------------------- */

  const visibleRespondents = useMemo(() => {
    const filtered =
      statusFilter === "all"
        ? respondents
        : respondents.filter((r) => statusOf(r) === statusFilter);

    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return (a.user.name || "").localeCompare(b.user.name || "");
        case "shifts":
          return (b.user.completedShifts || 0) - (a.user.completedShifts || 0);
        case "member":
          return (
            new Date(a.user.createdAt).getTime() -
            new Date(b.user.createdAt).getTime()
          );
        case "recent":
        default:
          return updateTime(b) - updateTime(a);
      }
    });
    return sorted;
  }, [respondents, statusFilter, sortKey]);

  /* ----------------------------- filters --------------------------------- */

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams();
    const filters: Record<string, string | undefined> = {
      location: selectedLocation,
      grade: selectedGrade,
      tenure: selectedTenure,
      shifts: selectedShifts,
    };
    filters[key] = value === "all" ? undefined : value;
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const activeFilters = [
    selectedLocation && { key: "location", label: selectedLocation },
    selectedGrade && {
      key: "grade",
      label: selectedGrade.charAt(0) + selectedGrade.slice(1).toLowerCase(),
    },
    selectedTenure && {
      key: "tenure",
      label: TENURE_LABELS[selectedTenure] ?? selectedTenure,
    },
    selectedShifts && {
      key: "shifts",
      label: SHIFT_LABELS[selectedShifts] ?? selectedShifts,
    },
  ].filter(Boolean) as { key: string; label: string }[];

  /* ----------------------------- helpers --------------------------------- */

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const formatValue = (value: AnswerValue | undefined): string => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  };

  const exportCsv = () => {
    const escapeCsv = (value: string) =>
      /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    const headers = [
      "Volunteer Name",
      "Email",
      "Completed At",
      ...survey.questions.map((q) => q.text),
    ];
    const rows = responses.map((response) => [
      response.user.name || "Unknown",
      response.user.email,
      response.completedAt ? new Date(response.completedAt).toISOString() : "-",
      ...survey.questions.map((question) =>
        formatValue(
          response.answers?.find((a) => a.questionId === question.id)?.value
        )
      ),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${survey.title.replace(/[^a-zA-Z0-9]/g, "-")}-responses.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ------------------------------ render --------------------------------- */

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="-ml-2 h-8 text-muted-foreground hover:text-foreground"
      >
        <Link href="/admin/surveys">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to surveys
        </Link>
      </Button>

      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <CompletionRing
              value={completionRate}
              size={104}
              stroke={9}
              sublabel="complete"
            />
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                {survey.title}
              </h2>
              {survey.description && (
                <p className="mt-1 line-clamp-2 max-w-xl text-sm text-muted-foreground">
                  {survey.description}
                </p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="font-semibold tabular-nums text-foreground">
                  {counts.completed}
                </span>{" "}
                of{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {total}
                </span>{" "}
                volunteers responded
                {activeFilters.length > 0 && (
                  <span className="ml-1 text-xs">(filtered)</span>
                )}
              </p>
            </div>
          </div>

          {totalResponses > 0 && (
            <Button
              variant="outline"
              onClick={exportCsv}
              data-testid="survey-export-csv"
              className="shrink-0 self-start lg:self-center"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>

        {total > 0 && (
          <div className="grid grid-cols-2 divide-x divide-y border-t sm:grid-cols-4 sm:divide-y-0">
            <StatusCell
              icon={CheckCircle2}
              label="Completed"
              value={counts.completed}
              statusKey="completed"
              extra={`${completionRate}%`}
            />
            <StatusCell
              icon={Clock}
              label="Pending"
              value={counts.pending}
              statusKey="pending"
            />
            <StatusCell
              icon={XCircle}
              label="Dismissed"
              value={counts.dismissed}
              statusKey="dismissed"
            />
            <StatusCell
              icon={AlertCircle}
              label="Expired"
              value={counts.expired}
              statusKey="expired"
            />
          </div>
        )}
      </section>

      {/* Demographic filters */}
      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Filter
          </span>
          {locations.length > 0 && (
            <FilterSelect
              icon={MapPin}
              value={selectedLocation || "all"}
              onValueChange={(v) => handleFilterChange("location", v)}
              placeholder="Location"
              testId="survey-location-filter"
              options={[
                { value: "all", label: "All locations" },
                ...locations.map((loc) => ({ value: loc, label: loc })),
              ]}
            />
          )}
          <FilterSelect
            icon={Shield}
            value={selectedGrade || "all"}
            onValueChange={(v) => handleFilterChange("grade", v)}
            placeholder="Grade"
            testId="survey-grade-filter"
            options={[
              { value: "all", label: "All grades" },
              { value: "GREEN", label: "Green" },
              { value: "YELLOW", label: "Yellow" },
              { value: "PINK", label: "Pink" },
            ]}
          />
          <FilterSelect
            icon={CalendarDays}
            value={selectedTenure || "all"}
            onValueChange={(v) => handleFilterChange("tenure", v)}
            placeholder="Tenure"
            testId="survey-tenure-filter"
            options={[
              { value: "all", label: "All tenures" },
              { value: "lt1m", label: "Less than 1 month" },
              { value: "1-3m", label: "1-3 months" },
              { value: "3-6m", label: "3-6 months" },
              { value: "6-12m", label: "6-12 months" },
              { value: "gt1y", label: "Over 1 year" },
            ]}
          />
          <FilterSelect
            icon={Hash}
            value={selectedShifts || "all"}
            onValueChange={(v) => handleFilterChange("shifts", v)}
            placeholder="Shifts"
            testId="survey-shifts-filter"
            options={[
              { value: "all", label: "All shift counts" },
              { value: "0-5", label: "0-5 shifts" },
              { value: "6-15", label: "6-15 shifts" },
              { value: "16-30", label: "16-30 shifts" },
              { value: "31-50", label: "31-50 shifts" },
              { value: "gt50", label: "50+ shifts" },
            ]}
          />
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            {activeFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => handleFilterChange(f.key, "all")}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--ee-primary-light)] px-2.5 py-1 text-xs font-medium text-[var(--ee-primary-text)] transition-colors hover:bg-[var(--ee-primary-light)]/70"
              >
                {f.label}
                <X className="h-3 w-3" />
              </button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(pathname)}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* View switcher */}
      <div className="inline-flex w-full rounded-xl border bg-muted/40 p-1 sm:w-auto">
        <ViewTab
          active={view === "insights"}
          onClick={() => setView("insights")}
          icon={BarChart3}
          label="Insights"
          disabled={totalResponses === 0}
        />
        <ViewTab
          active={view === "respondents"}
          onClick={() => setView("respondents")}
          icon={Users}
          label={`Respondents · ${total}`}
        />
      </div>

      {/* Insights */}
      {view === "insights" &&
        (totalResponses === 0 ? (
          <EmptyPanel
            icon={BarChart3}
            title="No responses yet"
            body="Once volunteers complete this survey, aggregated insights will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {questionStats.map((qStats, idx) => (
              <QuestionSummaryCard
                key={qStats.questionId}
                index={idx + 1}
                stats={qStats}
                question={survey.questions.find(
                  (q) => q.id === qStats.questionId
                )}
              />
            ))}
          </div>
        ))}

      {/* Respondents */}
      {view === "respondents" && (
        <div className="space-y-3">
          {/* status filter + sort */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusChip
                label="All"
                count={total}
                active={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
              />
              {STATUS_ORDER.map((key) => (
                <StatusChip
                  key={key}
                  label={STATUS_META[key].label}
                  count={counts[key]}
                  swatch={STATUS_META[key].swatch}
                  active={statusFilter === key}
                  onClick={() => setStatusFilter(key)}
                  disabled={counts[key] === 0}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
              <Select
                value={sortKey}
                onValueChange={(v) => setSortKey(v as SortKey)}
              >
                <SelectTrigger className="h-9 w-[180px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {SORT_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* list */}
          {visibleRespondents.length === 0 ? (
            <EmptyPanel
              icon={UserSearch}
              title="No one here"
              body={
                statusFilter === "all"
                  ? "This survey hasn't been assigned to anyone matching the current filters."
                  : `No ${statusFilter} respondents match the current filters.`
              }
            />
          ) : (
            <div className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
              {visibleRespondents.map((r) => (
                <RespondentRow
                  key={r.id}
                  respondent={r}
                  questions={survey.questions}
                  expanded={expanded.has(r.id)}
                  onToggle={() => toggleExpand(r.id)}
                  updateLabel={respondentTimeLabel(r)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Respondent row                                                              */
/* -------------------------------------------------------------------------- */

function respondentTimeLabel(r: AssignmentData): string {
  if (r.status === "COMPLETED" && r.completedAt)
    return `Completed ${formatDistanceToNow(new Date(r.completedAt), {
      addSuffix: true,
    })}`;
  if (r.status === "DISMISSED" && r.dismissedAt)
    return `Dismissed ${formatDistanceToNow(new Date(r.dismissedAt), {
      addSuffix: true,
    })}`;
  return `Assigned ${formatDistanceToNow(new Date(r.assignedAt), {
    addSuffix: true,
  })}`;
}

function RespondentRow({
  respondent: r,
  questions,
  expanded,
  onToggle,
  updateLabel,
}: {
  respondent: Respondent;
  questions: SurveyQuestion[];
  expanded: boolean;
  onToggle: () => void;
  updateLabel: string;
}) {
  const isCompleted = r.status === "COMPLETED";
  const canExpand = isCompleted && !!r.answers;
  const meta = STATUS_META[r.status.toLowerCase() as AssignmentStatusKey];

  return (
    <div className={cn(expanded && "bg-muted/30")}>
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 transition-colors",
          canExpand && "cursor-pointer hover:bg-muted/40"
        )}
        onClick={canExpand ? onToggle : undefined}
        role={canExpand ? "button" : undefined}
        aria-expanded={canExpand ? expanded : undefined}
      >
        <Avatar name={r.user.name} />

        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/volunteers/${r.user.id}`}
            className="font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {r.user.name || "Unknown"}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="truncate">{r.user.email}</span>
          </div>
        </div>

        {/* meta — hidden on small screens */}
        <div className="hidden w-40 shrink-0 flex-col items-end gap-0.5 text-xs text-muted-foreground lg:flex">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {r.user.defaultLocation || "No location"}
          </span>
          <span className="tabular-nums">
            {r.user.completedShifts ?? 0} shifts ·{" "}
            {formatDistanceToNow(new Date(r.user.createdAt))} member
          </span>
        </div>

        {/* status + time */}
        <div className="flex w-36 shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
              meta.soft,
              meta.text
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.swatch)} />
            {r.status.toLowerCase()}
          </span>
          <span className="text-right text-[11px] text-muted-foreground">
            {updateLabel}
          </span>
        </div>

        <div className="w-5 shrink-0">
          {canExpand && (
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                expanded && "rotate-180"
              )}
            />
          )}
        </div>
      </div>

      {expanded && canExpand && (
        <div className="border-t bg-muted/20 px-4 py-1.5 sm:pl-16">
          <AnswerList questions={questions} answers={r.answers} />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Answer transcript                                                           */
/* -------------------------------------------------------------------------- */

type AnswerKind = "scalar" | "chips" | "prose";

function answerKind(type: string): AnswerKind {
  if (type === "multiple_choice_multi") return "chips";
  if (type === "text_short" || type === "text_long") return "prose";
  return "scalar"; // yes_no, rating_scale, multiple_choice_single
}

function AnswerList({
  questions,
  answers,
}: {
  questions: SurveyQuestion[];
  answers?: Array<{ questionId: string; value: AnswerValue }>;
}) {
  return (
    <dl className="divide-y divide-border/50">
      {questions.map((q) => {
        const value = answers?.find((a) => a.questionId === q.id)?.value;
        const kind = answerKind(q.type);

        if (kind === "scalar") {
          return (
            <div
              key={q.id}
              className="flex items-start justify-between gap-4 py-3 first:pt-1 last:pb-1"
            >
              <dt className="text-sm font-medium leading-snug text-foreground/90">
                {q.text}
              </dt>
              <dd className="shrink-0">
                <ScalarValue question={q} value={value} />
              </dd>
            </div>
          );
        }

        return (
          <div key={q.id} className="py-3 first:pt-1 last:pb-1">
            <dt className="text-sm font-medium leading-snug text-foreground/90">
              {q.text}
            </dt>
            <dd className="mt-2">
              {kind === "chips" ? (
                <ChipsValue value={value} />
              ) : (
                <ProseValue value={value} />
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function NoAnswer({ block = false }: { block?: boolean }) {
  return (
    <span
      className={cn(
        "text-sm italic text-muted-foreground/50",
        block && "block"
      )}
    >
      No answer
    </span>
  );
}

const BADGE = "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium";

function ScalarValue({
  question,
  value,
}: {
  question: SurveyQuestion;
  value: AnswerValue | undefined;
}) {
  if (value === null || value === undefined || value === "") return <NoAnswer />;

  if (question.type === "yes_no") {
    const yes = value === true || value === "Yes" || value === "yes";
    return (
      <span
        className={cn(
          BADGE,
          yes
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-slate-400/10 text-slate-500 dark:text-slate-400"
        )}
      >
        {yes ? "Yes" : "No"}
      </span>
    );
  }

  if (question.type === "rating_scale") {
    const max = question.maxValue ?? 5;
    return (
      <span
        className={cn(
          BADGE,
          "bg-[var(--ee-primary-light)] text-[var(--ee-primary-text)]"
        )}
      >
        <Star className="h-3.5 w-3.5 fill-current" />
        <span className="tabular-nums">{String(value)}</span>
        <span className="font-normal opacity-60">/ {max}</span>
      </span>
    );
  }

  return (
    <span className={cn(BADGE, "bg-muted text-foreground")}>
      {String(value)}
    </span>
  );
}

function ChipsValue({ value }: { value: AnswerValue | undefined }) {
  const values = Array.isArray(value)
    ? value
    : value === null || value === undefined || value === ""
    ? []
    : [value];

  if (values.length === 0) return <NoAnswer block />;

  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-sm font-medium text-foreground"
        >
          {String(v)}
        </span>
      ))}
    </div>
  );
}

function ProseValue({ value }: { value: AnswerValue | undefined }) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return <NoAnswer block />;
  return (
    <p className="max-w-prose whitespace-pre-wrap border-l-2 border-[var(--ee-primary-text)]/30 pl-3 text-sm leading-relaxed text-foreground/80">
      {text}
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small components                                                            */
/* -------------------------------------------------------------------------- */

const TENURE_LABELS: Record<string, string> = {
  lt1m: "< 1 month",
  "1-3m": "1-3 months",
  "3-6m": "3-6 months",
  "6-12m": "6-12 months",
  gt1y: "Over 1 year",
};

const SHIFT_LABELS: Record<string, string> = {
  "0-5": "0-5 shifts",
  "6-15": "6-15 shifts",
  "16-30": "16-30 shifts",
  "31-50": "31-50 shifts",
  gt50: "50+ shifts",
};

function ViewTab({
  active,
  onClick,
  icon: Icon,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof BarChart3;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-initial",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40 hover:text-muted-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function StatusChip({
  label,
  count,
  swatch,
  active,
  onClick,
  disabled,
}: {
  label: string;
  count: number;
  swatch?: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40 hover:text-muted-foreground"
      )}
    >
      {swatch && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            active ? "bg-background" : swatch
          )}
        />
      )}
      {label}
      <span
        className={cn(
          "tabular-nums",
          active ? "text-background/70" : "text-muted-foreground/70"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function StatusCell({
  icon: Icon,
  label,
  value,
  statusKey,
  extra,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  statusKey: AssignmentStatusKey;
  extra?: string;
}) {
  const meta = STATUS_META[statusKey];
  return (
    <div className="flex items-center gap-3 p-4">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          meta.soft,
          meta.text
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className={cn("text-xl font-bold tabular-nums", meta.text)}>
            {value}
          </span>
          {extra && (
            <span className="text-xs font-medium text-muted-foreground">
              {extra}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function FilterSelect({
  icon: Icon,
  value,
  onValueChange,
  placeholder,
  testId,
  options,
}: {
  icon: typeof MapPin;
  value: string;
  onValueChange: (v: string) => void;
  placeholder: string;
  testId: string;
  options: { value: string; label: string }[];
}) {
  const isActive = value !== "all";
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          "h-9 w-auto gap-1.5 text-sm",
          isActive &&
            "border-[var(--ee-primary-text)]/40 bg-[var(--ee-primary-light)]"
        )}
        data-testid={testId}
      >
        <Icon
          className={cn(
            "h-4 w-4",
            isActive ? "text-[var(--ee-primary-text)]" : "text-muted-foreground"
          )}
        />
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Avatar({ name }: { name: string | null }) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ee-primary-light)] text-xs font-semibold text-[var(--ee-primary-text)]">
      {initials}
    </span>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof BarChart3;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/50 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

/* ----------------------------- summary card ----------------------------- */

function QuestionSummaryCard({
  index,
  stats,
  question,
}: {
  index: number;
  stats: QuestionStats;
  question?: SurveyQuestion;
}) {
  const Icon =
    QUESTION_ICON[(stats.questionType as SurveyQuestionType) ?? "text_short"] ??
    Type;
  const isText =
    stats.questionType === "text_short" || stats.questionType === "text_long";
  const isRating = stats.questionType === "rating_scale";

  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
        isText && "lg:col-span-2"
      )}
    >
      <header className="flex items-start gap-3 border-b p-4">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--ee-primary-light)] text-[var(--ee-primary-text)]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug">
            <span className="text-muted-foreground">Q{index}. </span>
            {stats.questionText}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stats.totalResponses} response
            {stats.totalResponses !== 1 ? "s" : ""}
          </p>
        </div>
      </header>

      <div className="flex-1 p-4">
        {stats.totalResponses === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No responses yet
          </p>
        ) : isRating ? (
          <RatingSummary stats={stats} question={question} />
        ) : isText ? (
          <TextResponses textResponses={stats.textResponses ?? []} />
        ) : stats.distribution ? (
          <DistributionBars
            distribution={stats.distribution}
            total={stats.totalResponses}
          />
        ) : null}
      </div>
    </section>
  );
}

function DistributionBars({
  distribution,
  total,
  numeric = false,
}: {
  distribution: Record<string, number>;
  total: number;
  numeric?: boolean;
}) {
  const entries = Object.entries(distribution).sort(([a, av], [b, bv]) => {
    if (numeric) {
      const na = Number(a);
      const nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
    }
    return bv - av;
  });
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="space-y-2.5">
      {entries.map(([key, count]) => {
        const percentage = Math.round((count / total) * 100);
        const isTop = count === max;
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium">{key}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {count} <span className="text-xs">({percentage}%)</span>
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
                  isTop
                    ? "bg-[var(--ee-primary-text)]"
                    : "bg-[var(--ee-primary-text)]/45"
                )}
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RatingSummary({
  stats,
  question,
}: {
  stats: QuestionStats;
  question?: SurveyQuestion;
}) {
  const max = question?.maxValue ?? 5;
  const min = question?.minValue ?? 1;
  const average = stats.average ?? 0;
  const pct = ((average - min) / (max - min)) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-lg bg-muted/40 p-4">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold tabular-nums text-[var(--ee-primary-text)]">
            {average.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">/ {max}</span>
        </div>
        <div className="flex-1">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>{question?.minLabel ?? min}</span>
            <span>{question?.maxLabel ?? max}</span>
          </div>
          <div className="relative h-2 rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--ee-primary-text)]/50 to-[var(--ee-primary-text)] transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">Average rating</p>
        </div>
      </div>
      {stats.distribution && (
        <DistributionBars
          distribution={stats.distribution}
          total={stats.totalResponses}
          numeric
        />
      )}
    </div>
  );
}

function TextResponses({ textResponses }: { textResponses: string[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? textResponses : textResponses.slice(0, 6);

  if (textResponses.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No written responses
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((text, idx) => (
          <figure
            key={idx}
            className="relative rounded-lg border bg-muted/30 p-3 pl-9 text-sm"
          >
            <MessageSquareQuote className="absolute left-3 top-3 h-4 w-4 text-[var(--ee-primary-text)]/50" />
            <blockquote className="break-words leading-relaxed text-foreground/90">
              {text}
            </blockquote>
          </figure>
        ))}
      </div>
      {textResponses.length > 6 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll((v) => !v)}
          className="text-[var(--ee-primary-text)]"
        >
          {showAll ? "Show fewer" : `Show all ${textResponses.length} responses`}
        </Button>
      )}
    </div>
  );
}
