"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  Search,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { RuleTrace } from "@/lib/auto-approval/types";

import { DecisionReceipt } from "./decision-receipt";
import { OUTCOME_META, OutcomeBadge, type Outcome } from "./outcome";
import {
  EmptyState,
  VolunteerCell,
  VolunteerProfileLink,
  type AdminOptions,
} from "./shared";

export interface CoverageVolunteer {
  userId: string;
  name: string | null;
  email: string;
  profilePhotoUrl: string | null;
  volunteerGrade: "GREEN" | "YELLOW" | "PINK";
  completedShifts: number;
  attendanceRate: number;
  labelIds: string[];
  outcome: Outcome;
  ruleId: string | null;
  ruleName: string | null;
  summary: string;
}

export interface CoverageResult {
  summary: { total: number; approved: number; blocked: number; held: number };
  byRule: {
    ruleId: string;
    ruleName: string;
    outcome: Outcome;
    count: number;
  }[];
  /** How many volunteers match the current outcome/search narrowing. */
  matched: number;
  page: number;
  pageSize: number;
  totalPages: number;
  volunteers: CoverageVolunteer[];
}

/** How the roster list is narrowed. Server-side - the roster is 10k+. */
export interface CoverageQuery {
  outcome: Outcome | "ALL";
  search: string;
  page: number;
}

export const DEFAULT_QUERY: CoverageQuery = {
  outcome: "ALL",
  search: "",
  page: 1,
};

export interface CoverageRequest {
  mode: "live" | "rule" | "draft";
  shiftTypeId: string;
  location: string | null;
  daysInAdvance: number;
  ruleId?: string;
}

/**
 * Fetches one page of coverage. Totals always cover the whole roster; only the
 * listed page carries per-criterion traces.
 */
export async function fetchCoverage(
  request: CoverageRequest,
  query: CoverageQuery
): Promise<CoverageResult> {
  const res = await fetch("/api/admin/auto-approval/coverage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...request,
      outcome: query.outcome === "ALL" ? null : query.outcome,
      search: query.search.trim() || null,
      page: query.page,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Couldn't run the preview");
  }
  return res.json();
}

/** One volunteer's full receipt, fetched only when their row is expanded. */
export async function fetchReceipt(
  request: CoverageRequest,
  userId: string
): Promise<RuleTrace[]> {
  const res = await fetch("/api/admin/auto-approval/coverage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, explainUserId: userId }),
  });
  if (!res.ok) throw new Error("Couldn't load the reasoning");
  const body = await res.json();
  return body.decision.trace as RuleTrace[];
}

const ANY_LOCATION = "ANY";

const LEAD_TIMES = [
  { value: "1", label: "Tomorrow" },
  { value: "3", label: "In 3 days" },
  { value: "7", label: "In a week" },
  { value: "21", label: "In 3 weeks" },
  { value: "60", label: "In 2 months" },
];

export function CoverageTab({ options }: { options: AdminOptions }) {
  const [shiftTypeId, setShiftTypeId] = useState("");
  const [location, setLocation] = useState(ANY_LOCATION);
  const [daysInAdvance, setDaysInAdvance] = useState("7");

  const [request, setRequest] = useState<CoverageRequest | null>(null);
  const [query, setQuery] = useState<CoverageQuery>(DEFAULT_QUERY);
  const [result, setResult] = useState<CoverageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shiftTypeId && options.shiftTypes.length > 0) {
      setShiftTypeId(options.shiftTypes[0].id);
    }
  }, [options.shiftTypes, shiftTypeId]);

  const run = () => {
    if (!shiftTypeId) return;
    setQuery(DEFAULT_QUERY);
    setRequest({
      mode: "live",
      shiftTypeId,
      location: location === ANY_LOCATION ? null : location,
      daysInAdvance: Number(daysInAdvance),
    });
  };

  const load = useCallback(async () => {
    if (!request) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchCoverage(request, query));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't run the preview");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [request, query]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Who would get in?</CardTitle>
          <CardDescription>
            Runs the live rules across every active volunteer against a shift
            that doesn&rsquo;t exist yet. Nothing is saved and nobody is
            notified — this is the same evaluation a real signup goes through.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="coverage-shift-type">Shift type</Label>
              <Select value={shiftTypeId} onValueChange={setShiftTypeId}>
                <SelectTrigger id="coverage-shift-type">
                  <SelectValue placeholder="Pick a shift type" />
                </SelectTrigger>
                <SelectContent>
                  {options.shiftTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="coverage-location">Location</Label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger id="coverage-location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_LOCATION}>No location set</SelectItem>
                  {options.locations.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="coverage-lead-time">Shift starts</Label>
              <Select value={daysInAdvance} onValueChange={setDaysInAdvance}>
                <SelectTrigger id="coverage-lead-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_TIMES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={run}
                disabled={loading || !shiftTypeId}
                className="w-full"
                data-testid="run-coverage"
              >
                <PlayCircle className={cn("h-4 w-4", loading && "animate-pulse")} />
                {loading ? "Working…" : "Preview"}
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {request ? (
        <CoverageResults
          result={result}
          loading={loading}
          query={query}
          onQueryChange={setQuery}
          options={options}
          request={request}
        />
      ) : (
        <Card>
          <EmptyState icon={Users} title="Nothing previewed yet">
            Pick a shift type and press Preview to see exactly who clears the
            rules and who lands on the team&rsquo;s desk.
          </EmptyState>
        </Card>
      )}
    </div>
  );
}

export function CoverageResults({
  result,
  loading,
  query,
  onQueryChange,
  options,
  request,
  emphasis = "APPROVED",
}: {
  result: CoverageResult | null;
  loading: boolean;
  /** Needed to fetch a row's receipt on demand. */
  request: CoverageRequest | null;
  query: CoverageQuery;
  onQueryChange: (query: CoverageQuery) => void;
  options: AdminOptions;
  /**
   * Which number the headline leads with. Previewing a block rule on its own
   * makes "0 would be approved" technically true and completely useless - the
   * number that matters there is how many it holds.
   */
  emphasis?: "APPROVED" | "BLOCKED";
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Record<string, RuleTrace[]>>({});
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(query.search);
  const firstRender = useRef(true);

  const toggleRow = async (userId: string) => {
    if (expanded === userId) {
      setExpanded(null);
      return;
    }
    setExpanded(userId);
    setReceiptError(null);
    if (receipts[userId] || !request) return;
    try {
      const trace = await fetchReceipt(request, userId);
      setReceipts((current) => ({ ...current, [userId]: trace }));
    } catch {
      setReceiptError("Couldn't load the reasoning for this volunteer.");
    }
  };

  // Debounced so typing doesn't re-evaluate the roster per keystroke.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      onQueryChange({ ...query, search: searchInput, page: 1 });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the input drives this
  }, [searchInput]);

  if (!result) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Running preview">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  const { summary } = result;
  const pct = (n: number) =>
    summary.total ? Math.round((n / summary.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-lg">
            <strong className="tabular-nums" data-testid="coverage-approved-count">
              {(emphasis === "BLOCKED"
                ? summary.blocked
                : summary.approved
              ).toLocaleString("en-NZ")}
            </strong>{" "}
            of{" "}
            <strong className="tabular-nums">
              {summary.total.toLocaleString("en-NZ")}
            </strong>{" "}
            active volunteers would be{" "}
            {emphasis === "BLOCKED"
              ? "held for a person by this rule"
              : "approved on the spot"}
            .
          </p>

          {/* One bar, three segments. Each is also labelled below, so colour is
              never the only thing carrying the meaning. */}
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {(["APPROVED", "BLOCKED", "HELD"] as const).map((outcome) => {
              const value =
                outcome === "APPROVED"
                  ? summary.approved
                  : outcome === "BLOCKED"
                    ? summary.blocked
                    : summary.held;
              if (!value) return null;
              return (
                <div
                  key={outcome}
                  className={OUTCOME_META[outcome].dot}
                  style={{ width: `${pct(value)}%` }}
                  title={`${OUTCOME_META[outcome].label}: ${value}`}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            {(["APPROVED", "HELD", "BLOCKED"] as const).map((outcome) => {
              const value =
                outcome === "APPROVED"
                  ? summary.approved
                  : outcome === "HELD"
                    ? summary.held
                    : summary.blocked;
              return (
                <span key={outcome} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      OUTCOME_META[outcome].dot
                    )}
                    aria-hidden
                  />
                  <span className="font-medium">
                    {OUTCOME_META[outcome].label}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {value.toLocaleString("en-NZ")} ({pct(value)}%)
                  </span>
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {result.byRule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Which rule catches whom</CardTitle>
            <CardDescription>
              A rule missing from this list is being shadowed by one above it,
              or is too strict to catch anyone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {result.byRule.map((r) => (
                <li
                  key={`${r.ruleId}:${r.outcome}`}
                  className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-sm"
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      OUTCOME_META[r.outcome].dot
                    )}
                    aria-hidden
                  />
                  <span className="font-medium">{r.ruleName}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {r.count.toLocaleString("en-NZ")}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Find a volunteer by name or email"
            className="pl-9"
            aria-label="Find a volunteer in these results"
            data-testid="coverage-search"
          />
        </div>
        <Select
          value={query.outcome}
          onValueChange={(v) =>
            onQueryChange({ ...query, outcome: v as Outcome | "ALL", page: 1 })
          }
        >
          <SelectTrigger
            className="w-auto min-w-40"
            aria-label="Filter by outcome"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Everyone</SelectItem>
            <SelectItem value="APPROVED">Approved only</SelectItem>
            <SelectItem value="HELD">Held only</SelectItem>
            <SelectItem value="BLOCKED">Blocked only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {result.volunteers.length === 0 ? (
            <EmptyState icon={Users} title="Nobody matches">
              Try clearing the search or picking a different outcome.
            </EmptyState>
          ) : (
            <ul
              className={cn("divide-y", loading && "opacity-60")}
              data-testid="coverage-volunteers"
            >
              {result.volunteers.map((v) => {
                const isOpen = expanded === v.userId;
                const labels = v.labelIds
                  .map((id) => options.labels.find((l) => l.id === id))
                  .filter((l): l is AdminOptions["labels"][number] => Boolean(l));
                return (
                  <li key={v.userId}>
                    <button
                      type="button"
                      onClick={() => toggleRow(v.userId)}
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "Hide" : "Show"} why ${v.name ?? v.email} was ${OUTCOME_META[v.outcome].label.toLowerCase()}`}
                      className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:-outline-offset-2"
                    >
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          isOpen && "rotate-180"
                        )}
                        aria-hidden
                      />
                      <div className="min-w-44 flex-1">
                        <VolunteerCell volunteer={v} />
                      </div>

                      <span className="hidden text-xs text-muted-foreground tabular-nums sm:block">
                        {v.completedShifts} shifts · {v.attendanceRate}%
                      </span>

                      {labels.length > 0 && (
                        <span className="hidden gap-1 md:flex">
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
                        </span>
                      )}

                      <span className="hidden max-w-52 truncate text-xs text-muted-foreground lg:block">
                        {v.ruleName ?? v.summary}
                      </span>

                      <OutcomeBadge outcome={v.outcome} />
                    </button>

                    {isOpen && (
                      <div className="space-y-3 border-t bg-muted/20 px-4 py-4">
                        <VolunteerProfileLink userId={v.userId}>
                          View volunteer
                        </VolunteerProfileLink>
                        {receipts[v.userId] ? (
                          <DecisionReceipt trace={receipts[v.userId]} />
                        ) : receiptError ? (
                          <p className="text-sm text-destructive" role="alert">
                            {receiptError}
                          </p>
                        ) : (
                          <div
                            className="space-y-2"
                            aria-busy="true"
                            aria-label="Loading reasoning"
                          >
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {result.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            Showing {(result.page - 1) * result.pageSize + 1}–
            {Math.min(result.page * result.pageSize, result.matched)} of{" "}
            {result.matched.toLocaleString("en-NZ")}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={result.page <= 1 || loading}
              onClick={() =>
                onQueryChange({ ...query, page: Math.max(1, query.page - 1) })
              }
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={result.page >= result.totalPages || loading}
              onClick={() => onQueryChange({ ...query, page: query.page + 1 })}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
