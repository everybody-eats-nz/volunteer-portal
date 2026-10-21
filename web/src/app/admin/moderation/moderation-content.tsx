"use client";

import { useState, useCallback, type ReactNode } from "react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Ban, Flag, RefreshCw, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";
import { EmptyState } from "@/components/admin/empty-state";
import {
  STATUS_ICON,
  STATUS_SOLID,
  formatStatusLabel,
  reportStatusTone,
} from "@/lib/status-styles";
import { volunteerProfileHref } from "@/lib/admin-navigation";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/admin/admin-skeletons";

interface Reporter {
  id: string;
  firstName: string | null;
  name: string | null;
  email: string;
}

/** Resolved by the API from targetType + targetId (see resolve-targets.ts). */
interface ReportTarget {
  kind: string;
  snippet: string | null;
  author: { id: string; name: string; email: string } | null;
  href: string | null;
  exists: boolean;
  note?: string;
}

interface Report {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
  reporter: Reporter;
  target: ReportTarget | null;
}

interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
  blocker: Reporter;
  blocked: Reporter;
}

function displayName(user: Reporter) {
  return user.firstName ?? user.name ?? user.email;
}

const MODERATION_PATH = "/admin/moderation";

/** Snippets longer than this start collapsed to two lines. */
const COLLAPSE_AFTER = 140;

function ReportActions({
  status,
  busy,
  onUpdate,
  className,
}: {
  status: string;
  busy: boolean;
  onUpdate: (status: "REVIEWED" | "RESOLVED") => void;
  className?: string;
}) {
  if (status === "RESOLVED") {
    return <span className="text-xs text-muted-foreground">Done</span>;
  }
  return (
    <div className={cn("flex gap-2", className)}>
      {status === "PENDING" && (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onUpdate("REVIEWED")}
        >
          Mark reviewed
        </Button>
      )}
      <Button
        size="sm"
        variant={status === "PENDING" ? "default" : "outline"}
        disabled={busy}
        onClick={() => onUpdate("RESOLVED")}
      >
        Resolve
      </Button>
    </div>
  );
}

function ReportedContent({
  report,
  actions,
}: {
  report: Report;
  /** Shown inside the cell below md, where the actions column is hidden. */
  actions: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const target = report.target;
  const kind = target?.kind ?? report.targetType;
  const canExpand = (target?.snippet?.length ?? 0) > COLLAPSE_AFTER;
  // A user report is about the person, so their name is the content.
  const isPerson = report.targetType === "user";

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="neutral">{kind}</StatusBadge>
        {target?.author && isPerson && (
          <Link
            href={volunteerProfileHref(target.author.id, MODERATION_PATH)}
            className="text-sm font-medium underline-offset-2 hover:underline"
          >
            {target.author.name}
          </Link>
        )}
        {target?.author && !isPerson && (
          <span className="text-xs text-muted-foreground">
            by{" "}
            <Link
              href={volunteerProfileHref(target.author.id, MODERATION_PATH)}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {target.author.name}
            </Link>
          </span>
        )}
      </div>

      {target?.snippet ? (
        <div>
          <p
            className={cn(
              "text-sm whitespace-pre-line break-words",
              canExpand && !expanded && "line-clamp-2"
            )}
            data-testid="report-snippet"
          >
            {target.snippet}
          </p>
          {canExpand && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-0.5 text-xs font-medium text-primary-text underline-offset-2 hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      ) : !isPerson || !target?.exists ? (
        <p className="text-sm text-muted-foreground">
          {target && !target.exists
            ? "This item has since been deleted."
            : (target?.note ?? "No text to show for this item.")}
        </p>
      ) : null}

      {target?.href && !isPerson && (
        <Link
          href={target.href}
          className="inline-flex text-xs font-medium text-primary-text underline-offset-2 hover:underline"
        >
          View source
        </Link>
      )}

      {/* Columns hidden on narrower screens fold in here. */}
      <p className="text-xs text-muted-foreground xl:hidden">
        <span className="lg:hidden">
          Reported by {displayName(report.reporter)},{" "}
        </span>
        {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-1 md:hidden">
        <StatusBadge tone={reportStatusTone(report.status)}>
          {formatStatusLabel(report.status)}
        </StatusBadge>
        <span className="text-xs text-muted-foreground">{report.reason}</span>
      </div>
      <div className="pt-1 md:hidden">{actions}</div>
    </div>
  );
}

export function ModerationContent() {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();

  const {
    data: reportsData,
    isValidating: loadingReports,
    mutate: mutateReports,
  } = useSWR<{ reports: Report[] }>("/api/admin/moderation/reports", {
    onError: () =>
      toast({
        title: "Error",
        description: "Failed to load reports",
        variant: "destructive",
      }),
  });
  const reports = reportsData?.reports ?? [];

  const {
    data: blocksData,
    isValidating: loadingBlocks,
    mutate: refreshBlocks,
  } = useSWR<{ blocks: Block[] }>("/api/admin/moderation/blocks", {
    onError: () =>
      toast({
        title: "Error",
        description: "Failed to load blocks",
        variant: "destructive",
      }),
  });
  const blocks = blocksData?.blocks ?? [];

  const updateStatus = useCallback(
    async (id: string, status: "REVIEWED" | "RESOLVED") => {
      setUpdatingId(id);
      try {
        const res = await fetch(`/api/admin/moderation/reports/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error();
        await mutateReports(
          (current) =>
            current && {
              ...current,
              reports: current.reports.map((r) =>
                r.id === id ? { ...r, status } : r
              ),
            },
          { revalidate: false }
        );
        toast({
          title: "Updated",
          description: `Report marked as ${status.toLowerCase()}.`,
        });
      } catch {
        toast({
          title: "Error",
          description: "Failed to update report",
          variant: "destructive",
        });
      } finally {
        setUpdatingId(null);
      }
    },
    [mutateReports, toast]
  );

  const pendingCount = reports.filter((r) => r.status === "PENDING").length;

  return (
    <Tabs defaultValue="reports">
      <TabsList>
        <TabsTrigger value="reports" className="gap-2">
          <Flag className="h-4 w-4" />
          Reports
          {pendingCount > 0 && (
            <span
              className={cn(
                "ml-1 rounded-full text-xs px-1.5 py-0.5 leading-none",
                STATUS_SOLID.pending
              )}
            >
              {pendingCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="blocks" className="gap-2">
          <Ban className="h-4 w-4" />
          Blocks
          {blocks.length > 0 && (
            <span className="ml-1 rounded-full bg-stone-100 text-stone-700 dark:bg-white/10 dark:text-stone-200 text-xs px-1.5 py-0.5 leading-none">
              {blocks.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      {/* ── Reports ── */}
      <TabsContent value="reports" className="mt-4">
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            {loadingReports && reports.length === 0 ? (
              <Skeleton className="h-4 w-28" />
            ) : (
              <p className="text-sm text-muted-foreground">
                {reports.length} total report{reports.length !== 1 ? "s" : ""}
              </p>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mutateReports()}
              disabled={loadingReports}
              className="gap-2"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingReports ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>

          {loadingReports && reports.length === 0 ? (
            <div aria-busy="true">
              <span className="sr-only" role="status">
                Loading reports
              </span>
              <TableSkeleton
                card={false}
                rows={6}
                columns={["w-48", "w-24", "w-32", "w-16", "w-20"]}
                actions
              />
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              icon={Flag}
              title="No reports yet"
              description="When a volunteer flags a post, comment or person in the app, it shows up here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Reported content</TableHead>
                  <TableHead className="hidden md:table-cell">Reason</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Reporter
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="hidden xl:table-cell">
                    Received
                  </TableHead>
                  <TableHead className="hidden md:table-cell text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id} className="align-top">
                    <TableCell className="whitespace-normal md:min-w-64">
                      <ReportedContent
                        report={report}
                        actions={
                          <ReportActions
                            status={report.status}
                            busy={updatingId === report.id}
                            onUpdate={(status) =>
                              updateStatus(report.id, status)
                            }
                          />
                        }
                      />
                    </TableCell>
                    <TableCell className="hidden md:table-cell min-w-28 whitespace-normal text-sm">
                      {report.reason}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-start gap-2">
                        <User
                          className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <Link
                            href={volunteerProfileHref(
                              report.reporter.id,
                              MODERATION_PATH
                            )}
                            className="text-sm font-medium leading-none underline-offset-2 hover:underline"
                          >
                            {displayName(report.reporter)}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5 break-all">
                            {report.reporter.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <StatusBadge tone={reportStatusTone(report.status)}>
                        {formatStatusLabel(report.status)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(report.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      <ReportActions
                        status={report.status}
                        busy={updatingId === report.id}
                        onUpdate={(status) => updateStatus(report.id, status)}
                        className="flex-col items-end"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </TabsContent>

      {/* ── Blocks ── */}
      <TabsContent value="blocks" className="mt-4">
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            {loadingBlocks && blocks.length === 0 ? (
              <Skeleton className="h-4 w-24" />
            ) : (
              <p className="text-sm text-muted-foreground">
                {blocks.length} active block{blocks.length !== 1 ? "s" : ""}
              </p>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshBlocks()}
              disabled={loadingBlocks}
              className="gap-2"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingBlocks ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>

          {loadingBlocks && blocks.length === 0 ? (
            <div aria-busy="true">
              <span className="sr-only" role="status">
                Loading blocks
              </span>
              <TableSkeleton
                card={false}
                rows={6}
                columns={["w-40", "w-40", "w-24"]}
              />
            </div>
          ) : blocks.length === 0 ? (
            <EmptyState
              icon={Ban}
              title="No blocks yet"
              description="Volunteers who block each other in the app are listed here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Blocked by</TableHead>
                  <TableHead>Blocked user</TableHead>
                  <TableHead className="hidden sm:table-cell">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocks.map((block) => (
                  <TableRow key={block.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User
                          className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-sm font-medium leading-none">
                            {displayName(block.blocker)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {block.blocker.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Ban
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            STATUS_ICON.danger
                          )}
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-sm font-medium leading-none">
                            {displayName(block.blocked)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {block.blocked.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(block.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
