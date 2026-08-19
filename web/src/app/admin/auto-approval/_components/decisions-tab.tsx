"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  Search,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatInNZT } from "@/lib/timezone";
import type { RuleTrace } from "@/lib/auto-approval/types";

import { DecisionReceipt } from "./decision-receipt";
import { OUTCOME_META, OutcomeBadge, type Outcome } from "./outcome";
import {
  EmptyState,
  ShiftCell,
  TableSkeleton,
  VolunteerCell,
  VolunteerProfileLink,
  volunteerName,
  type AdminOptions,
} from "./shared";

interface Decision {
  id: string;
  createdAt: string;
  outcome: Outcome;
  ruleName: string | null;
  summary: string;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    profilePhotoUrl: string | null;
    volunteerGrade: "GREEN" | "YELLOW" | "PINK";
  };
  shift: {
    id: string;
    start: string;
    location: string | null;
    shiftType: { id: string; name: string } | null;
  };
  signup: { id: string; status: string } | null;
  rule: { id: string; name: string; archivedAt: string | null } | null;
}

interface Response {
  decisions: Decision[];
  page: number;
  totalPages: number;
  total: number;
  tallies: Record<Outcome, number>;
}

const ALL = "ALL";
const OUTCOMES: Outcome[] = ["APPROVED", "HELD", "BLOCKED", "ERROR"];

export function DecisionsTab({
  options,
  rules,
}: {
  options: AdminOptions;
  rules: { id: string; name: string }[];
}) {
  const [outcome, setOutcome] = useState<Outcome | typeof ALL>(ALL);
  const [ruleId, setRuleId] = useState(ALL);
  const [location, setLocation] = useState(ALL);
  const [shiftTypeId, setShiftTypeId] = useState(ALL);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Record<string, RuleTrace[]>>({});
  const [receiptError, setReceiptError] = useState<string | null>(null);

  /**
   * Receipts are fetched per row. Each is a couple of KB and most rows are
   * never opened, so a page of 25 doesn't carry them up front.
   */
  const toggleRow = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    setReceiptError(null);
    if (receipts[id]) return;
    try {
      const res = await fetch(`/api/admin/auto-approval/decisions/${id}`);
      if (!res.ok) throw new Error("failed");
      const body = await res.json();
      setReceipts((current) => ({ ...current, [id]: body.decision.trace }));
    } catch {
      setReceiptError("Couldn't load the reasoning for this decision.");
    }
  };

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [outcome, ruleId, location, shiftTypeId, query]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (outcome !== ALL) params.set("outcome", outcome);
    if (ruleId !== ALL) params.set("ruleId", ruleId);
    if (location !== ALL) params.set("location", location);
    if (shiftTypeId !== ALL) params.set("shiftTypeId", shiftTypeId);
    if (query) params.set("q", query);

    try {
      const res = await fetch(`/api/admin/auto-approval/decisions?${params}`);
      setData(res.ok ? await res.json() : null);
    } finally {
      setLoading(false);
    }
  }, [page, outcome, ruleId, location, shiftTypeId, query]);

  useEffect(() => {
    load();
  }, [load]);

  const filtersActive =
    outcome !== ALL ||
    ruleId !== ALL ||
    location !== ALL ||
    shiftTypeId !== ALL ||
    query !== "";

  const clearFilters = () => {
    setOutcome(ALL);
    setRuleId(ALL);
    setLocation(ALL);
    setShiftTypeId(ALL);
    setSearch("");
  };

  const tallies = data?.tallies;
  const totalAll = useMemo(
    () => (tallies ? OUTCOMES.reduce((sum, o) => sum + (tallies[o] ?? 0), 0) : 0),
    [tallies]
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every signup the rules looked at, and the reasoning behind each call.
        Expand a row to see exactly which conditions were met.
      </p>

      {/* Outcome filter doubles as the tally, so narrowing never hides the shape
          of the data. */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by outcome">
        <OutcomeChip
          label="All"
          count={totalAll}
          active={outcome === ALL}
          onClick={() => setOutcome(ALL)}
        />
        {OUTCOMES.map((o) => (
          <OutcomeChip
            key={o}
            label={OUTCOME_META[o].label}
            count={tallies?.[o] ?? 0}
            active={outcome === o}
            dot={OUTCOME_META[o].dot}
            onClick={() => setOutcome(o)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search volunteers by name or email"
            className="pl-9"
            aria-label="Search volunteers"
            data-testid="decisions-search"
          />
        </div>

        <FilterSelect
          value={ruleId}
          onChange={setRuleId}
          placeholder="Any rule"
          options={rules.map((r) => ({ value: r.id, label: r.name }))}
          allLabel="Any rule"
        />
        <FilterSelect
          value={shiftTypeId}
          onChange={setShiftTypeId}
          placeholder="Any shift type"
          options={options.shiftTypes.map((t) => ({ value: t.id, label: t.name }))}
          allLabel="Any shift type"
        />
        <FilterSelect
          value={location}
          onChange={setLocation}
          placeholder="Any location"
          options={options.locations.map((l) => ({ value: l, label: l }))}
          allLabel="Any location"
        />

        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <TableSkeleton />
          ) : !data || data.decisions.length === 0 ? (
            <EmptyState icon={FileSearch} title="No decisions match">
              {filtersActive
                ? "Try widening the filters."
                : "Decisions appear here as soon as volunteers start signing up."}
            </EmptyState>
          ) : (
            <ul className="divide-y" data-testid="decisions-list">
              {data.decisions.map((decision) => {
                const isOpen = expanded === decision.id;
                return (
                  <li key={decision.id}>
                    <button
                      type="button"
                      onClick={() => toggleRow(decision.id)}
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "Hide" : "Show"} why ${volunteerName(decision.user)} was ${OUTCOME_META[decision.outcome].label.toLowerCase()}`}
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
                        <VolunteerCell volunteer={decision.user} />
                      </div>

                      <div className="min-w-40 flex-1">
                        <ShiftCell shift={decision.shift} />
                      </div>

                      {/* The rule name, not the full summary sentence - the
                          sentence is long enough to always truncate, and the
                          expanded receipt spells it out anyway. */}
                      <div className="hidden min-w-0 flex-1 md:block">
                        <span className="block truncate text-sm">
                          {decision.ruleName ?? decision.summary}
                        </span>
                        <span className="block text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                          {formatInNZT(new Date(decision.createdAt), "d MMM, h:mm a")}
                        </span>
                      </div>

                      <OutcomeBadge outcome={decision.outcome} />
                    </button>

                    {isOpen && (
                      <div className="space-y-3 border-t bg-muted/20 px-4 py-4">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="tabular-nums">
                            Decided{" "}
                            {formatInNZT(
                              new Date(decision.createdAt),
                              "EEE d MMM yyyy, h:mm a"
                            )}
                          </span>
                          {decision.signup && (
                            <span>Signup is now {decision.signup.status}</span>
                          )}
                          <VolunteerProfileLink userId={decision.user.id}>
                            View volunteer
                          </VolunteerProfileLink>
                          {decision.rule?.archivedAt && (
                            <Badge variant="outline">Rule since archived</Badge>
                          )}
                          {!decision.rule && decision.ruleName && (
                            <Badge variant="outline">
                              Rule deleted — {decision.ruleName}
                            </Badge>
                          )}
                        </div>
                        {receipts[decision.id] ? (
                          <DecisionReceipt trace={receipts[decision.id]} />
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

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            Page {data.page} of {data.totalPages} · {data.total} decision
            {data.total === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
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

function OutcomeChip({
  label,
  count,
  active,
  dot,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  dot?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "border-foreground/20 bg-foreground text-background"
          : "bg-background hover:bg-muted"
      )}
    >
      {dot && <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden />}
      {label}
      <span className="text-xs opacity-70 tabular-nums">{count}</span>
    </button>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  allLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-40" aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
