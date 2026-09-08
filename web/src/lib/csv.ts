/**
 * CSV export shared across admin screens.
 *
 * The escaping here is not just quoting: a cell beginning with `=`, `+`, `-`,
 * `@`, tab or CR is executed as a formula by Excel and Sheets, and several of
 * the columns exported from this app are free text a volunteer or driver typed.
 */

export function escapeCsvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  // A BOM so Excel on Windows reads the macrons in "Tāmaki Van" correctly.
  const blob = new Blob(["﻿", csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
