/**
 * Importer for the historical pop-up / one-off venues in the master
 * "Donations and Customers" sheet of ~/Downloads/Weekly Numbers.xlsx.
 *
 * This is a different source from the per-location/year trackers handled by
 * import-ee-numbers.ts. It's a single flat table (Date | Location | … going back
 * to 2017) that covers the pop-up venues (Gemmayze, Woodworks, Papamoa, Te Whau)
 * and several one-offs, plus some early Wellington/Onehunga nights that predate
 * the per-location trackers.
 *
 * Behaviour:
 * - Pop-up venues are registered as Location rows (isActive:false, isPopup:true)
 *   so the app recognises them; main venues already exist.
 * - "ONE" is mapped to Onehunga; the early Wellington/Onehunga nights are
 *   back-filled into the existing locations.
 * - Inserts are SKIP-IF-EXISTS by (date, location) — authoritative data already
 *   in the DB is never overwritten, and re-running is safe.
 * - Koha split: cash → cash, "other" → eftpos, "quest/stripe" → stripe.
 *   (This source has no eftpos-transactions / vege / takeaways / bookings.)
 *
 * Usage:
 *   npx tsx prisma/import-weekly-numbers.ts [xlsx-path] [--dry-run]
 *   xlsx-path defaults to "/Users/malin/Downloads/Weekly Numbers.xlsx"
 */
import "dotenv/config";
import ExcelJS from "exceljs";
import { startOfDay } from "date-fns";
import { prisma } from "../src/lib/prisma";
import { parseISOInNZT, toUTC } from "../src/lib/timezone";

const DEFAULT_PATH = "/Users/malin/Downloads/Weekly Numbers.xlsx";
const SHEET = "Donations and Customers";

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const xlsxPath = argv.find((a) => !a.startsWith("--")) ?? DEFAULT_PATH;

// Aliases / abbreviations seen in the sheet → canonical main-venue name.
const ALIASES: Record<string, string> = {
  one: "Onehunga",
  onehunga: "Onehunga",
  wgtn: "Wellington",
  wel: "Wellington",
  wellington: "Wellington",
  gi: "Glen Innes",
  "glen innes": "Glen Innes",
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// Header text → canonical field key (this sheet's layout).
const HEADER_MAP: Record<string, string> = {
  date: "date",
  location: "location",
  weather: "weather",
  "new volys": "newVolunteers",
  customers: "customers",
  "non paying no.": "nonPayingCount",
  "non paying no": "nonPayingCount",
  cash: "cash",
  other: "eftpos", // "other" donations bucket → eftpos
  "quest/stripe": "stripe",
};

type CellV = ExcelJS.CellValue;
function cellVal(cell: ExcelJS.Cell): CellV {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if ("result" in o) return (o.result as CellV) ?? null;
    if ("error" in o) return null;
    if ("text" in o) return o.text as CellV;
    if ("richText" in o)
      return (o.richText as { text: string }[]).map((t) => t.text).join("");
    return null;
  }
  return v;
}
const num = (v: CellV): number | null => {
  if (v === null || v === undefined || typeof v === "boolean") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[$,\s]/g, "");
  if (s === "" || s.startsWith("#")) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const toInt = (v: CellV): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n);
};
const toMoney = (v: CellV): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n * 100) / 100;
};
const toStr = (v: CellV): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null" ? null : s;
};
const pad = (n: number) => String(n).padStart(2, "0");
const dateToISO = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

interface NightRow {
  date: string;
  location: string;
  isPopup: boolean;
  weather: string | null;
  customers: number | null;
  nonPayingCount: number | null;
  cash: number | null;
  eftpos: number | null;
  stripe: number | null;
  newVolunteers: number | null;
}

function canonicalLocation(raw: string): { name: string; isPopup: boolean } {
  const alias = ALIASES[norm(raw)];
  if (alias) return { name: alias, isPopup: false };
  return { name: raw.trim(), isPopup: true };
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.getWorksheet(SHEET);
  if (!ws) throw new Error(`Sheet "${SHEET}" not found in ${xlsxPath}`);

  // Build column map from the header row (first row containing "customers").
  const cols: Record<string, number> = {};
  let headerRow = 0;
  for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
    const row = ws.getRow(r);
    let hit = false;
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      if (typeof cell.value !== "string") return;
      const key = HEADER_MAP[norm(cell.value)];
      if (key && cols[key] === undefined) cols[key] = c;
      if (norm(cell.value) === "customers") hit = true;
    });
    if (hit) {
      headerRow = r;
      break;
    }
  }
  if (!cols.date || !cols.location || !cols.customers) {
    throw new Error(`Could not locate Date/Location/customers headers (got ${JSON.stringify(cols)})`);
  }
  // "non paying no." is a formula; the literal ratio sits in the column to its left.
  const ratioCol = cols.nonPayingCount ? cols.nonPayingCount - 1 : 0;

  const get = (row: ExcelJS.Row, key: string): CellV =>
    cols[key] !== undefined ? cellVal(row.getCell(cols[key])) : null;

  const rows: NightRow[] = [];
  let skippedEmpty = 0;
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const a = cellVal(row.getCell(cols.date));
    if (!(a instanceof Date)) continue; // TOTAL / AVERAGE / blank rows
    const rawLoc = toStr(get(row, "location"));
    if (!rawLoc) continue;
    const { name, isPopup } = canonicalLocation(rawLoc);

    const customers = toInt(get(row, "customers"));
    let nonPayingCount = toInt(get(row, "nonPayingCount"));
    if (nonPayingCount === null && ratioCol) {
      const ratio = num(cellVal(row.getCell(ratioCol)));
      if (ratio !== null && customers !== null)
        nonPayingCount = Math.round(ratio * customers);
    }
    const cash = toMoney(get(row, "cash"));
    const eftpos = toMoney(get(row, "eftpos"));
    const stripe = toMoney(get(row, "stripe"));

    if (customers === null && cash === null && eftpos === null && stripe === null) {
      skippedEmpty++;
      continue;
    }
    rows.push({
      date: dateToISO(a),
      location: name,
      isPopup,
      weather: toStr(get(row, "weather")),
      customers,
      nonPayingCount,
      cash,
      eftpos,
      stripe,
      newVolunteers: toInt(get(row, "newVolunteers")),
    });
  }

  // ---- report --------------------------------------------------------------
  const byLoc = new Map<string, { n: number; popup: boolean; koha: number; cust: number }>();
  for (const r of rows) {
    const g = byLoc.get(r.location) ?? { n: 0, popup: r.isPopup, koha: 0, cust: 0 };
    g.n++;
    g.koha += (r.cash ?? 0) + (r.eftpos ?? 0) + (r.stripe ?? 0);
    g.cust += r.customers ?? 0;
    byLoc.set(r.location, g);
  }
  console.log(`Parsed ${rows.length} night(s) (${skippedEmpty} empty skipped) from "${SHEET}".`);
  for (const [loc, g] of [...byLoc.entries()].sort()) {
    console.log(
      `  ${g.popup ? "popup" : "main "} ${loc.padEnd(20)} nights=${String(g.n).padStart(4)} customers=${String(g.cust).padStart(6)} koha=$${g.koha.toFixed(0)}`
    );
  }

  if (DRY_RUN) {
    console.log("\n--dry-run: no database writes.");
    await prisma.$disconnect();
    return;
  }

  // ---- ensure pop-up locations exist --------------------------------------
  const existing = new Set(
    (await prisma.location.findMany({ select: { name: true } })).map((l) => l.name)
  );
  for (const [loc, g] of byLoc) {
    if (existing.has(loc)) continue;
    await prisma.location.create({
      data: {
        name: loc,
        address: "Imported (historical pop-up)",
        isActive: false,
        isPopup: true,
      },
    });
    console.log(`  + created location: ${loc}${g.popup ? " (pop-up)" : ""}`);
  }

  // ---- insert nights (skip any (date, location) already present) -----------
  const data = rows.map((r) => ({
    date: toUTC(startOfDay(parseISOInNZT(r.date))),
    location: r.location,
    mealsServed: r.customers,
    nonPayingCount: r.nonPayingCount,
    cash: r.cash,
    eftpos: r.eftpos,
    stripe: r.stripe,
    weather: r.weather,
    newVolunteers: r.newVolunteers,
    createdBy: "import-weekly-numbers",
  }));
  const { count } = await prisma.mealsServed.createMany({
    data,
    skipDuplicates: true,
  });
  console.log(
    `\nDone. Inserted ${count} new night(s); skipped ${rows.length - count} already present, across ${byLoc.size} location(s) (${[...byLoc.values()].filter((g) => g.popup).length} pop-up).`
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
