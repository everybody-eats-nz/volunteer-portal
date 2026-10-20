import { vi, describe, it, expect, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    location: { findUnique: vi.fn() },
    shiftDayTheme: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PUT } from "./route";

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  location: { findUnique: ReturnType<typeof vi.fn> };
  shiftDayTheme: {
    upsert: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
};

function put(body: unknown) {
  return PUT(
    new Request("http://localhost/api/admin/shift-day-themes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }) as unknown as NextRequest
  );
}

const DAY = new Date("2026-12-23T00:00:00.000Z");

describe("PUT /api/admin/shift-day-themes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mockPrisma.location.findUnique.mockResolvedValue({ id: "loc-1" });
    mockPrisma.shiftDayTheme.upsert.mockImplementation(({ create }) =>
      Promise.resolve({ id: "theme-1", ...create })
    );
  });

  it("rejects non-admins", async () => {
    mockSession.mockResolvedValue({ user: { id: "v-1", role: "VOLUNTEER" } });
    const res = await put({
      date: "2026-12-23",
      location: "Wellington",
      theme: "Christmas Lunch",
    });
    expect(res.status).toBe(403);
    expect(mockPrisma.shiftDayTheme.upsert).not.toHaveBeenCalled();
  });

  it("upserts a normalized theme for the day", async () => {
    const res = await put({
      date: "2026-12-23",
      location: "Wellington",
      theme: "  Christmas   Lunch ",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      date: "2026-12-23",
      location: "Wellington",
      theme: "Christmas Lunch",
      closed: false,
    });
    expect(mockPrisma.shiftDayTheme.upsert).toHaveBeenCalledWith({
      where: { location_date: { location: "Wellington", date: DAY } },
      update: { theme: "Christmas Lunch", closed: false, updatedBy: "admin-1" },
      create: {
        date: DAY,
        location: "Wellington",
        theme: "Christmas Lunch",
        closed: false,
        updatedBy: "admin-1",
      },
    });
  });

  it("marks the day closed with the theme as the reason", async () => {
    const res = await put({
      date: "2026-12-23",
      location: "Wellington",
      theme: " Labour Day weekend ",
      closed: true,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      date: "2026-12-23",
      location: "Wellington",
      theme: "Labour Day weekend",
      closed: true,
    });
    expect(mockPrisma.shiftDayTheme.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          theme: "Labour Day weekend",
          closed: true,
          updatedBy: "admin-1",
        },
      })
    );
  });

  it("keeps a closed day with no reason", async () => {
    const res = await put({
      date: "2026-12-23",
      location: "Wellington",
      theme: "",
      closed: true,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ theme: "", closed: true });
    expect(mockPrisma.shiftDayTheme.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.shiftDayTheme.upsert).toHaveBeenCalled();
  });

  it("clears the day when the theme is empty", async () => {
    const res = await put({
      date: "2026-12-23",
      location: "Wellington",
      theme: "   ",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ theme: null, closed: false });
    expect(mockPrisma.shiftDayTheme.deleteMany).toHaveBeenCalledWith({
      where: { location: "Wellington", date: DAY },
    });
    expect(mockPrisma.shiftDayTheme.upsert).not.toHaveBeenCalled();
  });

  it("rejects an unknown location", async () => {
    mockPrisma.location.findUnique.mockResolvedValue(null);
    const res = await put({
      date: "2026-12-23",
      location: "Atlantis",
      theme: "Pasta Night",
    });
    expect(res.status).toBe(404);
    expect(mockPrisma.shiftDayTheme.upsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid date, an over-long theme and a malformed body", async () => {
    const badDate = await put({
      date: "2026-02-30",
      location: "Wellington",
      theme: "Pasta Night",
    });
    expect(badDate.status).toBe(400);

    const tooLong = await put({
      date: "2026-12-23",
      location: "Wellington",
      theme: "a".repeat(81),
    });
    expect(tooLong.status).toBe(400);
    expect((await tooLong.json()).error).toMatch(/80 characters/);

    const badClosed = await put({
      date: "2026-12-23",
      location: "Wellington",
      theme: "",
      closed: "yes",
    });
    expect(badClosed.status).toBe(400);

    const malformed = await put("{not json");
    expect(malformed.status).toBe(400);
  });
});
