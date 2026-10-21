"use client";

import { useCallback, useState } from "react";
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
import { TableSkeleton } from "@/components/admin/admin-skeletons";
import { EmptyState } from "@/components/admin/empty-state";
import { RefreshCw, ExternalLink, CheckCircle2 } from "lucide-react";
import type { ArchiveCategory } from "@/lib/archive-service";
import { format, formatDistanceToNowStrict } from "date-fns";
import { volunteerProfileHref } from "@/lib/admin-navigation";

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
  const [workingUserId, setWorkingUserId] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<PendingUser | null>(null);

  const {
    data,
    isValidating: loading,
    mutate: refreshUsers,
  } = useSWR<{ users: PendingUser[] }>(
    `/api/admin/archiving/pending?category=${category}`,
    {
      onError: (e) =>
        toast.error(describeError(e, "Failed to load candidates")),
    }
  );
  const users = data?.users ?? null;

  const runAction = useCallback(
    async (user: PendingUser) => {
      setConfirmUser(null);
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
        await refreshUsers();
        onMutation();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      } finally {
        setWorkingUserId(null);
      }
    },
    [action, refreshUsers, onMutation]
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
          onClick={() => refreshUsers()}
          disabled={loading}
          data-testid={`pending-${category}-refresh`}
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {users === null ? (
          <div aria-busy="true" className="overflow-hidden rounded-lg border">
            <span className="sr-only" role="status">
              Loading pending volunteers
            </span>
            <TableSkeleton
              card={false}
              rows={6}
              columns={["w-40", "w-24", "w-24", "w-20"]}
              avatar
              actions
            />
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing pending here"
            description="Ka pai! Every volunteer in this group is up to date."
            className="rounded-lg border border-dashed py-10"
            data-testid={`pending-${category}-empty`}
          />
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
                      <TableHead>Inactive for</TableHead>
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
                          href={volunteerProfileHref(u.id, "/admin/archiving")}
                          className="font-medium hover:underline inline-flex items-center gap-1"
                        >
                          {displayName(u)}
                          <ExternalLink
                            className="h-3 w-3 opacity-60"
                            aria-hidden="true"
                          />
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
                        <TableCell className="text-sm text-muted-foreground">
                          {u.effectiveLastActivityAt
                            ? formatDistanceToNowStrict(
                                new Date(u.effectiveLastActivityAt),
                                { addSuffix: true }
                              )
                            : "—"}
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
                        onClick={() => setConfirmUser(u)}
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

      <AlertDialog
        open={confirmUser !== null}
        onOpenChange={(open) => !open && setConfirmUser(null)}
      >
        <AlertDialogContent data-testid={`pending-${category}-confirm-dialog`}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action.kind === "archive"
                ? "Archive this volunteer?"
                : action.kind === "warn"
                ? "Send the warning email?"
                : "Send the nudge email?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action.kind === "archive"
                ? `Archive ${confirmUser?.email}? They'll be soft-archived and asked to reactivate on next login.`
                : action.kind === "warn"
                ? `Send the 11-month warning email to ${confirmUser?.email}?`
                : `Send the first-shift nudge email to ${confirmUser?.email}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmUser && runAction(confirmUser)}
              className={
                action.kind === "archive"
                  ? buttonVariants({ variant: "destructive" })
                  : undefined
              }
              data-testid={`pending-${category}-confirm-button`}
            >
              {action.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
