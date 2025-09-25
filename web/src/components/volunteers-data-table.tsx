"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import { useState } from "react";
import { ArrowUpDown, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { VolunteerGradeBadge } from "@/components/volunteer-grade-badge";
import { type VolunteerGrade } from "@prisma/client";

export interface Volunteer {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  availableLocations: string[];
  availableDays: string[];
  receiveShortageNotifications: boolean;
  excludedShortageNotificationTypes: string[];
  volunteerGrade?: VolunteerGrade;
  _count?: {
    signups: number;
  };
}

interface VolunteersDataTableProps {
  volunteers: Volunteer[];
  selectedVolunteers: Set<string>;
  onVolunteerToggle: (volunteerId: string) => void;
  onSelectAll: () => void;
}

export const columns: ColumnDef<Volunteer>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const volunteer = row.original;
      const displayName =
        volunteer.name ||
        `${volunteer.firstName || ""} ${volunteer.lastName || ""}`.trim() ||
        volunteer.email;
      return (
        <div>
          <div className="font-medium">{displayName}</div>
          <div className="text-sm text-muted-foreground">{volunteer.email}</div>
        </div>
      );
    },
  },
  {
    accessorKey: "volunteerGrade",
    header: "Grade",
    cell: ({ row }) => {
      const grade = row.getValue("volunteerGrade") as VolunteerGrade | undefined;
      if (!grade) return null;
      
      return (
        <VolunteerGradeBadge grade={grade} size="sm" />
      );
    },
  },
  {
    accessorKey: "availableLocations",
    header: "Locations",
    cell: ({ row }) => {
      const locations = row.getValue("availableLocations") as string[];
      return (
        <div className="flex gap-1 flex-wrap">
          {locations?.slice(0, 2).map((location) => (
            <Badge key={location} variant="outline" className="text-xs">
              {location}
            </Badge>
          ))}
          {locations?.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{locations.length - 2}
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "availableDays",
    header: "Available Days",
    cell: ({ row }) => {
      const days = row.getValue("availableDays") as string[];
      return (
        <div className="flex gap-1 flex-wrap">
          {days?.slice(0, 3).map((day) => (
            <Badge key={day} variant="secondary" className="text-xs">
              {day.slice(0, 3)}
            </Badge>
          ))}
          {days?.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{days.length - 3}
            </Badge>
          )}
        </div>
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
        >
          Shifts
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const count = row.original._count?.signups || 0;
      return <Badge variant="outline">{count} shifts</Badge>;
    },
  },
  {
    accessorKey: "receiveShortageNotifications",
    header: "Notifications",
    cell: ({ row }) => {
      const enabled = row.getValue("receiveShortageNotifications") as boolean;
      return enabled ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
      );
    },
  },
];

export function VolunteersDataTable({
  volunteers,
  selectedVolunteers,
  onVolunteerToggle,
  onSelectAll,
}: VolunteersDataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Sync row selection with external state
  const syncedRowSelection = volunteers.reduce((acc, volunteer, index) => {
    acc[index] = selectedVolunteers.has(volunteer.id);
    return acc;
  }, {} as Record<string, boolean>);

  const table = useReactTable({
    data: volunteers,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      const newSelection =
        typeof updater === "function" ? updater(syncedRowSelection) : updater;

      // Handle select all/none
      const allSelected =
        Object.keys(newSelection).length === volunteers.length &&
        Object.values(newSelection).every(Boolean);
      const noneSelected = Object.values(newSelection).every((v) => !v);

      if (allSelected || noneSelected) {
        onSelectAll();
      } else {
        // Handle individual selections
        Object.entries(newSelection).forEach(([index, isSelected]) => {
          const volunteer = volunteers[parseInt(index)];
          if (
            volunteer &&
            isSelected !== selectedVolunteers.has(volunteer.id)
          ) {
            onVolunteerToggle(volunteer.id);
          }
        });
      }

      // setRowSelection(newSelection); // Not needed as we sync with external state
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection: syncedRowSelection,
    },
  });

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <Input
          placeholder="Filter by name or email..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
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
                  className="cursor-pointer"
                  onClick={() => {
                    const volunteer = volunteers[parseInt(row.id)];
                    if (volunteer) {
                      onVolunteerToggle(volunteer.id);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
