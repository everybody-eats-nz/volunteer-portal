import { describe, it, expect } from "vitest";
import { escapeCsvCell, toCsv } from "./csv";

describe("escapeCsvCell", () => {
  it("leaves ordinary values alone", () => {
    expect(escapeCsvCell("Food Rescue")).toBe("Food Rescue");
    expect(escapeCsvCell(42)).toBe("42");
  });

  it("renders null and undefined as empty", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("quotes values containing a comma, quote or newline", () => {
    expect(escapeCsvCell("Wellington, Te Aro")).toBe('"Wellington, Te Aro"');
    expect(escapeCsvCell('He said "go"')).toBe('"He said ""go"""');
    expect(escapeCsvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("neutralises spreadsheet formula injection in free text", () => {
    // Trip notes and borrower names are typed by drivers, so a cell can start
    // with anything.
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell("+HYPERLINK(1)")).toBe("'+HYPERLINK(1)");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvCell("-2+3")).toBe("'-2+3");
  });

  it("quotes and neutralises together when both apply", () => {
    expect(escapeCsvCell('=CMD|"x"')).toBe(`"'=CMD|""x"""`);
  });
});

describe("toCsv", () => {
  it("writes a header row and CRLF line endings", () => {
    expect(toCsv(["a", "b"], [[1, 2], [3, 4]])).toBe("a,b\r\n1,2\r\n3,4");
  });
});
