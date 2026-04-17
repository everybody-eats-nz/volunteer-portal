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
import { toast } from "sonner";
import { RefreshCw, ExternalLink } from "lucide-react";
import type { ArchiveCategory } from "@/lib/archive-service";
import { format } from "date-fns";

type PendingUser = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  migrationInvitationSentAt?: string | null;
  migrationInvitationCount?: number;
  effectiveLastActivityAt?: string | null;
  archiveWarningSentAt?: string | null;
};

export function PendingCategory({
  category,
  description,
  action,
  onMutation,
}: {
  category: ArchiveCategory;
  description: string;
  action: {
    label: string;
    kind: "archive" | "warn" | "nudge";
    reason?: string;
  };
  onMutation: () => void;
}) {
  const [users, setUsers] = useState<PendingUser[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [workingUserId, setWorkingUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/archiving/pending?category=${category}`
      );
      if (!res.ok) throw new Error("Failed to load candidates");
      const data = await res.json();
      setUsers(data.users as PendingUser[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const runAction = useCallback(
    async (user: PendingUser) => {
      const confirmMsg =
        action.kind === "archive"
          ? `Archive ${user.email}? They'll be soft-archived and asked to reactivate on next login.`
          : action.kind === "warn"
          ? `Send the 11-month warning email to ${user.email}?`
          : `Send the first-shift nudge email to ${user.email}?`;
      if (!confirm(confirmMsg)) return;

      setWorkingUserId(user.id);
      try {
        const body: Record<string, string> = {
          action: action.kind,
          userId: user.id,
        };
        if (action.reason) body.reason = action.reason;

        const res = await fetch("/api/admin/archiving/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Action failed");
        }
        toast.success(
          action.kind === "archive"
            ? "User archived"
            : action.kind === "warn"
            ? "Warning email sent"
            : "Nudge email sent"
        );
        await fetchUsers();
        onMutation();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      } finally {
        setWorkingUserId(null);
      }
    },
    [action, fetchUsers, onMutation]
  );

  const displayName = (u: PendingUser) =>
    u.name ||
    [u.firstName, u.lastName].filter(Boolean).join(" ") ||
    u.email.split("@")[0];

  return (
    <Card data-testid={`pending-${category}-card`}>
      <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <CardTitle>{action.label} — candidates</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchUsers}
          disabled={loading}
          data-testid={`pending-${category}-refresh`}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {users === null ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : users.length === 0 ? (
          <div
            className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground"
            data-testid={`pending-${category}-empty`}
          >
            Nothing pending here — nau mai, ka pai! 🎉
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table data-testid={`pending-${category}-table`}>
              <TableHeader>
                <TableRow>
                  <TableHead>Volunteer</TableHead>
                  <TableHead>Signed up</TableHead>
                  {category.startsWith("inactive") && (
                    <>
                      <TableHead>Last activity</TableHead>
                      <TableHead>Warning sent</TableHead>
                    </>
                  )}
                  {category === "never-migrated" && (
                    <TableHead>Invite sent</TableHead>
                  )}
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow
                    key={u.id}
                    data-testid={`pending-${category}-row-${u.id}`}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <Link
                          href={`/admin/volunteers/${u.id}`}
                          className="font-medium hover:underline inline-flex items-center gap-1"
                        >
                          {displayName(u)}
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {u.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(u.createdAt), "dd MMM yyyy")}
                    </TableCell>
                    {category.startsWith("inactive") && (
                      <>
                        <TableCell className="text-sm">
                          {u.effectiveLastActivityAt ? (
                            format(
                              new Date(u.effectiveLastActivityAt),
                              "dd MMM yyyy"
                            )
                          ) : (
                            <span className="text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.archiveWarningSentAt ? (
                            <Badge variant="secondary">
                              {format(
                                new Date(u.archiveWarningSentAt),
                                "dd MMM yyyy"
                              )}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </>
                    )}
                    {category === "never-migrated" && (
                      <TableCell className="text-sm">
                        {u.migrationInvitationSentAt ? (
                          <div className="flex flex-col">
                            <span>
                              {format(
                                new Date(u.migrationInvitationSentAt),
                                "dd MMM yyyy"
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ×{u.migrationInvitationCount ?? 0}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Never
                          </span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={
                          action.kind === "archive" ? "destructive" : "default"
                        }
                        disabled={workingUserId === u.id}
                        onClick={() => runAction(u)}
                        data-testid={`pending-${category}-action-${u.id}`}
                      >
                        {workingUserId === u.id ? "Working…" : action.label}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
