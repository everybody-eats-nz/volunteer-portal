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
import { RefreshCw } from "lucide-react";
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
  triggerSource:
    | "MANUAL"
    | "CRON"
    | "SELF_EXTENSION"
    | "SELF_REACTIVATION";
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
  { label: string; variant: "default" | "destructive" | "secondary" | "outline" }
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

export function ArchivingLog() {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/archiving/log?limit=100");
      if (!res.ok) throw new Error("Failed to load log");
      const data = await res.json();
      setLogs(data.logs as LogEntry[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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
          onClick={fetchLogs}
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
                          href={`/admin/users/${log.user.id}`}
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
      </CardContent>
    </Card>
  );
}
