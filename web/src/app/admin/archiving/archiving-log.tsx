"use client";

import { useState } from "react";
import useSWR from "swr";
import { describeError } from "@/lib/swr";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, History, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/admin/admin-skeletons";
import { EmptyState } from "@/components/admin/empty-state";
import { StatusBadge } from "@/components/admin/status-badge";
import type { StatusTone } from "@/lib/status-styles";
import { format } from "date-fns";
import { volunteerProfileHref } from "@/lib/admin-navigation";

type LogEntry = {
  id: string;
  eventType:
    | "ARCHIVED"
    | "UNARCHIVED"
    | "WARNING_SENT"
    | "FIRST_SHIFT_NUDGE_SENT"
    | "EXTENDED";
  reason: string | null;
  triggerSource: "MANUAL" | "CRON" | "SELF_EXTENSION" | "SELF_REACTIVATION";
  note: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  actor: { id: string; email: string; name: string | null } | null;
};

const EVENT_META: Record<
  LogEntry["eventType"],
  { label: string; tone: StatusTone }
> = {
  ARCHIVED: { label: "Archived", tone: "danger" },
  UNARCHIVED: { label: "Reactivated", tone: "confirmed" },
  WARNING_SENT: { label: "Warning sent", tone: "pending" },
  FIRST_SHIFT_NUDGE_SENT: { label: "Nudge sent", tone: "waitlisted" },
  EXTENDED: { label: "Extended", tone: "neutral" },
};

const TRIGGER_LABEL: Record<LogEntry["triggerSource"], string> = {
  MANUAL: "Admin",
  CRON: "Cron",
  SELF_EXTENSION: "Email link",
  SELF_REACTIVATION: "Self",
};

const PAGE_SIZE = 50;

export function ArchivingLog() {
  const [page, setPage] = useState(1);

  const { data, isValidating, mutate } = useSWR<{
    logs: LogEntry[];
    total?: number;
  }>(`/api/admin/archiving/log?page=${page}&pageSize=${PAGE_SIZE}`, {
    keepPreviousData: true,
    onError: (e) => toast.error(describeError(e, "Failed to load log")),
  });
  const logs = data?.logs ?? null;
  const total = data?.total ?? 0;
  const loading = isValidating;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const displayName = (u: LogEntry["user"]) =>
    u.name ||
    [u.firstName, u.lastName].filter(Boolean).join(" ") ||
    u.email.split("@")[0];

  return (
    <Card data-testid="archiving-log-card">
      <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <CardTitle>Activity log</CardTitle>
          <CardDescription>
            Recent archive events — manual actions, cron runs, and volunteer
            self-service flows.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => mutate()}
          disabled={loading}
          data-testid="archiving-log-refresh"
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {logs === null ? (
          <div aria-busy="true" className="overflow-hidden rounded-lg border">
            <span className="sr-only" role="status">
              Loading archive events
            </span>
            <TableSkeleton
              card={false}
              rows={6}
              columns={["w-28", "w-24", "w-36", "w-20", "w-24", "w-40"]}
            />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={History}
            title="No archive events yet"
            description="Archives, reactivations and emails sent by the archive pass show up here."
            className="rounded-lg border border-dashed py-10"
            data-testid="archiving-log-empty"
          />
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table data-testid="archiving-log-table">
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Volunteer</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Reason / note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const eventMeta = EVENT_META[log.eventType];
                  return (
                    <TableRow
                      key={log.id}
                      data-testid={`archiving-log-row-${log.id}`}
                    >
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(log.createdAt), "dd MMM HH:mm")}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={eventMeta.tone}>
                          {eventMeta.label}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={volunteerProfileHref(log.user.id, "/admin/archiving")}
                          className="hover:underline"
                        >
                          <span className="font-medium">
                            {displayName(log.user)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {log.user.email}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        {TRIGGER_LABEL[log.triggerSource]}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.actor ? (
                          <span>{log.actor.name || log.actor.email}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {[log.reason, log.note].filter(Boolean).join(" · ") ||
                          "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {logs && total > 0 && (
          <div
            className="mt-4 flex items-center justify-between text-sm text-muted-foreground"
            data-testid="archiving-log-pagination"
          >
            <span>
              Showing {rangeStart}–{rangeEnd} of {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || page <= 1}
                data-testid="archiving-log-prev"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </Button>
              <span className="tabular-nums">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={loading || page >= totalPages}
                data-testid="archiving-log-next"
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
