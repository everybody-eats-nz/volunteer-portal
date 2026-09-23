import { describe, expect, it } from "vitest";
import { emailMatches, normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Jane.Doe@Example.COM ")).toBe("jane.doe@example.com");
  });

  it("leaves an already canonical address untouched", () => {
    expect(normalizeEmail("jane@example.com")).toBe("jane@example.com");
  });
});

describe("emailMatches", () => {
  it("builds a case-insensitive exact-match filter on the canonical form", () => {
    expect(emailMatches(" Jane@Example.com")).toEqual({
      email: { equals: "jane@example.com", mode: "insensitive" },
    });
  });
});
