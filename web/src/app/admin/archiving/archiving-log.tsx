"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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

const EVENT_VARIANT: Record<
  LogEntry["eventType"],
  {
    label: string;
    variant: "default" | "destructive" | "secondary" | "outline";
  }
> = {
  ARCHIVED: { label: "Archived", variant: "destructive" },
  UNARCHIVED: { label: "Reactivated", variant: "default" },
  WARNING_SENT: { label: "Warning sent", variant: "secondary" },
  FIRST_SHIFT_NUDGE_SENT: { label: "Nudge sent", variant: "secondary" },
  EXTENDED: { label: "Extended", variant: "outline" },
};

const TRIGGER_LABEL: Record<LogEntry["triggerSource"], string> = {
  MANUAL: "Admin",
  CRON: "Cron",
  SELF_EXTENSION: "Email link",
  SELF_REACTIVATION: "Self",
};

const PAGE_SIZE = 50;

export function ArchivingLog() {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/archiving/log?page=${targetPage}&pageSize=${PAGE_SIZE}`
      );
      if (!res.ok) throw new Error("Failed to load log");
      const data = await res.json();
      setLogs(data.logs as LogEntry[]);
      setTotal(data.total ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

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
          onClick={() => fetchLogs(page)}
          disabled={loading}
          data-testid="archiving-log-refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {logs === null ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : logs.length === 0 ? (
          <div
            className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground"
            data-testid="archiving-log-empty"
          >
            No archive events yet.
          </div>
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
                  const eventMeta = EVENT_VARIANT[log.eventType];
                  return (
                    <TableRow
                      key={log.id}
                      data-testid={`archiving-log-row-${log.id}`}
                    >
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(log.createdAt), "dd MMM HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={eventMeta.variant}>
                          {eventMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/volunteers/${log.user.id}`}
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
                <ChevronLeft className="h-4 w-4" />
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
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
