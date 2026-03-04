"use client";

import { useState, useTransition } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  VOLUNTEER_GRADE_INFO,
  FIRST_SHIFT_BADGE,
  NEW_VOLUNTEER_BADGE,
} from "@/lib/volunteer-grades";
import { type VolunteerGrade } from "@/generated/client";
import type {
  EngagementVolunteerRow,
  EngagementVolunteersResult,
} from "@/lib/engagement";

type EngagementStatus = "highly_active" | "active" | "inactive" | "never";

interface Props {
  data: EngagementVolunteersResult;
  months: string;
  location: string;
  initialSearch: string;
  initialStatus: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

const STATUS_LABELS: Record<
  EngagementStatus,
  { label: string; className: string }
> = {
  highly_active: {
    label: "Highly Active",
    className:
      "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  },
  active: {
    label: "Active",
    className:
      "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
  inactive: {
    label: "Inactive",
    className:
      "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  never: {
    label: "Never Volunteered",
    className:
      "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  },
};

function getDisplayName(v: EngagementVolunteerRow): string {
  if (v.name) return v.name;
  if (v.firstName || v.lastName) {
    return `${v.firstName || ""} ${v.lastName || ""}`.trim();
  }
  return v.email;
}

function getUserInitials(v: EngagementVolunteerRow): string {
  if (v.name) {
    return v.name
      .split(" ")
      .map((n) => n.charAt(0))
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }
  if (v.firstName || v.lastName) {
    return `${v.firstName?.charAt(0) || ""}${v.lastName?.charAt(0) || ""}`.toUpperCase();
  }
  return v.email.charAt(0).toUpperCase();
}

function getGradeBadge(grade: VolunteerGrade, totalShifts: number) {
  let info;
  if (totalShifts === 0) {
    info = FIRST_SHIFT_BADGE;
  } else if (totalShifts <= 5) {
    info = NEW_VOLUNTEER_BADGE;
  } else {
    info = VOLUNTEER_GRADE_INFO[grade];
  }
  return (
    <Badge variant="outline" className={info.color}>
      {info.icon} {info.label}
    </Badge>
  );
}

function buildUrl(
  overrides: Record<string, string>,
  currentParams: {
    months: string;
    location: string;
    search: string;
    status: string;
    sortBy: string;
    sortOrder: string;
    page: number;
    pageSize: number;
  }
) {
  const params = new URLSearchParams();
  const merged = {
    months: currentParams.months,
    location: currentParams.location,
    search: currentParams.search,
    status: currentParams.status,
    sortBy: currentParams.sortBy,
    sortOrder: currentParams.sortOrder,
    page: String(currentParams.page),
    pageSize: String(currentParams.pageSize),
    ...overrides,
  };

  for (const [key, value] of Object.entries(merged)) {
    if (value && value !== "all" && value !== "") {
      params.set(key, value);
    }
  }

  // Always include months (even default)
  if (!params.has("months")) params.set("months", "3");

  return `/admin/analytics/engagement?${params}`;
}

export function EngagementVolunteerTable({
  data,
  months,
  location,
  initialSearch,
  initialStatus,
  sortBy,
  sortOrder,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(initialSearch);

  const { volunteers, pagination } = data;

  const currentParams = {
    months,
    location,
    search: initialSearch,
    status: initialStatus,
    sortBy,
    sortOrder,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };

  const navigate = (overrides: Record<string, string>) => {
    startTransition(() => {
      router.push(buildUrl(overrides, currentParams));
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ search: searchInput, page: "1" });
  };

  const handleSort = (columnId: string) => {
    const isCurrentSort = sortBy === columnId;
    const newOrder = isCurrentSort && sortOrder === "asc" ? "desc" : "asc";
    navigate({ sortBy: columnId, sortOrder: newOrder, page: "1" });
  };

  const sorting: SortingState = sortBy
    ? [{ id: sortBy, desc: sortOrder === "desc" }]
    : [];

  const columns: ColumnDef<EngagementVolunteerRow>[] = [
    {
      accessorKey: "user",
      header: () => {
        const isSorted = sortBy === "user";
        return (
          <Button
            variant="ghost"
            onClick={() => handleSort("user")}
            className="p-0 h-auto font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            User
            {isSorted && sortOrder === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
            ) : isSorted && sortOrder === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </Button>
        );
      },
      cell: ({ row }) => {
        const v = row.original;
        const displayName = getDisplayName(v);
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 shadow-sm">
              <AvatarImage src={v.profilePhotoUrl || ""} alt={displayName} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-xs">
                {getUserInitials(v)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium text-sm">{displayName}</div>
              <div className="text-xs text-muted-foreground">{v.email}</div>
            </div>
          </div>
        );
      },
    },
    {
      id: "grade",
      header: "Grade",
      cell: ({ row }) => {
        const v = row.original;
        return getGradeBadge(
          v.volunteerGrade as VolunteerGrade,
          v.totalShifts
        );
      },
    },
    {
      accessorKey: "lastShiftDate",
      header: () => {
        const isSorted = sortBy === "lastShiftDate";
        return (
          <Button
            variant="ghost"
            onClick={() => handleSort("lastShiftDate")}
            className="p-0 h-auto font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Last Shift
            {isSorted && sortOrder === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
            ) : isSorted && sortOrder === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </Button>
        );
      },
      cell: ({ row }) => {
        const date = row.original.lastShiftDate;
        if (!date) {
          return (
            <span className="text-xs text-muted-foreground">Never</span>
          );
        }
        return (
          <span className="text-sm">
            {formatDistanceToNow(new Date(date), { addSuffix: true })}
          </span>
        );
      },
    },
    {
      accessorKey: "totalShifts",
      header: () => {
        const isSorted = sortBy === "totalShifts";
        return (
          <Button
            variant="ghost"
            onClick={() => handleSort("totalShifts")}
            className="p-0 h-auto font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Total
            {isSorted && sortOrder === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
            ) : isSorted && sortOrder === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="text-sm font-medium text-center">
          {row.original.totalShifts}
        </div>
      ),
    },
    {
      accessorKey: "shiftsInPeriod",
      header: () => {
        const isSorted = sortBy === "shiftsInPeriod";
        return (
          <Button
            variant="ghost"
            onClick={() => handleSort("shiftsInPeriod")}
            className="p-0 h-auto font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            In Period
            {isSorted && sortOrder === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
            ) : isSorted && sortOrder === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="text-sm font-medium text-center">
          {row.original.shiftsInPeriod}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.engagementStatus;
        const info = STATUS_LABELS[status];
        return (
          <Badge variant="outline" className={info.className}>
            {info.label}
          </Badge>
        );
      },
    },
  ];

  const table = useReactTable({
    data: volunteers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: { sorting },
    manualPagination: true,
    manualSorting: true,
    pageCount: pagination.totalPages,
  });

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <form
          onSubmit={handleSearchSubmit}
          className="flex-1 flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search volunteers..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
              data-testid="engagement-search"
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <Select
          value={initialStatus || "all"}
          onValueChange={(val) => {
            navigate({ status: val === "all" ? "" : val, page: "1" });
          }}
        >
          <SelectTrigger
            className="w-[180px]"
            data-testid="engagement-status-filter"
          >
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="highly_active">Highly Active</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="never">Never Volunteered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table with loading overlay */}
      <div className="relative rounded-md border dark:border-zinc-800 shadow-sm bg-card">
        {isPending && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10 rounded-md">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="px-4 py-3">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50 cursor-pointer"
                  onClick={() =>
                    router.push(`/admin/volunteers/${row.original.id}`)
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No volunteers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between space-x-2">
        <div className="flex-1 flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {pagination.totalCount > 0 ? (
              <>
                Showing{" "}
                {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
                {Math.min(
                  pagination.page * pagination.pageSize,
                  pagination.totalCount
                )}{" "}
                of {pagination.totalCount} volunteer(s)
              </>
            ) : (
              "No volunteers found"
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              Per page:
            </span>
            <Select
              value={pagination.pageSize.toString()}
              onValueChange={(val) => {
                navigate({ pageSize: val, page: "1" });
              }}
            >
              <SelectTrigger className="h-8 w-[70px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages || 1}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate({ page: String(pagination.page - 1) })
            }
            disabled={pagination.page <= 1 || isPending}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate({ page: String(pagination.page + 1) })
            }
            disabled={pagination.page >= pagination.totalPages || isPending}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
