import { describe, it, expect } from "vitest";

import {
  findActiveNavItem,
  resolveAdminBackLink,
  volunteerProfileHref,
} from "./admin-navigation";

const USERS = { label: "All Users", href: "/admin/users" };

describe("findActiveNavItem", () => {
  it("matches the dashboard only exactly", () => {
    expect(findActiveNavItem("/admin")?.href).toBe("/admin");
    expect(findActiveNavItem("/admin/unknown-page")).toBeUndefined();
  });

  it("lights the parent list on a detail route", () => {
    expect(findActiveNavItem("/admin/shifts/abc/edit")?.href).toBe(
      "/admin/shifts"
    );
  });

  it("prefers the longest matching prefix", () => {
    expect(findActiveNavItem("/admin/shifts/new")?.href).toBe(
      "/admin/shifts/new"
    );
    expect(findActiveNavItem("/admin/analytics/budget")?.href).toBe(
      "/admin/analytics/budget"
    );
    expect(findActiveNavItem("/admin/chat-guides/logs")?.href).toBe(
      "/admin/chat-guides/logs"
    );
  });

  it("only matches on a path segment boundary", () => {
    // "/admin/users" must not claim "/admin/usersx"
    expect(findActiveNavItem("/admin/usersx")).toBeUndefined();
  });

  it("falls back to the given parent for routes with no item", () => {
    expect(findActiveNavItem("/admin/volunteers/abc")).toBeUndefined();
    expect(
      findActiveNavItem("/admin/volunteers/abc", "/admin/users")?.href
    ).toBe("/admin/users");
  });
});

describe("resolveAdminBackLink", () => {
  it("labels an admin path with its nav item and keeps the query", () => {
    expect(
      resolveAdminBackLink(
        "/admin/shifts?date=2026-10-22&location=Wellington",
        USERS
      )
    ).toEqual({
      label: "Manage Shifts",
      href: "/admin/shifts?date=2026-10-22&location=Wellington",
    });
  });

  it("takes the first value of a repeated param", () => {
    expect(
      resolveAdminBackLink(["/admin/moderation", "/admin/users"], USERS)
    ).toEqual({ label: "Content Moderation", href: "/admin/moderation" });
  });

  it.each([
    undefined,
    "",
    "https://evil.example/admin",
    "//evil.example/admin",
    "/admin\\@evil.example",
    "/dashboard",
    "/admin/not-a-page",
  ])("falls back for %s", (from) => {
    expect(resolveAdminBackLink(from, USERS)).toBe(USERS);
  });
});

describe("volunteerProfileHref", () => {
  it("encodes where the profile was opened from", () => {
    expect(volunteerProfileHref("u1", "/admin/shifts?date=2026-10-22")).toBe(
      "/admin/volunteers/u1?from=%2Fadmin%2Fshifts%3Fdate%3D2026-10-22"
    );
    expect(volunteerProfileHref("u1")).toBe("/admin/volunteers/u1");
  });
});
