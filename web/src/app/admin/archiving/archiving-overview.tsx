"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/ui/stats-card";
import { toast } from "sonner";
import {
  Archive,
  AlertTriangle,
  BellRing,
  Database,
  PlayCircle,
  Send,
  UserX,
  Users,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import type { ArchiveCategory } from "@/lib/archive-service";

type Stats = {
  archivedTotal: number;
  archivedByReason: Record<
    "INACTIVE_12_MONTHS" | "NEVER_ACTIVATED" | "NEVER_MIGRATED" | "MANUAL",
    number
  >;
  pending: Record<ArchiveCategory, number>;
};

type RunReport = {
  neverMigratedArchived: number;
  neverActivatedNudged: number;
  neverActivatedArchived: number;
  inactiveWarned: number;
  inactiveArchived: number;
  errors: Array<{ userId: string; stage: string; message: string }>;
};

export function ArchivingOverview({
  refreshKey,
  onRunComplete,
}: {
  refreshKey: number;
  onRunComplete: () => void;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastReport, setLastReport] = useState<RunReport | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/archiving/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      const data = (await res.json()) as Stats;
      setStats(data);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to load archive stats"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshKey]);

  const runAll = useCallback(async () => {
    if (
      !confirm(
        "Run all archiving passes now? This sends emails and archives users based on the current rules."
      )
    ) {
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/admin/archiving/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run-all" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Run failed");
      }
      const data = await res.json();
      setLastReport(data.report as RunReport);
      toast.success("Archive pass complete");
      onRunComplete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }, [onRunComplete]);

  const totalPending = stats
    ? Object.values(stats.pending).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-6">
      <Card data-testid="archiving-overview-card">
        <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              Run the archive pass
            </CardTitle>
            <CardDescription>
              Runs every rule in order — nudges, warnings, and archives.
              Per-user failures are collected so one bad record doesn&apos;t
              stop the batch.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStats}
              disabled={loading || running}
              data-testid="archiving-refresh-button"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              onClick={runAll}
              disabled={running || loading}
              data-testid="archiving-run-all-button"
            >
              <PlayCircle
                className={`h-4 w-4 ${running ? "animate-pulse" : ""}`}
              />
              {running ? "Running…" : "Run all passes"}
            </Button>
          </div>
        </CardHeader>
        {lastReport && (
          <CardContent data-testid="archiving-last-report">
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Last run summary
              </div>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                <li>
                  Never-migrated archived:{" "}
                  <span className="font-semibold">
                    {lastReport.neverMigratedArchived}
                  </span>
                </li>
                <li>
                  Nudges sent:{" "}
                  <span className="font-semibold">
                    {lastReport.neverActivatedNudged}
                  </span>
                </li>
                <li>
                  Never-activated archived:{" "}
                  <span className="font-semibold">
                    {lastReport.neverActivatedArchived}
                  </span>
                </li>
                <li>
                  Warnings sent:{" "}
                  <span className="font-semibold">
                    {lastReport.inactiveWarned}
                  </span>
                </li>
                <li>
                  Inactive archived:{" "}
                  <span className="font-semibold">
                    {lastReport.inactiveArchived}
                  </span>
                </li>
                <li>
                  Errors:{" "}
                  <span
                    className={`font-semibold ${
                      lastReport.errors.length ? "text-red-600" : ""
                    }`}
                  >
                    {lastReport.errors.length}
                  </span>
                </li>
              </ul>
              {lastReport.errors.length > 0 && (
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Show error details
                  </summary>
                  <ul className="mt-2 space-y-1 font-mono text-muted-foreground">
                    {lastReport.errors.map((err, i) => (
                      <li key={i}>
                        [{err.stage}] {err.userId}: {err.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-3">Pending this pass</h3>
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="archiving-pending-stats"
        >
          <StatsCard
            title="Total pending"
            value={stats ? totalPending : "—"}
            icon={Users}
            variant="primary"
            testId="stat-total-pending"
          />
          <StatsCard
            title="Never migrated"
            value={stats?.pending["never-migrated"] ?? "—"}
            icon={Database}
            variant="amber"
            testId="stat-pending-never-migrated"
          />
          <StatsCard
            title="Nudge new sign-ups"
            value={stats?.pending["never-activated-nudge"] ?? "—"}
            icon={BellRing}
            variant="blue"
            testId="stat-pending-never-activated-nudge"
          />
          <StatsCard
            title="Never activated — archive"
            value={stats?.pending["never-activated-archive"] ?? "—"}
            icon={UserX}
            variant="red"
            testId="stat-pending-never-activated-archive"
          />
          <StatsCard
            title="Warning emails due"
            value={stats?.pending["inactive-warning"] ?? "—"}
            icon={Send}
            variant="purple"
            testId="stat-pending-inactive-warning"
          />
          <StatsCard
            title="Inactive — archive"
            value={stats?.pending["inactive-archive"] ?? "—"}
            icon={AlertTriangle}
            variant="red"
            testId="stat-pending-inactive-archive"
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Archived volunteers</h3>
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-testid="archiving-archived-stats"
        >
          <StatsCard
            title="Total archived"
            value={stats?.archivedTotal ?? "—"}
            icon={Archive}
            variant="primary"
            testId="stat-archived-total"
          />
          <StatsCard
            title="Inactive 12mo"
            value={stats?.archivedByReason.INACTIVE_12_MONTHS ?? "—"}
            icon={AlertTriangle}
            variant="red"
            testId="stat-archived-inactive"
          />
          <StatsCard
            title="Never activated"
            value={stats?.archivedByReason.NEVER_ACTIVATED ?? "—"}
            icon={UserX}
            variant="amber"
            testId="stat-archived-never-activated"
          />
          <StatsCard
            title="Never migrated"
            value={stats?.archivedByReason.NEVER_MIGRATED ?? "—"}
            icon={Database}
            variant="blue"
            testId="stat-archived-never-migrated"
          />
        </div>
      </div>
    </div>
  );
}
