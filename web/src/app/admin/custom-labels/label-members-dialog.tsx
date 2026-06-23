"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CustomLabelBadge } from "@/components/custom-label-badge";
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
import {
  Search,
  Megaphone,
  ExternalLink,
  UserMinus,
  Users,
  AlertCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getLabelTheme } from "./label-colors";
import type { LabelWithMeta } from "./custom-labels-content";

export interface LabelMember {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePhotoUrl: string | null;
  volunteerGrade: "GREEN" | "YELLOW" | "PINK";
  assignedAt: string;
}

interface LabelMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: LabelWithMeta | null;
  /** Notify the parent that a member was removed so counts stay in sync. */
  onMemberRemoved: (labelId: string, userId: string) => void;
}

const GRADE_STYLES: Record<LabelMember["volunteerGrade"], string> = {
  GREEN:
    "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50",
  YELLOW:
    "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50",
  PINK: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/50",
};

const GRADE_LABEL: Record<LabelMember["volunteerGrade"], string> = {
  GREEN: "Standard",
  YELLOW: "Experienced",
  PINK: "Shift leader",
};

function displayName(m: LabelMember) {
  return (
    m.name || `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email
  );
}

function initials(m: LabelMember) {
  return (m.firstName?.[0] || m.name?.[0] || m.email[0]).toUpperCase();
}

export function LabelMembersDialog({
  open,
  onOpenChange,
  label,
  onMemberRemoved,
}: LabelMembersDialogProps) {
  const { toast } = useToast();
  const [members, setMembers] = useState<LabelMember[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready">(
    "idle"
  );
  const [query, setQuery] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<LabelMember | null>(null);

  const theme = getLabelTheme(label?.color);

  const loadMembers = useCallback(async () => {
    if (!label) return;
    setStatus("loading");
    try {
      const res = await fetch(`/api/admin/custom-labels/${label.id}/users`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setMembers(data.members ?? []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [label]);

  useEffect(() => {
    if (open && label) {
      setQuery("");
      loadMembers();
    } else if (!open) {
      // Reset after the close animation so content doesn't flash empty.
      const t = setTimeout(() => {
        setMembers([]);
        setStatus("idle");
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open, label, loadMembers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [displayName(m), m.email].some((v) => v.toLowerCase().includes(q))
    );
  }, [members, query]);

  const handleRemove = async (member: LabelMember) => {
    if (!label) return;
    setRemovingId(member.id);
    try {
      const res = await fetch(`/api/admin/users/${member.id}/labels`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId: label.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to remove label");
      }
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      onMemberRemoved(label.id, member.id);
      toast({
        title: "Label removed",
        description: `${displayName(member)} no longer has “${label.name}”.`,
      });
    } catch (error) {
      toast({
        title: "Couldn't remove label",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRemovingId(null);
      setConfirmRemove(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden p-0 sm:max-w-lg"
          data-testid="label-members-dialog"
        >
          {/* Themed header */}
          <div
            className={cn(
              "relative border-b px-6 pb-5 pt-6",
              theme.soft,
              "border-black/[0.04] dark:border-white/[0.06]"
            )}
          >
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="flex items-center gap-2 font-accent text-lg">
                {label && (
                  <CustomLabelBadge label={label} size="lg" />
                )}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {members.length}{" "}
                    {members.length === 1 ? "volunteer" : "volunteers"}
                  </span>
                  <span aria-hidden>·</span>
                  <span>carrying this label</span>
                </div>
              </DialogDescription>
            </DialogHeader>

            {label && members.length > 0 && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="mt-4 bg-background/70 backdrop-blur"
              >
                <Link
                  href={`/admin/announcements?labels=${label.id}`}
                  data-testid="members-announce-button"
                >
                  <Megaphone className="mr-2 h-4 w-4" />
                  Announce to this group
                </Link>
              </Button>
            )}
          </div>

          {/* Search */}
          {status === "ready" && members.length > 0 && (
            <div className="border-b border-border/60 px-6 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or email…"
                  className="pl-9"
                  data-testid="members-search-input"
                />
              </div>
            </div>
          )}

          {/* Member list */}
          <div className="max-h-[min(60vh,26rem)] overflow-y-auto px-3 py-3">
            {status === "loading" && <MembersSkeleton />}

            {status === "error" && (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm text-muted-foreground">
                  We couldn&apos;t load this group right now.
                </p>
                <Button variant="outline" size="sm" onClick={loadMembers}>
                  Try again
                </Button>
              </div>
            )}

            {status === "ready" && members.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium">No volunteers yet</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Assign this label from a volunteer&apos;s profile to start
                  building the group.
                </p>
              </div>
            )}

            {status === "ready" && members.length > 0 && filtered.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No volunteers match “{query}”.
              </div>
            )}

            <AnimatePresence initial={false}>
              {status === "ready" &&
                filtered.map((member) => (
                  <motion.div
                    key={member.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.18 }}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-muted/60"
                    data-testid={`member-row-${member.id}`}
                  >
                    <Avatar className="h-10 w-10 ring-2 ring-background">
                      <AvatarImage
                        src={member.profilePhotoUrl || undefined}
                        alt={displayName(member)}
                      />
                      <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                        {initials(member)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/users/${member.id}`}
                          className="truncate font-medium hover:underline"
                        >
                          {displayName(member)}
                        </Link>
                        <span
                          className={cn(
                            "hidden shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 sm:inline-block",
                            GRADE_STYLES[member.volunteerGrade]
                          )}
                        >
                          {GRADE_LABEL[member.volunteerGrade]}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Link
                          href={`/admin/users/${member.id}`}
                          aria-label={`Open ${displayName(member)}'s profile`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        disabled={removingId === member.id}
                        onClick={() => setConfirmRemove(member)}
                        aria-label={`Remove label from ${displayName(member)}`}
                        data-testid={`remove-member-${member.id}`}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmRemove !== null}
        onOpenChange={(o) => !o && setConfirmRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove label?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes “{label?.name}” from{" "}
              {confirmRemove ? displayName(confirmRemove) : "this volunteer"}.
              They keep their account and every other label.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRemove && handleRemove(confirmRemove)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <UserMinus className="mr-2 h-4 w-4" />
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MembersSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div
              className="h-3.5 animate-pulse rounded bg-muted"
              style={{ width: `${55 - i * 5}%` }}
            />
            <div
              className="h-2.5 animate-pulse rounded bg-muted/70"
              style={{ width: `${75 - i * 6}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
