import { describe, expect, it } from "vitest";
import {
  emailMatches,
  insensitiveEquals,
  isPlausibleEmail,
  normalizeEmail,
} from "./email";

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

describe("insensitiveEquals", () => {
  it("leaves ordinary text untouched", () => {
    expect(insensitiveEquals("jane.doe@example.com")).toEqual({
      equals: "jane.doe@example.com",
      mode: "insensitive",
    });
  });

  // Prisma sends the value to ILIKE as is, where these are wildcards.
  it("escapes the ILIKE wildcards so they match only themselves", () => {
    expect(insensitiveEquals("%").equals).toBe("\\%");
    expect(insensitiveEquals("jane_doe@example.com").equals).toBe(
      "jane\\_doe@example.com",
    );
    expect(insensitiveEquals("%@everybodyeats.nz").equals).toBe(
      "\\%@everybodyeats.nz",
    );
  });

  it("escapes the escape character itself", () => {
    expect(insensitiveEquals("a\\%").equals).toBe("a\\\\\\%");
  });
});

describe("emailMatches wildcards", () => {
  it("cannot be turned into a pattern that matches other addresses", () => {
    expect(emailMatches("%")).toEqual({
      email: { equals: "\\%", mode: "insensitive" },
    });
    expect(emailMatches("Jane_Doe@Example.com")).toEqual({
      email: { equals: "jane\\_doe@example.com", mode: "insensitive" },
    });
  });
});

describe("isPlausibleEmail", () => {
  it.each(["jane@example.com", " Jane_Doe+tag@Example.co.nz ", "a@b"])(
    "accepts %j",
    (email) => {
      expect(isPlausibleEmail(email)).toBe(true);
    },
  );

  it.each(["", "%", "jane", "jane@", "@example.com", "a b@example.com", "a@b@c"])(
    "rejects %j",
    (email) => {
      expect(isPlausibleEmail(email)).toBe(false);
    },
  );

  it("rejects anything longer than an address can be", () => {
    expect(isPlausibleEmail(`${"a".repeat(250)}@example.com`)).toBe(false);
  });
});
