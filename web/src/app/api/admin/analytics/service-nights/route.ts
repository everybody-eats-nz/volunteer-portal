import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { nowInNZT, toNZT } from "@/lib/timezone";
import { parseDaysParam } from "@/lib/parse-days-param";

const toNum = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export interface ServiceNightRow {
  date: string; // YYYY-MM-DD (NZ)
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

// Richer row used for CSV export (superset of the table's ServiceNightRow).
interface FullServiceNightRow extends ServiceNightRow {
  cash: number | null;
  eftpos: number | null;
  stripe: number | null;
  vege: number | null;
  takeaways: number | null;
  eftposTransactions: number | null;
  notes: string | null;
}

const CSV_COLUMNS: { header: string; value: (r: FullServiceNightRow) => unknown }[] = [
  { header: "Date", value: (r) => r.date },
  { header: "Location", value: (r) => r.location },
  { header: "Customers", value: (r) => r.customers },
  { header: "Non-paying", value: (r) => r.nonPaying },
  { header: "Cash", value: (r) => r.cash },
  { header: "Eftpos", value: (r) => r.eftpos },
  { header: "Quest/Stripe", value: (r) => r.stripe },
  { header: "Total koha", value: (r) => r.totalKoha },
  { header: "$ per head", value: (r) => r.perHead },
  { header: "Bookings", value: (r) => r.bookings },
  { header: "New volunteers", value: (r) => r.newVolunteers },
  { header: "Vege", value: (r) => r.vege },
  { header: "Takeaways", value: (r) => r.takeaways },
  { header: "Eftpos transactions", value: (r) => r.eftposTransactions },
  { header: "Protein", value: (r) => r.protein },
  { header: "Weather", value: (r) => r.weather },
  { header: "Notes", value: (r) => r.notes },
];

// RFC-4180 cell: quote when the value contains a comma, quote or newline.
const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function buildCsv(rows: FullServiceNightRow[]): string {
  const lines = [CSV_COLUMNS.map((c) => c.header).join(",")];
  for (const r of rows) {
    lines.push(CSV_COLUMNS.map((c) => csvCell(c.value(r))).join(","));
  }
  // Lead with a BOM so Excel reads UTF-8 correctly.
  return "﻿" + lines.join("\r\n");
}

const SORTABLE = new Set([
  "date",
  "location",
  "customers",
  "nonPaying",
  "totalKoha",
  "perHead",
  "newVolunteers",
  "bookings",
]);

// GET - Paginated, sortable per-night detail table (reproduces the legacy
// "all records" report). Filters mirror the analytics page.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const location = sp.get("location");
  const isLocationFiltered = !!location && location !== "all";
  const monthsRaw = sp.get("months") || "3";
  const allTime = monthsRaw === "all";
  const ytd = monthsRaw === "ytd";
  const months = allTime || ytd ? 0 : parseInt(monthsRaw, 10) || 3;
  const from = sp.get("from");
  const to = sp.get("to");
  const daysFilter = parseDaysParam(sp.get("days") || "");

  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(10, parseInt(sp.get("pageSize") || "25", 10))
  );
  const sortByRaw = sp.get("sortBy") || "date";
  const sortBy = SORTABLE.has(sortByRaw) ? sortByRaw : "date";
  const sortDir = sp.get("sortDir") === "asc" ? "asc" : "desc";
  const isCsv = sp.get("format") === "csv";

  // Date window — custom range overrides the month preset (mirrors the lib)
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const customRange =
    from && to && dateRe.test(from) && dateRe.test(to) && from <= to;
  const nz = nowInNZT();
  const todayEnd = new Date(nz.getFullYear(), nz.getMonth(), nz.getDate(), 23, 59, 59, 999);
  let startDate: Date;
  let endDate: Date;
  if (customRange) {
    startDate = new Date(`${from}T00:00:00`);
    endDate = new Date(`${to}T23:59:59.999`);
  } else if (allTime) {
    startDate = new Date(2015, 0, 1); // floor before any EE data
    endDate = todayEnd;
  } else if (ytd) {
    startDate = new Date(nz.getFullYear(), 0, 1); // Jan 1 this year
    endDate = todayEnd;
  } else {
    endDate = todayEnd;
    startDate = new Date(nz.getFullYear(), nz.getMonth() - months, nz.getDate());
  }

  try {
    const records = await prisma.mealsServed.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        ...(isLocationFiltered ? { location: location! } : {}),
      },
      select: {
        date: true,
        location: true,
        mealsServed: true,
        nonPayingCount: true,
        cash: true,
        eftpos: true,
        stripe: true,
        protein: true,
        weather: true,
        newVolunteers: true,
        bookingsPax: true,
        vege: true,
        takeaways: true,
        eftposTransactions: true,
        notes: true,
      },
    });

    const dec = (v: unknown): number | null =>
      v === null || v === undefined ? null : Number(v);

    let rows: FullServiceNightRow[] = records
      .filter((r) => !daysFilter || daysFilter.includes(toNZT(r.date).getDay()))
      .map((r) => {
        const cash = dec(r.cash);
        const eftpos = dec(r.eftpos);
        const stripe = dec(r.stripe);
        const totalKoha =
          Math.round((toNum(cash) + toNum(eftpos) + toNum(stripe)) * 100) / 100;
        const customers = r.mealsServed;
        return {
          date: r.date.toISOString().substring(0, 10),
          location: r.location,
          customers,
          nonPaying: r.nonPayingCount,
          totalKoha,
          perHead:
            customers && customers > 0
              ? Math.round((totalKoha / customers) * 100) / 100
              : null,
          protein: r.protein,
          weather: r.weather,
          newVolunteers: r.newVolunteers,
          bookings: r.bookingsPax,
          cash,
          eftpos,
          stripe,
          vege: r.vege,
          takeaways: r.takeaways,
          eftposTransactions: r.eftposTransactions,
          notes: r.notes,
        };
      });

    rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortBy as keyof ServiceNightRow];
      const bv = b[sortBy as keyof ServiceNightRow];
      if (av === null || av === undefined) return 1; // nulls last
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });

    // CSV export: every row for the current filters, richer columns for analysis.
    if (isCsv) {
      const rangeLabel = customRange
        ? `${from}_to_${to}`
        : allTime
          ? "all-time"
          : `last-${months}mo`;
      const locLabel = isLocationFiltered
        ? `_${location!.replace(/\s+/g, "-")}`
        : "";
      return new NextResponse(buildCsv(rows), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ee-service-nights_${rangeLabel}${locLabel}.csv"`,
        },
      });
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    rows = rows.slice(start, start + pageSize);

    return NextResponse.json({ rows, total, page, pageSize });
  } catch (error) {
    console.error("Error fetching service-night records:", error);
    return NextResponse.json(
      { error: "Failed to fetch records" },
      { status: 500 }
    );
  }
}
