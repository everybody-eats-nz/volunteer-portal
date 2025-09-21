"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ArrowUpDown, Mail, Calendar, Shield, Users, ChevronRight } from "lucide-react";
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
import { type VolunteerGrade } from "@prisma/client";

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
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-medium hover:bg-transparent"
        >
          User
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const user = row.original;
      const displayName = getDisplayName(user);
      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shadow-sm">
            <AvatarImage
              src={user.profilePhotoUrl || ""}
              alt={displayName}
            />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold shadow-inner text-xs">
              {getUserInitials(user)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium text-sm" data-testid={`user-name-${user.id}`}>{displayName}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`user-email-${user.id}`}>
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
              ? "bg-gradient-to-r from-purple-50 to-violet-50 text-purple-700 border-purple-200 font-medium shadow-sm"
              : "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-200 font-medium shadow-sm"
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
    accessorKey: "_count.signups",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-medium hover:bg-transparent"
        >
          Shifts
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const count = row.original._count?.signups || 0;
      const user = row.original;
      return (
        <div className="text-center" data-testid={`user-shifts-count-${user.id}`}>
          <div className="text-lg font-bold text-slate-800">{count}</div>
          <div className="text-xs text-muted-foreground">shifts</div>
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 h-auto font-medium hover:bg-transparent"
        >
          Joined
          <ArrowUpDown className="ml-2 h-4 w-4" />
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
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-slate-100 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={`/admin/volunteers/${user.id}`}>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </Button>
      );
    },
  },
];

export function UsersDataTable({ users }: UsersDataTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true }
  ]);

  const table = useReactTable({
    data: users,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  return (
    <div className="w-full" data-testid="users-datatable">
      
      <div className="rounded-md border shadow-sm">
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
                  className="hover:bg-slate-50/50 cursor-pointer"
                  data-testid={`user-row-${row.original.id}`}
                  onClick={() => router.push(`/admin/volunteers/${row.original.id}`)}
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
      </div>
      
      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          Showing {table.getRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} user(s)
        </div>
        <div className="flex items-center space-x-2">
          <p className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            data-testid="users-prev-page"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            data-testid="users-next-page"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}