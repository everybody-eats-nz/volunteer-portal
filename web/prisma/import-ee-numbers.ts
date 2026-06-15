/**
 * Importer for the real "Numbers" weekly tracking spreadsheets.
 *
 * Source layout (~/Downloads/EE numbers/<Location>/<Year>-...zip), unzipped to
 *   <root>/<Location>/<Year>/<Month> Numbers ....xlsx
 * Each workbook has one sheet per month (older years: one sheet per week). Every
 * sheet is a stack of weekly sections: a "Week N" marker, a header row, a TOTAL
 * row, then one row per service night (col A = the date, col B = the location).
 *
 * Crucially the columns DRIFT across years, so we parse BY HEADER NAME, not by
 * fixed column index. Three known layouts:
 *   - 2025-2026: ...customers | bookings pax | new volys | non paying | non paying no.
 *                | Meat/vege split | Takeaways | Eftpos Transactions | cash | eftpos
 *                | quest/stripe | total donations | ... | protein | notes
 *   - 2023:      ...new volys | customers | non paying | non paying no. | Meat/vege split
 *                | Takeaways | cash | eftpos | quest/stripe | total donations | ... | protein
 *   - 2020-2022: ...new volys | customers | non paying | non paying no.
 *                | cash | eftpos | quest/stripe | total donations | ... | protein
 *
 * Unlike the old Looker CSV (single donation total stored in `cash`), this source
 * has the cash / eftpos / quest-stripe split, so "Koha by method" works historically.
 *
 * Usage:
 *   npx tsx prisma/import-ee-numbers.ts [root]                  # wipe ALL MealsServed, then import
 *   npx tsx prisma/import-ee-numbers.ts [root] --dry-run        # parse + report, no DB writes
 *   npx tsx prisma/import-ee-numbers.ts [root] --no-reset       # upsert over existing rows
 *   npx tsx prisma/import-ee-numbers.ts [root] --reset-imports-only
 *       # PROD-SAFE: delete only prior-import rows (createdBy tag) and skip any
 *       # (date, location) an admin entered by hand — manual entries survive.
 *
 *   root defaults to "/Users/malin/Downloads/EE numbers/_extracted"
 *   To load prod, run locally with DATABASE_URL set to the prod (direct :5432)
 *   connection string, e.g.
 *     DATABASE_URL="<prod-direct-url>" npx tsx prisma/import-ee-numbers.ts --reset-imports-only
 */
import "dotenv/config";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { startOfDay } from "date-fns";
import { prisma } from "../src/lib/prisma";
import { parseISOInNZT, toUTC } from "../src/lib/timezone";

const DEFAULT_ROOT = "/Users/malin/Downloads/EE numbers/_extracted";

// ---- arg parsing -----------------------------------------------------------
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const root = argv.find((a) => !a.startsWith("--")) ?? DEFAULT_ROOT;
const DRY_RUN = flags.has("--dry-run");
const NO_RESET = flags.has("--no-reset");
// Prod-safe mode: delete only prior-import rows (createdBy tag) and skip any
// (date, location) an admin entered manually, so hand-entered nights survive.
const RESET_IMPORTS_ONLY = flags.has("--reset-imports-only");
const VERBOSE = flags.has("--verbose");

// createdBy tags written by import scripts (used to scope --reset-imports-only).
const IMPORT_TAGS = ["import-legacy", "import-ee-numbers"];

// ---- header synonyms -> canonical field key --------------------------------
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const HEADER_MAP: Record<string, string> = {
  location: "location",
  weather: "weather",
  customers: "customers",
  "bookings pax": "bookingsPax",
  "new volys": "newVolunteers",
  "non paying no.": "nonPayingCount",
  "non paying no": "nonPayingCount",
  "non paying": "nonPayingRatio",
  "meat/vege split": "vege",
  takeaways: "takeaways",
  "eftpos transactions": "eftposTransactions",
  cash: "cash",
  eftpos: "eftpos",
  "quest/stripe": "stripe",
  protein: "protein",
  notes: "notes",
};

type ColMap = Record<string, number>; // canonical key -> 1-based column index

// ---- cell value helpers ----------------------------------------------------
type CellV = ExcelJS.CellValue;

function cellVal(cell: ExcelJS.Cell): CellV {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if ("result" in o) return (o.result as CellV) ?? null; // formula -> cached result
    if ("error" in o) return null; // formula error (#VALUE!, #DIV/0!)
    if ("text" in o) return o.text as CellV; // hyperlink
    if ("richText" in o)
      return (o.richText as { text: string }[]).map((t) => t.text).join("");
    return null;
  }
  return v;
}

const num = (v: CellV): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return null;
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
// "Meat/vege split" is a count in newer sheets, a "meat/vege" ratio string in 2023.
const toVege = (v: CellV): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  const s = String(v).trim();
  const m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return parseInt(m[2], 10); // "meat/vege" -> vege portion
  return toInt(v);
};

// JS Date (exceljs returns UTC-midnight) -> "YYYY-MM-DD" using UTC parts.
const pad = (n: number) => String(n).padStart(2, "0");
const dateToISO = (d: Date): string =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// ---- parsed-row accumulator ------------------------------------------------
interface NightRow {
  date: string; // YYYY-MM-DD (NZ calendar date)
  location: string;
  weather: string | null;
  customers: number | null;
  bookingsPax: number | null;
  newVolunteers: number | null;
  nonPayingCount: number | null;
  vege: number | null;
  takeaways: number | null;
  eftposTransactions: number | null;
  cash: number | null;
  eftpos: number | null;
  stripe: number | null;
  protein: string | null;
  notes: string | null;
}

const FIELD_KEYS = [
  "weather",
  "customers",
  "bookingsPax",
  "newVolunteers",
  "nonPayingCount",
  "vege",
  "takeaways",
  "eftposTransactions",
  "cash",
  "eftpos",
  "stripe",
  "protein",
  "notes",
] as const;

// Coalesce-merge two rows for the same (date, location): keep first non-null per
// field so duplicate uploads (e.g. "November (1).xlsx") fill each other's gaps.
function mergeRow(a: NightRow, b: NightRow): NightRow {
  const out = { ...a };
  for (const k of FIELD_KEYS) {
    if (out[k] === null && b[k] !== null) (out[k] as unknown) = b[k];
  }
  return out;
}

function hasData(r: NightRow): boolean {
  return (
    r.customers !== null ||
    r.cash !== null ||
    r.eftpos !== null ||
    r.stripe !== null
  );
}

// ---- file discovery --------------------------------------------------------
function walkXlsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith("~$") || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walkXlsx(p));
    else if (entry.toLowerCase().endsWith(".xlsx")) out.push(p);
  }
  return out;
}

function isHeaderRow(row: ExcelJS.Row): boolean {
  let hasCustomers = false;
  let hasLocation = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    const t = typeof cell.value === "string" ? norm(cell.value) : "";
    if (t === "customers") hasCustomers = true;
    if (t === "location") hasLocation = true;
  });
  return hasCustomers && hasLocation;
}

function buildColMap(row: ExcelJS.Row): ColMap {
  const map: ColMap = {};
  row.eachCell({ includeEmpty: false }, (cell, col) => {
    if (typeof cell.value !== "string") return;
    const key = HEADER_MAP[norm(cell.value)];
    if (key && map[key] === undefined) map[key] = col;
  });
  return map;
}

function extractRow(
  row: ExcelJS.Row,
  cols: ColMap,
  fallbackLocation: string | null
): NightRow | null {
  // Date lives in column A (header is blank) and identifies a data row.
  const a = cellVal(row.getCell(1));
  if (!(a instanceof Date)) return null;
  const date = dateToISO(a);

  const get = (key: string): CellV =>
    cols[key] !== undefined ? cellVal(row.getCell(cols[key])) : null;

  // Real service nights always name one of the three venues in col B. Other
  // values ("CLOSED", "Empty Bowls Event", anniversaries, collabs) are special
  // or closed days whose columns are often shifted/loose — skip them. Only fall
  // back to the path-derived location when col B is genuinely blank.
  const rawLoc = toStr(get("location"));
  let location: string | null;
  if (rawLoc) {
    location = CANONICAL_LOCATION.get(norm(rawLoc)) ?? null;
    if (!location) return null; // non-venue (closed/event) row
  } else {
    location = fallbackLocation;
  }
  if (!location) return null;

  const customers = toInt(get("customers"));
  // "non paying no." is a formula (= ratio × customers). Some files store it as a
  // shared-formula cell with no cached result (exceljs -> null); recover it from
  // the literal ratio column when the direct value is missing.
  let nonPayingCount = toInt(get("nonPayingCount"));
  if (nonPayingCount === null) {
    const ratio = num(get("nonPayingRatio"));
    if (ratio !== null && customers !== null)
      nonPayingCount = Math.round(ratio * customers);
  }

  return {
    date,
    location,
    weather: toStr(get("weather")),
    customers,
    bookingsPax: toInt(get("bookingsPax")),
    newVolunteers: toInt(get("newVolunteers")),
    nonPayingCount,
    vege: toVege(get("vege")),
    takeaways: toInt(get("takeaways")),
    eftposTransactions: toInt(get("eftposTransactions")),
    cash: toMoney(get("cash")),
    eftpos: toMoney(get("eftpos")),
    stripe: toMoney(get("stripe")),
    protein: toStr(get("protein")),
    notes: toStr(get("notes")),
  };
}

// Location can usually be read from col B; fall back to the path segment that
// matches a known location (handles any blank-location rows).
const KNOWN_LOCATIONS = ["Glen Innes", "Onehunga", "Wellington"];
const CANONICAL_LOCATION = new Map(KNOWN_LOCATIONS.map((l) => [norm(l), l]));
function locationFromPath(file: string): string | null {
  for (const loc of KNOWN_LOCATIONS) if (file.includes(`/${loc}/`)) return loc;
  return null;
}

async function main() {
  console.log(`Reading xlsx under: ${root}`);
  const files = walkXlsx(root).sort();
  console.log(`Found ${files.length} xlsx file(s).`);
  if (!files.length) throw new Error("No xlsx files found — check the root path.");

  const byKey = new Map<string, NightRow>();
  let parsedRows = 0;
  let emptySkipped = 0;
  let fileErrors = 0;

  for (const file of files) {
    const fallback = locationFromPath(file);
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.readFile(file);
    } catch (e) {
      fileErrors++;
      console.warn(`  ! failed to read ${file}: ${(e as Error).message}`);
      continue;
    }

    let fileRows = 0;
    for (const ws of wb.worksheets) {
      let cols: ColMap | null = null;
      ws.eachRow({ includeEmpty: false }, (row) => {
        if (isHeaderRow(row)) {
          cols = buildColMap(row);
          return;
        }
        if (!cols) return;
        const parsed = extractRow(row, cols, fallback);
        if (!parsed) return;
        parsedRows++;
        fileRows++;
        if (!hasData(parsed)) {
          emptySkipped++;
          return;
        }
        const key = `${parsed.date}|${parsed.location}`;
        const existing = byKey.get(key);
        byKey.set(key, existing ? mergeRow(existing, parsed) : parsed);
      });
    }
    if (VERBOSE) console.log(`  ${fileRows.toString().padStart(4)} rows  ${file.replace(root + "/", "")}`);
  }

  const rows = [...byKey.values()];
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.location.localeCompare(b.location)));

  // Tidy free-text protein/weather that differ only by case (e.g. "beef" vs
  // "Beef", "HOT" vs "Hot"): fold each value to the most-common capitalisation
  // of its lowercased form. Leaves genuinely distinct values (and lone typos)
  // untouched.
  const canonicalizeCase = (field: "protein" | "weather") => {
    const counts = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const v = r[field];
      if (v === null) continue;
      const k = v.toLowerCase();
      const g = counts.get(k) ?? new Map<string, number>();
      g.set(v, (g.get(v) ?? 0) + 1);
      counts.set(k, g);
    }
    const canon = new Map<string, string>();
    let merged = 0;
    for (const [k, g] of counts) {
      if (g.size < 2) continue; // only one casing -> nothing to merge
      const best = [...g.entries()].sort((a, b) => b[1] - a[1])[0][0];
      canon.set(k, best);
      merged += g.size - 1;
    }
    if (merged) {
      for (const r of rows) {
        const v = r[field];
        if (v !== null && canon.has(v.toLowerCase())) r[field] = canon.get(v.toLowerCase())!;
      }
      console.log(`  case-folded ${field}: merged ${merged} variant casing(s)`);
    }
  };
  canonicalizeCase("protein");
  canonicalizeCase("weather");

  // Bucket odd one-off free-text values (combos, typos, junk) into "Other".
  const remapToOther = (field: "protein" | "weather", oddLower: Set<string>) => {
    let n = 0;
    for (const r of rows) {
      const v = r[field];
      if (v !== null && oddLower.has(v.toLowerCase())) {
        r[field] = "Other";
        n++;
      }
    }
    if (n) console.log(`  remapped ${n} ${field} oddity value(s) -> "Other"`);
  };
  remapToOther(
    "protein",
    new Set(['"chick\'n"', "beef/pork", "chicken/ham", "chorizo/chickpea", "mince"])
  );
  remapToOther("weather", new Set(["trrte", "closed"]));

  // Fold synonyms/plurals into a canonical label.
  const remapValues = (field: "protein" | "weather", map: Map<string, string>) => {
    let n = 0;
    for (const r of rows) {
      const v = r[field];
      if (v === null) continue;
      const t = map.get(v.toLowerCase());
      if (t && t !== v) {
        r[field] = t;
        n++;
      }
    }
    if (n) console.log(`  folded ${n} ${field} synonym value(s)`);
  };
  remapValues(
    "protein",
    new Map([
      ["sausages", "Sausage"],
      ["tofu", "Vegetarian"],
      ["vegan", "Vegetarian"],
      ["vege", "Vegetarian"],
    ])
  );

  // ---- report --------------------------------------------------------------
  const byLoc = new Map<string, { nights: number; koha: number; customers: number }>();
  let totCash = 0, totEftpos = 0, totStripe = 0;
  for (const r of rows) {
    const agg = byLoc.get(r.location) ?? { nights: 0, koha: 0, customers: 0 };
    agg.nights++;
    agg.koha += (r.cash ?? 0) + (r.eftpos ?? 0) + (r.stripe ?? 0);
    agg.customers += r.customers ?? 0;
    byLoc.set(r.location, agg);
    totCash += r.cash ?? 0;
    totEftpos += r.eftpos ?? 0;
    totStripe += r.stripe ?? 0;
  }
  const dates = rows.map((r) => r.date);
  console.log(
    `\nParsed ${parsedRows} data rows (${emptySkipped} empty skipped, ${fileErrors} file errors).`
  );
  console.log(`Unique (date,location) nights to import: ${rows.length}`);
  console.log(`Date range: ${dates[0]} → ${dates[dates.length - 1]}`);
  console.log("Per location:");
  for (const [loc, a] of [...byLoc.entries()].sort()) {
    console.log(
      `  ${loc.padEnd(12)} nights=${String(a.nights).padStart(4)}  customers=${String(a.customers).padStart(7)}  koha=$${a.koha.toFixed(2)}`
    );
  }
  console.log(
    `Koha by method: cash=$${totCash.toFixed(2)}  eftpos=$${totEftpos.toFixed(2)}  quest/stripe=$${totStripe.toFixed(2)}`
  );

  if (DRY_RUN) {
    console.log("\n--dry-run: no database writes.");
    await prisma.$disconnect();
    return;
  }

  // ---- ensure locations ----------------------------------------------------
  const existingLoc = new Set(
    (await prisma.location.findMany({ select: { name: true } })).map((l) => l.name)
  );
  for (const loc of byLoc.keys()) {
    if (!existingLoc.has(loc)) {
      await prisma.location.create({
        data: { name: loc, address: "Imported (historical)", isActive: false, isPopup: true },
      });
      console.log(`  + created location: ${loc}`);
    }
  }

  // ---- reset --------------------------------------------------------------
  // `preserve` holds (date,location) keys of admin-entered rows that must not be
  // touched (only populated in --reset-imports-only mode).
  const preserve = new Set<string>();
  if (RESET_IMPORTS_ONLY) {
    const del = await prisma.mealsServed.deleteMany({
      where: { createdBy: { in: IMPORT_TAGS } },
    });
    const kept = await prisma.mealsServed.findMany({
      select: { date: true, location: true },
    });
    for (const k of kept) preserve.add(`${k.date.toISOString()}|${k.location}`);
    console.log(
      `\nDeleted ${del.count} prior-import row(s); preserving ${preserve.size} admin-entered row(s).`
    );
  } else if (!NO_RESET) {
    const del = await prisma.mealsServed.deleteMany({});
    console.log(`\nDeleted ${del.count} existing MealsServed row(s).`);
  }

  // ---- insert -------------------------------------------------------------
  let written = 0;
  let preserved = 0;
  for (const r of rows) {
    const dateUTC = toUTC(startOfDay(parseISOInNZT(r.date)));
    if (preserve.has(`${dateUTC.toISOString()}|${r.location}`)) {
      preserved++;
      continue; // don't overwrite a manual admin entry
    }
    const data = {
      mealsServed: r.customers,
      weather: r.weather,
      bookingsPax: r.bookingsPax,
      newVolunteers: r.newVolunteers,
      nonPayingCount: r.nonPayingCount,
      vege: r.vege,
      takeaways: r.takeaways,
      eftposTransactions: r.eftposTransactions,
      cash: r.cash,
      eftpos: r.eftpos,
      stripe: r.stripe,
      protein: r.protein,
      notes: r.notes,
      createdBy: "import-ee-numbers",
    };
    await prisma.mealsServed.upsert({
      where: { date_location: { date: dateUTC, location: r.location } },
      update: data,
      create: { date: dateUTC, location: r.location, ...data },
    });
    written++;
    if (written % 250 === 0) console.log(`  …${written} written`);
  }

  console.log(
    `\nDone. Wrote ${written} night(s)${preserved ? `, skipped ${preserved} preserved admin entry(ies)` : ""} across ${byLoc.size} location(s).`
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
