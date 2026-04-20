"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/ui/stats-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Award,
  CheckCircle2,
  Edit,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { AchievementDialog } from "./achievement-dialog";
import {
  AchievementRecipientsDialog,
  useAchievementRecipients,
} from "./achievement-recipients-dialog";
import { type Achievement } from "@/generated/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type AchievementWithCount = Achievement & {
  _count: {
    users: number;
  };
};

interface AchievementsContentProps {
  initialAchievements: AchievementWithCount[];
}

const CATEGORY_LABELS: Record<string, string> = {
  MILESTONE: "Milestone",
  DEDICATION: "Dedication",
  SPECIALIZATION: "Specialization",
  COMMUNITY: "Community",
  IMPACT: "Impact",
};

const CATEGORY_DOT: Record<string, string> = {
  MILESTONE: "bg-purple-500",
  DEDICATION: "bg-blue-500",
  SPECIALIZATION: "bg-green-500",
  COMMUNITY: "bg-orange-500",
  IMPACT: "bg-pink-500",
};

const CATEGORY_CHIP: Record<string, string> = {
  MILESTONE:
    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800/50",
  DEDICATION:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/50",
  SPECIALIZATION:
    "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800/50",
  COMMUNITY:
    "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800/50",
  IMPACT:
    "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-300 dark:border-pink-800/50",
};

type SortKey = "name" | "category" | "points" | "unlocks" | "status";
type SortDir = "asc" | "desc";

export function AchievementsContent({
  initialAchievements,
}: AchievementsContentProps) {
  const [achievements, setAchievements] =
    useState<AchievementWithCount[]>(initialAchievements);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAchievement, setEditingAchievement] =
    useState<AchievementWithCount | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [achievementToDelete, setAchievementToDelete] =
    useState<AchievementWithCount | null>(null);
  const [recipientsDialogOpen, setRecipientsDialogOpen] = useState(false);
  const [recipientsAchievement, setRecipientsAchievement] =
    useState<AchievementWithCount | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("category");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<null | "deactivate" | "delete">(
    null
  );
  const [bulkPending, setBulkPending] = useState(false);
  const {
    recipients,
    loading: recipientsLoading,
    error: recipientsError,
    fetchRecipients,
  } = useAchievementRecipients();
  const { toast } = useToast();

  const stats = useMemo(() => {
    const total = achievements.length;
    const active = achievements.filter((a) => a.isActive).length;
    const unlocks = achievements.reduce((sum, a) => sum + a._count.users, 0);
    const avg = total === 0 ? 0 : Math.round(unlocks / total);
    return { total, active, inactive: total - active, unlocks, avg };
  }, [achievements]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return achievements.filter((a) => {
      if (categoryFilter !== "all" && a.category !== categoryFilter)
        return false;
      if (statusFilter === "active" && !a.isActive) return false;
      if (statusFilter === "inactive" && a.isActive) return false;
      if (q) {
        return (
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [achievements, search, categoryFilter, statusFilter]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "category":
          return (
            (a.category.localeCompare(b.category) || a.points - b.points) * dir
          );
        case "points":
          return (a.points - b.points) * dir;
        case "unlocks":
          return (a._count.users - b._count.users) * dir;
        case "status":
          return (Number(a.isActive) - Number(b.isActive)) * dir;
      }
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const allSelected = sorted.length > 0 && sorted.every((a) => selected.has(a.id));
  const someSelected = sorted.some((a) => selected.has(a.id));

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((a) => a.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateAchievement = async (data: {
    name: string;
    description: string;
    category: string;
    icon: string;
    criteria: string;
    points: number;
    isActive?: boolean;
  }) => {
    try {
      const response = await fetch("/api/admin/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create achievement");
      }
      const newAchievement = await response.json();
      setAchievements((prev) => [
        ...prev,
        { ...newAchievement, _count: { users: 0 } },
      ]);
      toast({ title: "Success", description: "Achievement created successfully" });
      setDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create achievement",
        variant: "destructive",
      });
    }
  };

  const handleUpdateAchievement = async (
    id: string,
    data: {
      name: string;
      description: string;
      category: string;
      icon: string;
      criteria: string;
      points: number;
      isActive?: boolean;
    }
  ) => {
    try {
      const response = await fetch(`/api/admin/achievements/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update achievement");
      }
      const updatedAchievement = await response.json();
      setAchievements((prev) =>
        prev.map((a) =>
          a.id === id ? { ...updatedAchievement, _count: a._count } : a
        )
      );
      toast({ title: "Success", description: "Achievement updated successfully" });
      setDialogOpen(false);
      setEditingAchievement(null);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update achievement",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (a: AchievementWithCount) => {
    await handleUpdateAchievement(a.id, {
      name: a.name,
      description: a.description,
      category: a.category,
      icon: a.icon,
      criteria: a.criteria,
      points: a.points,
      isActive: !a.isActive,
    });
  };

  const handleDeleteAchievement = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/achievements/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete achievement");
      }
      const result = await response.json();
      if (result.deleted) {
        setAchievements((prev) => prev.filter((a) => a.id !== id));
        toast({ title: "Success", description: "Achievement deleted successfully" });
      } else {
        setAchievements((prev) =>
          prev.map((a) => (a.id === id ? { ...a, isActive: false } : a))
        );
        toast({ title: "Achievement Deactivated", description: result.message });
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete achievement",
        variant: "destructive",
      });
    }
  };

  const confirmDeleteAchievement = async () => {
    if (achievementToDelete) {
      await handleDeleteAchievement(achievementToDelete.id);
      setDeleteDialogOpen(false);
      setAchievementToDelete(null);
    }
  };

  const runBulk = async (action: "activate" | "deactivate" | "delete") => {
    setBulkPending(true);
    const ids = Array.from(selected);
    const targets = achievements.filter((a) => ids.includes(a.id));
    try {
      if (action === "delete") {
        const results = await Promise.allSettled(
          ids.map((id) =>
            fetch(`/api/admin/achievements/${id}`, { method: "DELETE" }).then(
              (r) => (r.ok ? r.json() : Promise.reject(r))
            )
          )
        );
        const deleted = new Set<string>();
        const deactivated = new Set<string>();
        results.forEach((r, i) => {
          if (r.status === "fulfilled") {
            if (r.value.deleted) deleted.add(ids[i]);
            else deactivated.add(ids[i]);
          }
        });
        setAchievements((prev) =>
          prev
            .filter((a) => !deleted.has(a.id))
            .map((a) =>
              deactivated.has(a.id) ? { ...a, isActive: false } : a
            )
        );
        toast({
          title: "Bulk delete complete",
          description: `${deleted.size} deleted · ${deactivated.size} deactivated`,
        });
      } else {
        const nextActive = action === "activate";
        const results = await Promise.allSettled(
          targets.map((a) =>
            fetch(`/api/admin/achievements/${a.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: a.name,
                description: a.description,
                category: a.category,
                icon: a.icon,
                criteria: a.criteria,
                points: a.points,
                isActive: nextActive,
              }),
            }).then((r) => (r.ok ? r.json() : Promise.reject(r)))
          )
        );
        const updatedIds = new Set(
          results
            .map((r, i) => (r.status === "fulfilled" ? targets[i].id : null))
            .filter((v): v is string => v !== null)
        );
        setAchievements((prev) =>
          prev.map((a) =>
            updatedIds.has(a.id) ? { ...a, isActive: nextActive } : a
          )
        );
        toast({
          title: nextActive ? "Activated" : "Deactivated",
          description: `${updatedIds.size} achievement(s) updated`,
        });
      }
      setSelected(new Set());
      setBulkDialog(null);
    } catch {
      toast({
        title: "Error",
        description: "One or more actions failed",
        variant: "destructive",
      });
    } finally {
      setBulkPending(false);
    }
  };

  const openDeleteDialog = (a: AchievementWithCount) => {
    setAchievementToDelete(a);
    setDeleteDialogOpen(true);
  };

  const openEditDialog = (a: AchievementWithCount) => {
    setEditingAchievement(a);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingAchievement(null);
    setDialogOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
  };

  const hasActiveFilters =
    search !== "" || categoryFilter !== "all" || statusFilter !== "all";

  return (
    <div className="space-y-6">
      {/* Stats strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total achievements"
          value={stats.total}
          subtitle={`${stats.active} active · ${stats.inactive} inactive`}
          icon={Award}
          variant="primary"
          testId="stat-total-achievements"
        />
        <StatsCard
          title="Active"
          value={stats.active}
          subtitle="Currently unlockable"
          icon={CheckCircle2}
          variant="green"
          testId="stat-active-achievements"
        />
        <StatsCard
          title="Total unlocks"
          value={stats.unlocks.toLocaleString()}
          subtitle="Across all volunteers"
          icon={Sparkles}
          variant="purple"
          testId="stat-total-unlocks"
        />
        <StatsCard
          title="Avg per achievement"
          value={stats.avg.toLocaleString()}
          subtitle="Unlocks per badge"
          icon={TrendingUp}
          variant="amber"
          testId="stat-avg-unlocks"
        />
      </div>

      {/* Toolbar */}
      <div className="rounded-lg border bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="achievements-search"
                aria-label="Search achievements"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={categoryFilter}
                onValueChange={setCategoryFilter}
              >
                <SelectTrigger
                  className="w-[160px]"
                  aria-label="Filter by category"
                  data-testid="achievements-category-filter"
                >
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger
                  className="w-[140px]"
                  aria-label="Filter by status"
                  data-testid="achievements-status-filter"
                >
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground"
                >
                  <X className="mr-1 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </div>
          <Button
            onClick={openCreateDialog}
            data-testid="create-achievement-button"
          >
            <Plus className="mr-2 h-4 w-4" />
            New achievement
          </Button>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Showing {sorted.length} of {achievements.length}
          {hasActiveFilters ? " (filtered)" : ""}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          className="sticky top-20 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 backdrop-blur-sm dark:bg-primary/10"
          data-testid="bulk-action-bar"
        >
          <div className="text-sm font-medium">
            {selected.size} selected
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runBulk("activate")}
              disabled={bulkPending}
            >
              Activate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkDialog("deactivate")}
              disabled={bulkPending}
            >
              Deactivate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setBulkDialog("delete")}
              disabled={bulkPending}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              disabled={bulkPending}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear selection</span>
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {achievements.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Award className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">No achievements yet</h3>
          <p className="mb-6 text-sm text-muted-foreground">
            Create your first achievement to motivate volunteers.
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Create first achievement
          </Button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            No achievements match your filters.
          </p>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all achievements"
                    className={cn(
                      someSelected && !allSelected && "data-[state=unchecked]:bg-primary/20"
                    )}
                  />
                </TableHead>
                <SortableHead
                  label="Achievement"
                  sortKey="name"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Category"
                  sortKey="category"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Points"
                  sortKey="points"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={toggleSort}
                  className="text-right"
                />
                <SortableHead
                  label="Unlocks"
                  sortKey="unlocks"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={toggleSort}
                  className="text-right"
                />
                <SortableHead
                  label="Status"
                  sortKey="status"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={toggleSort}
                />
                <TableHead className="w-10 text-right pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((a) => {
                const isSelected = selected.has(a.id);
                return (
                  <TableRow
                    key={a.id}
                    data-state={isSelected ? "selected" : undefined}
                    className={cn(
                      "group",
                      !a.isActive && "opacity-60"
                    )}
                  >
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectRow(a.id)}
                        aria-label={`Select ${a.name}`}
                      />
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-start gap-3">
                        <div
                          aria-hidden
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl leading-none"
                        >
                          {a.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground">
                            {a.name}
                          </div>
                          <div className="line-clamp-1 text-xs text-muted-foreground">
                            {a.description}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1.5 font-medium",
                          CATEGORY_CHIP[a.category]
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            CATEGORY_DOT[a.category]
                          )}
                          aria-hidden
                        />
                        {CATEGORY_LABELS[a.category] || a.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">
                      {a.points}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setRecipientsAchievement(a);
                          setRecipientsDialogOpen(true);
                          fetchRecipients(a.id);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono tabular-nums text-sm hover:bg-muted transition-colors"
                        data-testid={`achievement-unlocked-${a.id}`}
                        title="View recipients"
                      >
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {a._count.users}
                      </button>
                    </TableCell>
                    <TableCell>
                      {a.isActive ? (
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800/50"
                        >
                          Active
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-muted text-muted-foreground"
                        >
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            data-testid={`achievement-actions-${a.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => openEditDialog(a)}
                            data-testid={`edit-achievement-${a.id}`}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setRecipientsAchievement(a);
                              setRecipientsDialogOpen(true);
                              fetchRecipients(a.id);
                            }}
                          >
                            <Users className="mr-2 h-4 w-4" />
                            View recipients
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(a)}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {a.isActive ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(a)}
                            className="text-destructive focus:text-destructive"
                            data-testid={`delete-achievement-${a.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AchievementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        achievement={editingAchievement}
        onSave={
          editingAchievement
            ? (data) => handleUpdateAchievement(editingAchievement.id, data)
            : handleCreateAchievement
        }
      />

      <AchievementRecipientsDialog
        open={recipientsDialogOpen}
        onOpenChange={setRecipientsDialogOpen}
        achievementName={recipientsAchievement?.name ?? ""}
        achievementIcon={recipientsAchievement?.icon ?? ""}
        recipients={recipients}
        loading={recipientsLoading}
        error={recipientsError}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete achievement
            </AlertDialogTitle>
            <AlertDialogDescription>
              {achievementToDelete && achievementToDelete._count.users > 0 ? (
                <>
                  This achievement has been unlocked by{" "}
                  {achievementToDelete._count.users} volunteer(s). It will be
                  deactivated instead of deleted to preserve volunteer progress.
                </>
              ) : (
                <>
                  Are you sure you want to delete this achievement? This action
                  cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAchievement}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {achievementToDelete && achievementToDelete._count.users > 0
                ? "Deactivate"
                : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkDialog !== null}
        onOpenChange={(o) => !o && setBulkDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkDialog === "delete"
                ? `Delete ${selected.size} achievement(s)?`
                : `Deactivate ${selected.size} achievement(s)?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkDialog === "delete"
                ? "Achievements that have been unlocked by volunteers will be deactivated instead of deleted to preserve progress."
                : "These achievements will be hidden from volunteers. You can reactivate them at any time."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                runBulk(bulkDialog === "delete" ? "delete" : "deactivate")
              }
              disabled={bulkPending}
              className={
                bulkDialog === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {bulkPending
                ? "Working..."
                : bulkDialog === "delete"
                ? "Delete"
                : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableHead({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === currentKey;
  const Icon = !active ? ArrowUpDown : currentDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={cn(className)}
      aria-sort={
        active ? (currentDir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors",
          active && "text-foreground"
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TableHead>
  );
}
