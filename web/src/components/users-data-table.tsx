"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
} from "@tanstack/react-table";
import { useState, useEffect } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Mail,
  Calendar,
  Shield,
  Users,
  ChevronRight,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type VolunteerGrade } from "@/generated/client";
import { DeleteUserDialog } from "@/components/delete-user-dialog";
import { TableSkeleton } from "@/components/loading-skeleton";

export interface User {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  profilePhotoUrl: string | null;
  role: "ADMIN" | "VOLUNTEER";
  volunteerGrade: VolunteerGrade;
  createdAt: Date;
  _count: {
    signups: number;
  };
}

interface UsersDataTableProps {
  users: User[];
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

function getUserInitials(user: User): string {
  if (user.name) {
    return user.name
      .split(" ")
      .map((name) => name.charAt(0))
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }
  if (user.firstName || user.lastName) {
    return `${user.firstName?.charAt(0) || ""}${
      user.lastName?.charAt(0) || ""
    }`.toUpperCase();
  }
  return user.email.charAt(0).toUpperCase();
}

function getDisplayName(user: User): string {
  if (user.name) return user.name;
  if (user.firstName || user.lastName) {
    return `${user.firstName || ""} ${user.lastName || ""}`.trim();
  }
  return user.email;
}

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: "user",
    header: ({ column }) => {
      const isSorted = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          User
          {isSorted === "asc" ? (
            <ArrowUp className="ml-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
          ) : isSorted === "desc" ? (
            <ArrowDown className="ml-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => {
      const user = row.original;
      const displayName = getDisplayName(user);
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shadow-sm">
            <AvatarImage src={user.profilePhotoUrl || ""} alt={displayName} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 text-white font-semibold shadow-inner text-xs">
              {getUserInitials(user)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div
              className="font-medium text-sm"
              data-testid={`user-name-${user.id}`}
            >
              {displayName}
            </div>
            <div
              className="text-xs text-muted-foreground flex items-center gap-1"
              data-testid={`user-email-${user.id}`}
            >
              <Mail className="h-3 w-3" />
              {user.email}
            </div>
          </div>
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      const nameA = getDisplayName(rowA.original);
      const nameB = getDisplayName(rowB.original);
      return nameA.localeCompare(nameB);
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <Badge
          variant="outline"
          className={
            user.role === "ADMIN"
              ? "bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 font-medium shadow-sm"
              : "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-medium shadow-sm"
          }
          data-testid={`user-role-badge-${user.id}`}
        >
          {user.role === "ADMIN" ? (
            <>
              <Shield className="h-3 w-3 mr-1" />
              Admin
            </>
          ) : (
            <>
              <Users className="h-3 w-3 mr-1" />
              Volunteer
            </>
          )}
        </Badge>
      );
    },
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => {
      const phone = row.getValue("phone") as string | null;
      return phone ? (
        <span className="text-sm font-medium">{phone}</span>
      ) : (
        <span className="text-xs text-muted-foreground">No phone</span>
      );
    },
  },
  {
    id: "signups",
    accessorKey: "_count.signups",
    header: ({ column }) => {
      const isSorted = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          Shifts
          {isSorted === "asc" ? (
            <ArrowUp className="ml-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
          ) : isSorted === "desc" ? (
            <ArrowDown className="ml-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => {
      const count = row.original._count?.signups || 0;
      const user = row.original;
      return (
        <div
          className="text-sm font-medium text-center"
          data-testid={`user-shifts-count-${user.id}`}
        >
          {count}
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => {
      const isSorted = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-medium hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          Joined
          {isSorted === "asc" ? (
            <ArrowUp className="ml-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
          ) : isSorted === "desc" ? (
            <ArrowDown className="ml-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => {
      const createdAt = row.getValue("createdAt") as Date;
      return (
        <div className="flex items-center gap-1 text-sm">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">
            {formatDistanceToNow(createdAt, { addSuffix: true })}
          </span>
        </div>
      );
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                data-testid={`user-actions-${user.id}`}
              >
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48" sideOffset={4}>
              <DropdownMenuItem asChild>
                <Link
                  href={`/admin/volunteers/${user.id}`}
                  className="flex items-center gap-2"
                  data-testid={`view-user-${user.id}`}
                >
                  <ChevronRight className="h-4 w-4" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DeleteUserDialog user={user}>
                <DropdownMenuItem
                  className="flex items-center gap-2 text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20"
                  onSelect={(e) => e.preventDefault()}
                  data-testid={`delete-user-${user.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete User
                </DropdownMenuItem>
              </DeleteUserDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export function UsersDataTable({
  users,
  currentPage,
  pageSize,
  totalCount,
  totalPages,
  sortBy,
  sortOrder,
}: UsersDataTableProps) {
  const router = useRouter();

  // Initialize sorting state from URL params
  const [sorting, setSorting] = useState<SortingState>([
    { id: sortBy, desc: sortOrder === "desc" },
  ]);

  // Track loading state when sorting
  const [isLoading, setIsLoading] = useState(false);

  // Sync sorting state when URL params change
  useEffect(() => {
    setSorting([{ id: sortBy, desc: sortOrder === "desc" }]);
    // Clear loading state when new data arrives
    setIsLoading(false);
  }, [sortBy, sortOrder]);

  // Also clear loading state when users data changes
  useEffect(() => {
    setIsLoading(false);
  }, [users]);

  const table = useReactTable({
    data: users,
    columns,
    onSortingChange: (updater) => {
      // Handle sorting change by updating URL params
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);

      if (newSorting.length > 0) {
        // Set loading state when sorting changes
        setIsLoading(true);
        const searchParams = new URLSearchParams(window.location.search);
        searchParams.set("sortBy", newSorting[0].id);
        searchParams.set("sortOrder", newSorting[0].desc ? "desc" : "asc");
        searchParams.set("page", "1"); // Reset to page 1 when sorting changes
        router.push(`?${searchParams.toString()}`);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    state: {
      sorting,
    },
    manualPagination: true,
    manualSorting: true,
    pageCount: totalPages,
  });

  const handlePageChange = (newPage: number) => {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.set("page", newPage.toString());
    router.push(`?${searchParams.toString()}`);
  };

  return (
    <div className="w-full" data-testid="users-datatable">
      <div className="rounded-md border dark:border-zinc-800 shadow-sm dark:shadow-lg dark:shadow-zinc-900/20 bg-card">
        {isLoading ? (
          <div className="p-4" data-testid="users-table-loading">
            <TableSkeleton rows={pageSize} />
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} className="px-4 py-3">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50 cursor-pointer"
                    data-testid={`user-row-${row.original.id}`}
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
                    data-testid="no-users-found"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {totalCount > 0 ? (
            <>
              Showing {(currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, totalCount)} of {totalCount}{" "}
              user(s)
            </>
          ) : (
            "No users found"
          )}
        </div>
        <div className="flex items-center space-x-2">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages || 1}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            data-testid="users-prev-page"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            data-testid="users-next-page"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
