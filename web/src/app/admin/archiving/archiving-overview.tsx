"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { describeError } from "@/lib/swr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { KpiTile } from "@/components/admin/kpi-tile";
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

export const ARCHIVE_STATS_KEY = "/api/admin/archiving/stats";

export function ArchivingOverview({ initialStats }: { initialStats: Stats }) {
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastReport, setLastReport] = useState<RunReport | null>(null);

  // The server renders the first stats; only refetch after a mutation.
  const {
    data: stats,
    isValidating: loading,
    mutate: refreshStats,
  } = useSWR<Stats>(ARCHIVE_STATS_KEY, {
    fallbackData: initialStats,
    revalidateOnMount: false,
    onError: (e) =>
      toast.error(describeError(e, "Failed to load archive stats")),
  });

  const runAll = useCallback(async () => {
    setConfirmOpen(false);
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
      void refreshStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }, [refreshStats]);

  const totalPending = stats
    ? Object.values(stats.pending).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-6">
      <Card data-testid="archiving-overview-card">
        <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary-text" aria-hidden="true" />
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
              onClick={() => refreshStats()}
              disabled={loading || running}
              data-testid="archiving-refresh-button"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Refresh
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={running || loading}
              data-testid="archiving-run-all-button"
            >
              <PlayCircle
                className={`h-4 w-4 ${running ? "animate-pulse" : ""}`}
                aria-hidden="true"
              />
              {running ? "Running…" : "Run all passes"}
            </Button>
          </div>
        </CardHeader>
        {lastReport && (
          <CardContent data-testid="archiving-last-report">
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
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
          <KpiTile
            data-testid="stat-total-pending"
            valueTestId="stat-total-pending-count"
            tone="forest"
            icon={<Users />}
            label="Total pending"
            value={stats ? totalPending : "-"}
          />
          <KpiTile
            data-testid="stat-pending-never-migrated"
            valueTestId="stat-pending-never-migrated-count"
            tone="sun"
            icon={<Database />}
            label="Never migrated"
            value={stats?.pending["never-migrated"] ?? "-"}
          />
          <KpiTile
            data-testid="stat-pending-never-activated-nudge"
            valueTestId="stat-pending-never-activated-nudge-count"
            tone="neutral"
            icon={<BellRing />}
            label="Nudge new sign-ups"
            value={stats?.pending["never-activated-nudge"] ?? "-"}
          />
          <KpiTile
            data-testid="stat-pending-never-activated-archive"
            valueTestId="stat-pending-never-activated-archive-count"
            tone="danger"
            icon={<UserX />}
            label="Never activated: archive"
            value={stats?.pending["never-activated-archive"] ?? "-"}
          />
          <KpiTile
            data-testid="stat-pending-inactive-warning"
            valueTestId="stat-pending-inactive-warning-count"
            tone="neutral"
            icon={<Send />}
            label="Warning emails due"
            value={stats?.pending["inactive-warning"] ?? "-"}
          />
          <KpiTile
            data-testid="stat-pending-inactive-archive"
            valueTestId="stat-pending-inactive-archive-count"
            tone="danger"
            icon={<AlertTriangle />}
            label="Inactive: archive"
            value={stats?.pending["inactive-archive"] ?? "-"}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Archived volunteers</h3>
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          data-testid="archiving-archived-stats"
        >
          <KpiTile
            data-testid="stat-archived-total"
            valueTestId="stat-archived-total-count"
            tone="forest"
            icon={<Archive />}
            label="Total archived"
            value={stats?.archivedTotal ?? "-"}
          />
          <KpiTile
            data-testid="stat-archived-inactive"
            valueTestId="stat-archived-inactive-count"
            tone="danger"
            icon={<AlertTriangle />}
            label="Inactive 12mo"
            value={stats?.archivedByReason.INACTIVE_12_MONTHS ?? "-"}
          />
          <KpiTile
            data-testid="stat-archived-never-activated"
            valueTestId="stat-archived-never-activated-count"
            tone="sun"
            icon={<UserX />}
            label="Never activated"
            value={stats?.archivedByReason.NEVER_ACTIVATED ?? "-"}
          />
          <KpiTile
            data-testid="stat-archived-never-migrated"
            valueTestId="stat-archived-never-migrated-count"
            tone="neutral"
            icon={<Database />}
            label="Never migrated"
            value={stats?.archivedByReason.NEVER_MIGRATED ?? "-"}
          />
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-testid="archiving-run-all-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Run all archiving passes now?</AlertDialogTitle>
            <AlertDialogDescription>
              This sends emails and archives users based on the current rules.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={runAll}
              className={buttonVariants({ variant: "destructive" })}
              data-testid="archiving-run-all-confirm-button"
            >
              Run all passes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
