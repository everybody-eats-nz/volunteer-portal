"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { Ban, Flag, RefreshCw, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface Reporter {
  id: string;
  firstName: string | null;
  name: string | null;
  email: string;
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

function StatusBadge({ status }: { status: string }) {
  if (status === "PENDING")
    return (
      <Badge variant="outline" className="border-orange-400 text-orange-600">
        Pending
      </Badge>
    );
  if (status === "REVIEWED")
    return (
      <Badge variant="outline" className="border-blue-400 text-blue-600">
        Reviewed
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-green-500 text-green-600">
      Resolved
    </Badge>
  );
}

function TargetTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    post: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    comment: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    user: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${map[type] ?? "bg-muted text-muted-foreground"}`}
    >
      {type}
    </span>
  );
}

export function ModerationContent() {
  const [reports, setReports] = useState<Report[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const res = await fetch("/api/admin/moderation/reports");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReports(data.reports);
    } catch {
      toast({ title: "Error", description: "Failed to load reports", variant: "destructive" });
    } finally {
      setLoadingReports(false);
    }
  }, [toast]);

  const fetchBlocks = useCallback(async () => {
    setLoadingBlocks(true);
    try {
      const res = await fetch("/api/admin/moderation/blocks");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBlocks(data.blocks);
    } catch {
      toast({ title: "Error", description: "Failed to load blocks", variant: "destructive" });
    } finally {
      setLoadingBlocks(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchReports();
    fetchBlocks();
  }, [fetchReports, fetchBlocks]);

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
        setReports((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status } : r))
        );
        toast({ title: "Updated", description: `Report marked as ${status.toLowerCase()}.` });
      } catch {
        toast({ title: "Error", description: "Failed to update report", variant: "destructive" });
      } finally {
        setUpdatingId(null);
      }
    },
    [toast]
  );

  const pendingCount = reports.filter((r) => r.status === "PENDING").length;

  return (
    <Tabs defaultValue="reports">
      <TabsList>
        <TabsTrigger value="reports" className="gap-2">
          <Flag className="h-4 w-4" />
          Reports
          {pendingCount > 0 && (
            <span className="ml-1 rounded-full bg-orange-500 text-white text-xs px-1.5 py-0.5 leading-none">
              {pendingCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="blocks" className="gap-2">
          <Ban className="h-4 w-4" />
          Blocks
          {blocks.length > 0 && (
            <span className="ml-1 rounded-full bg-muted text-muted-foreground text-xs px-1.5 py-0.5 leading-none">
              {blocks.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      {/* ── Reports ── */}
      <TabsContent value="reports" className="mt-4">
        <div className="rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm text-muted-foreground">
              {reports.length} total report{reports.length !== 1 ? "s" : ""}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchReports}
              disabled={loadingReports}
              className="gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingReports ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {loadingReports ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Loading reports…
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Flag className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No reports yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Target ID</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium leading-none">
                            {displayName(report.reporter)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {report.reporter.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <TargetTypeBadge type={report.targetType} />
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {report.targetId.length > 24
                          ? `${report.targetId.slice(0, 24)}…`
                          : report.targetId}
                      </code>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <p className="text-sm truncate" title={report.reason}>
                        {report.reason}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={report.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(report.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {report.status === "PENDING" && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingId === report.id}
                            onClick={() => updateStatus(report.id, "REVIEWED")}
                          >
                            Mark Reviewed
                          </Button>
                          <Button
                            size="sm"
                            disabled={updatingId === report.id}
                            onClick={() => updateStatus(report.id, "RESOLVED")}
                          >
                            Resolve
                          </Button>
                        </div>
                      )}
                      {report.status === "REVIEWED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingId === report.id}
                          onClick={() => updateStatus(report.id, "RESOLVED")}
                        >
                          Resolve
                        </Button>
                      )}
                      {report.status === "RESOLVED" && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
        <div className="rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm text-muted-foreground">
              {blocks.length} active block{blocks.length !== 1 ? "s" : ""}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchBlocks}
              disabled={loadingBlocks}
              className="gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingBlocks ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {loadingBlocks ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Loading blocks…
            </div>
          ) : blocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Ban className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No blocks yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Blocked by</TableHead>
                  <TableHead>Blocked user</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocks.map((block) => (
                  <TableRow key={block.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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
                        <Ban className="h-3.5 w-3.5 text-red-500 shrink-0" />
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
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
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
