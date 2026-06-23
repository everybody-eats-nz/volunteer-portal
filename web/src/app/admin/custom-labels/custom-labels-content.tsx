"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarList } from "@/components/ui/avatar-list";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Pencil,
  Trash2,
  Megaphone,
  Tag,
  Tags,
  Users,
  Sparkles,
  Search,
  ArrowUpDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { type CustomLabel } from "@/generated/client";
import { CustomLabelDialog } from "./custom-label-dialog";
import { LabelMembersDialog } from "./label-members-dialog";
import { getLabelTheme } from "./label-colors";

export interface PreviewUser {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePhotoUrl: string | null;
}

export type LabelWithMeta = CustomLabel & {
  _count: { users: number };
  previewUsers: PreviewUser[];
};

interface CustomLabelsContentProps {
  initialLabels: LabelWithMeta[];
  taggedVolunteers: number;
}

type SortKey = "most" | "newest" | "az";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "most", label: "Most volunteers" },
  { key: "newest", label: "Newest" },
  { key: "az", label: "A–Z" },
];

export function CustomLabelsContent({
  initialLabels,
  taggedVolunteers,
}: CustomLabelsContentProps) {
  const [labels, setLabels] = useState<LabelWithMeta[]>(initialLabels);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("most");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<LabelWithMeta | null>(null);
  const [labelToDelete, setLabelToDelete] = useState<LabelWithMeta | null>(null);
  const [membersLabel, setMembersLabel] = useState<LabelWithMeta | null>(null);

  const { toast } = useToast();

  // ----- Derived stats -----
  const totalAssignments = useMemo(
    () => labels.reduce((sum, l) => sum + l._count.users, 0),
    [labels]
  );
  const unusedCount = useMemo(
    () => labels.filter((l) => l._count.users === 0).length,
    [labels]
  );
  const maxUsers = useMemo(
    () => Math.max(1, ...labels.map((l) => l._count.users)),
    [labels]
  );

  const visibleLabels = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? labels.filter((l) => l.name.toLowerCase().includes(q))
      : labels;
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "az") return a.name.localeCompare(b.name);
      if (sort === "newest")
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      // most
      if (b._count.users !== a._count.users)
        return b._count.users - a._count.users;
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [labels, query, sort]);

  // ----- CRUD -----
  const handleCreateLabel = async (data: {
    name: string;
    color: string;
    icon?: string;
  }) => {
    try {
      const response = await fetch("/api/admin/custom-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create label");
      }
      const newLabel: CustomLabel = await response.json();
      setLabels((prev) => [
        { ...newLabel, _count: { users: 0 }, previewUsers: [] },
        ...prev,
      ]);
      toast({ title: "Label created", description: `“${newLabel.name}” is ready to use.` });
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create label",
        variant: "destructive",
      });
    }
  };

  const handleUpdateLabel = async (
    id: string,
    data: { name: string; color: string; icon?: string }
  ) => {
    try {
      const response = await fetch(`/api/admin/custom-labels/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update label");
      }
      const updatedLabel: CustomLabel = await response.json();
      setLabels((prev) =>
        prev.map((label) =>
          label.id === id
            ? {
                ...updatedLabel,
                _count: label._count,
                previewUsers: label.previewUsers,
              }
            : label
        )
      );
      toast({ title: "Label updated", description: "Your changes are saved." });
      setDialogOpen(false);
      setEditingLabel(null);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update label",
        variant: "destructive",
      });
    }
  };

  const confirmDeleteLabel = async () => {
    if (!labelToDelete) return;
    try {
      const response = await fetch(
        `/api/admin/custom-labels/${labelToDelete.id}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete label");
      }
      setLabels((prev) => prev.filter((label) => label.id !== labelToDelete.id));
      toast({ title: "Label deleted", description: `“${labelToDelete.name}” was removed.` });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete label",
        variant: "destructive",
      });
    } finally {
      setLabelToDelete(null);
    }
  };

  const handleMemberRemoved = (labelId: string, userId: string) => {
    setLabels((prev) =>
      prev.map((label) =>
        label.id === labelId
          ? {
              ...label,
              _count: { users: Math.max(0, label._count.users - 1) },
              previewUsers: label.previewUsers.filter((u) => u.id !== userId),
            }
          : label
      )
    );
  };

  const openCreateDialog = () => {
    setEditingLabel(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6" data-testid="custom-labels-page">
      {/* ===== Hero ===== */}
      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-2xl border border-[#1d5337]/15 bg-gradient-to-br from-[#1d5337] to-[#2e6438] p-6 text-white sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#f8fb69]/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-white/5 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <h1 className="font-accent text-2xl font-semibold leading-tight sm:text-3xl">
              Group your whānau with custom labels
            </h1>
            <p className="mt-2 text-sm text-white/80 sm:text-base">
              Tag volunteers to segment announcements, spotlight specialists,
              and keep your community organised at a glance.
            </p>
          </div>
          <Button
            onClick={openCreateDialog}
            size="lg"
            className="shrink-0 self-start bg-[#f8fb69] font-semibold text-[#1d3a26] shadow-sm hover:bg-[#f8fb69]/90 sm:self-auto"
            data-testid="create-label-button"
          >
            <Plus className="mr-2 h-4 w-4" />
            New label
          </Button>
        </div>
      </motion.section>

      {/* ===== KPI tiles ===== */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          icon={<Tag className="h-4 w-4" />}
          label="Labels"
          value={labels.length}
          tone="forest"
        />
        <KpiTile
          icon={<Users className="h-4 w-4" />}
          label="Volunteers tagged"
          value={taggedVolunteers}
          tone="blue"
        />
        <KpiTile
          icon={<Sparkles className="h-4 w-4" />}
          label="Total assignments"
          value={totalAssignments}
          tone="violet"
        />
        <KpiTile
          icon={<Tags className="h-4 w-4" />}
          label="Unused"
          value={unusedCount}
          tone={unusedCount > 0 ? "amber" : "neutral"}
        />
      </div>

      {/* ===== Toolbar ===== */}
      {labels.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search labels…"
              className="pl-9"
              data-testid="label-search-input"
            />
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  sort === s.key
                    ? "bg-[#1d5337] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`sort-${s.key}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== Gallery ===== */}
      {labels.length === 0 ? (
        <EmptyState onCreate={openCreateDialog} />
      ) : visibleLabels.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <p className="font-medium">No labels match “{query}”.</p>
          <Button
            variant="link"
            onClick={() => setQuery("")}
            className="mt-1"
          >
            Clear search
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleLabels.map((label, i) => (
            <LabelCard
              key={label.id}
              label={label}
              index={i}
              maxUsers={maxUsers}
              onViewMembers={() => setMembersLabel(label)}
              onEdit={() => {
                setEditingLabel(label);
                setDialogOpen(true);
              }}
              onDelete={() => setLabelToDelete(label)}
            />
          ))}
        </div>
      )}

      {/* ===== Dialogs ===== */}
      <CustomLabelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        label={editingLabel}
        onSave={
          editingLabel
            ? (data) => handleUpdateLabel(editingLabel.id, data)
            : handleCreateLabel
        }
      />

      <LabelMembersDialog
        open={membersLabel !== null}
        onOpenChange={(o) => !o && setMembersLabel(null)}
        label={membersLabel}
        onMemberRemoved={handleMemberRemoved}
      />

      <AlertDialog
        open={labelToDelete !== null}
        onOpenChange={(o) => !o && setLabelToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete custom label
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete “{labelToDelete?.name}”? This
              hides it everywhere. You can recreate it later, but it won&apos;t
              reappear on volunteers automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteLabel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete label
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Label card                                                                */
/* -------------------------------------------------------------------------- */

interface LabelCardProps {
  label: LabelWithMeta;
  index: number;
  maxUsers: number;
  onViewMembers: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function LabelCard({
  label,
  index,
  maxUsers,
  onViewMembers,
  onEdit,
  onDelete,
}: LabelCardProps) {
  const theme = getLabelTheme(label.color);
  const count = label._count.users;
  const hasMembers = count > 0;
  const pct = Math.round((count / maxUsers) * 100);
  const created = new Date(label.createdAt).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.04, 0.32) }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 transition-shadow hover:shadow-md",
        theme.ring
      )}
      data-testid={`label-card-${label.id}`}
    >
      {/* Coloured spine */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent",
          theme.glow
        )}
      />

      <div className="relative flex flex-1 flex-col p-5">
        {/* Header: swatch + badge + actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CustomLabelBadge label={label} />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Created {created}
            </p>
          </div>

          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-0.5">
              {hasMembers && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-[#1d5337] dark:hover:text-emerald-300"
                    >
                      <Link
                        href={`/admin/announcements?labels=${label.id}`}
                        aria-label={`Announce to ${label.name} volunteers`}
                        data-testid={`announce-label-${label.id}`}
                      >
                        <Megaphone className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Announce to this group</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={onEdit}
                    data-testid={`edit-label-${label.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit label</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                      onClick={onDelete}
                      disabled={hasMembers}
                      data-testid={`delete-label-${label.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {hasMembers
                    ? "Remove all volunteers first"
                    : "Delete label"}
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* Usage bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">
              {count} {count === 1 ? "volunteer" : "volunteers"}
            </span>
            {hasMembers && (
              <span className="tabular-nums text-muted-foreground">{pct}%</span>
            )}
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            {hasMembers && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className={cn("h-full rounded-full", theme.bar)}
              />
            )}
          </div>
        </div>

        {/* Members footer — clickable */}
        <div className="mt-auto pt-4">
          {hasMembers ? (
            <button
              type="button"
              onClick={onViewMembers}
              className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-background/50 px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-muted/60"
              data-testid={`view-members-${label.id}`}
            >
              <span className="flex items-center gap-3">
                <AvatarList
                  users={label.previewUsers}
                  size="sm"
                  maxDisplay={4}
                  totalCount={count}
                  enableLinks={false}
                />
                <span className="text-sm font-medium text-foreground">
                  View members
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-background/30 px-3 py-2.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              No volunteers yet
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  KPI tile                                                                   */
/* -------------------------------------------------------------------------- */

type Tone = "forest" | "blue" | "violet" | "amber" | "neutral";

const TONE_STYLES: Record<Tone, { ring: string; iconWrap: string; value: string }> = {
  forest: {
    ring: "ring-[#1d5337]/12",
    iconWrap:
      "bg-[#1d5337]/10 text-[#1d5337] dark:bg-emerald-400/15 dark:text-emerald-300",
    value: "text-[#1d5337] dark:text-emerald-200",
  },
  blue: {
    ring: "ring-blue-400/20",
    iconWrap: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    value: "text-blue-700 dark:text-blue-200",
  },
  violet: {
    ring: "ring-violet-400/20",
    iconWrap: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    value: "text-violet-700 dark:text-violet-200",
  },
  amber: {
    ring: "ring-amber-400/30",
    iconWrap: "bg-amber-400/15 text-amber-600 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-400",
  },
  neutral: {
    ring: "ring-border",
    iconWrap: "bg-muted text-muted-foreground",
    value: "text-foreground",
  },
};

function KpiTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: Tone;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-2xl bg-card p-4 shadow-sm ring-1 dark:bg-white/[0.02]",
        styles.ring
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg",
            styles.iconWrap
          )}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3">
        <span
          className={cn(
            "font-accent text-3xl font-semibold tabular-nums leading-none",
            styles.value
          )}
        >
          {value}
        </span>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Empty state                                                               */
/* -------------------------------------------------------------------------- */

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1d5337]/10 text-[#1d5337] dark:bg-emerald-400/15 dark:text-emerald-300">
        <Tags className="h-7 w-7" />
      </div>
      <h3 className="mt-4 font-accent text-xl font-semibold">
        No labels yet
      </h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
        Create your first custom label to group volunteers — handy for targeted
        announcements and spotting specialists.
      </p>
      <Button
        onClick={onCreate}
        className="mt-6 bg-[#1d5337] text-white hover:bg-[#1d5337]/90"
        data-testid="create-first-label-button"
      >
        <Plus className="mr-2 h-4 w-4" />
        Create first label
      </Button>
    </motion.div>
  );
}
