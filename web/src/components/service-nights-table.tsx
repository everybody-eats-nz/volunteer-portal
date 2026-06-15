"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  TableProperties,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceNightRow {
  date: string;
  location: string;
  customers: number | null;
  nonPaying: number | null;
  totalKoha: number;
  perHead: number | null;
  protein: string | null;
  weather: string | null;
  newVolunteers: number | null;
  bookings: number | null;
}

interface Props {
  months: string;
  location: string;
  days: string;
  from: string;
  to: string;
}

const NZD = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
});

type SortKey =
  | "date"
  | "location"
  | "customers"
  | "nonPaying"
  | "totalKoha"
  | "perHead"
  | "newVolunteers"
  | "bookings";

const COLUMNS: {
  key: SortKey | "protein" | "weather";
  label: string;
  sortable: boolean;
  align?: "right";
  render: (r: ServiceNightRow) => React.ReactNode;
}[] = [
  {
    key: "date",
    label: "Date",
    sortable: true,
    render: (r) =>
      new Date(`${r.date}T00:00:00`).toLocaleDateString("en-NZ", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
  },
  { key: "location", label: "Location", sortable: true, render: (r) => r.location },
  {
    key: "customers",
    label: "Customers",
    sortable: true,
    align: "right",
    render: (r) => (r.customers ?? "—").toLocaleString?.() ?? r.customers ?? "—",
  },
  {
    key: "nonPaying",
    label: "Non-paying",
    sortable: true,
    align: "right",
    render: (r) => r.nonPaying ?? "—",
  },
  {
    key: "totalKoha",
    label: "Total koha",
    sortable: true,
    align: "right",
    render: (r) => (r.totalKoha ? NZD.format(r.totalKoha) : "—"),
  },
  {
    key: "perHead",
    label: "$ / head",
    sortable: true,
    align: "right",
    render: (r) => (r.perHead === null ? "—" : NZD.format(r.perHead)),
  },
  {
    key: "bookings",
    label: "Bookings",
    sortable: true,
    align: "right",
    render: (r) => r.bookings ?? "—",
  },
  {
    key: "newVolunteers",
    label: "New volys",
    sortable: true,
    align: "right",
    render: (r) => r.newVolunteers ?? "—",
  },
  { key: "protein", label: "Protein", sortable: false, render: (r) => r.protein ?? "—" },
  { key: "weather", label: "Weather", sortable: false, render: (r) => r.weather ?? "—" },
];

export function ServiceNightsTable({ months, location, days, from, to }: Props) {
  const [rows, setRows] = useState<ServiceNightRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);

  // Reset to first page whenever the applied filters change
  useEffect(() => {
    setPage(1);
  }, [months, location, days, from, to]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        months,
        location,
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        sortDir,
      });
      if (days) params.set("days", days);
      if (from && to) {
        params.set("from", from);
        params.set("to", to);
      }
      const res = await fetch(`/api/admin/analytics/service-nights?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Error loading service-night records:", error);
    } finally {
      setLoading(false);
    }
  }, [months, location, days, from, to, page, pageSize, sortBy, sortDir]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(key === "date" || key === "location" ? "asc" : "desc");
    }
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <TableProperties className="h-4 w-4 text-slate-500" />
          Service Nights
          <span className="ml-1 text-xs font-normal text-muted-foreground tabular-nums">
            {total.toLocaleString()} record{total === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {COLUMNS.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(
                      "whitespace-nowrap text-xs",
                      col.align === "right" && "text-right"
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key as SortKey)}
                        className={cn(
                          "inline-flex items-center gap-1 font-medium hover:text-foreground",
                          col.align === "right" && "flex-row-reverse",
                          sortBy === col.key
                            ? "text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {col.label}
                        {sortBy === col.key &&
                          (sortDir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          ))}
                      </button>
                    ) : (
                      <span className="font-medium text-muted-foreground">
                        {col.label}
                      </span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={COLUMNS.length}
                    className="h-32 text-center text-muted-foreground"
                  >
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={COLUMNS.length}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No service-night records for this period.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, i) => (
                  <TableRow key={`${r.date}-${r.location}-${i}`}>
                    {COLUMNS.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(
                          "whitespace-nowrap text-sm",
                          col.align === "right" && "text-right tabular-nums"
                        )}
                      >
                        {col.render(r)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {loading && rows.length > 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground tabular-nums">
            {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of{" "}
            {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              Page {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
