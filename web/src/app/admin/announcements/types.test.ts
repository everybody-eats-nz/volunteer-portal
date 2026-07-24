import { describe, it, expect } from "vitest";
import { isExpiryInPast, stripMarkdown } from "./types";

describe("isExpiryInPast", () => {
  const offsetLocal = (ms: number) => {
    // Build a "YYYY-MM-DDTHH:mm" string the way the composer's picker does —
    // local time, no timezone suffix.
    const d = new Date(Date.now() + ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  it("treats an empty value as no expiry", () => {
    expect(isExpiryInPast("")).toBe(false);
  });

  it("accepts a future expiry", () => {
    expect(isExpiryInPast(offsetLocal(60 * 60 * 1000))).toBe(false);
  });

  it("rejects an expiry earlier today", () => {
    // The calendar blocks past days, but the time input can still land here.
    expect(isExpiryInPast(offsetLocal(-60 * 60 * 1000))).toBe(true);
  });

  it("ignores an unparseable value rather than blocking the form", () => {
    // The server rejects it with a clear message; the client shouldn't show a
    // "already passed" warning for something that isn't a date at all.
    expect(isExpiryInPast("not-a-date")).toBe(false);
  });
});

describe("stripMarkdown", () => {
  it("unwraps links and drops images for one-line previews", () => {
    expect(stripMarkdown("See [the roster](https://x.nz) for times")).toBe(
      "See the roster for times"
    );
    expect(stripMarkdown("![poster](img.png) Dinner is on")).toBe(
      "Dinner is on"
    );
  });

  it("strips emphasis, headings and list markers", () => {
    expect(stripMarkdown("## Kia ora\n\n- **bold** item\n- *italic*")).toBe(
      "Kia ora bold item italic"
    );
  });

  it("collapses whitespace so previews stay on one line", () => {
    expect(stripMarkdown("line one\n\n\nline two")).toBe("line one line two");
  });
});
