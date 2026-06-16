import { describe, it, expect } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("passes through plain values", () => {
    expect(csvCell("Beef")).toBe("Beef");
    expect(csvCell("2026-06-13")).toBe("2026-06-13");
  });

  it("emits numbers verbatim (incl. negatives)", () => {
    expect(csvCell(0)).toBe("0");
    expect(csvCell(698.59)).toBe("698.59");
    expect(csvCell(-5)).toBe("-5");
  });

  it("returns empty string for null/undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes cells containing commas, quotes or newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralises formula-injection leads on string cells", () => {
    // =, +, -, @ leading a string get a single-quote prefix.
    expect(csvCell("=1+2")).toBe("'=1+2");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-cmd")).toBe("'-cmd");
  });

  it("guards AND quotes when a formula cell also has a delimiter", () => {
    expect(csvCell("=HYPERLINK(1,2)")).toBe(`"'=HYPERLINK(1,2)"`);
  });
});

describe("toCsv", () => {
  it("builds a BOM-prefixed, CRLF-delimited document", () => {
    const csv = toCsv(["Date", "Notes"], [["2026-06-13", "ok"]]);
    expect(csv).toBe("﻿Date,Notes\r\n2026-06-13,ok");
  });

  it("escapes data rows, including injection attempts in free text", () => {
    // Leads with "=" (guarded) and contains a comma (quoted).
    const csv = toCsv(["Protein", "Notes"], [["Beef", "=1,2"]]);
    expect(csv).toBe(`﻿Protein,Notes\r\nBeef,"'=1,2"`);
  });

  it("returns just the header row when there are no data rows", () => {
    expect(toCsv(["A", "B"], [])).toBe("﻿A,B");
  });
});
