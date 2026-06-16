/**
 * Minimal RFC-4180 CSV helpers with spreadsheet formula-injection protection.
 *
 * CSV injection: a cell whose text begins with `=`, `+`, `-`, `@` (or a control
 * char like tab/CR) can be executed as a formula when the file is opened in
 * Excel / Google Sheets. Since our exports include admin free-text (notes,
 * protein, …), string cells with those leads are prefixed with a single quote
 * so they're always treated as text. Numbers are emitted verbatim — they can't
 * be injection vectors and we don't want to mangle negatives.
 */

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  let s = String(value);
  // Neutralise formula triggers on string cells.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  // Quote (and escape embedded quotes) when the cell contains a delimiter.
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build an RFC-4180 CSV document (CRLF line endings) from a header row and data
 * rows, prefixed with a UTF-8 BOM so Excel detects the encoding correctly.
 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  return "﻿" + lines.join("\r\n");
}
