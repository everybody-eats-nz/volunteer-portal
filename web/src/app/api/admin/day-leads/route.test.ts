import { vi, describe, it, expect, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    location: { findUnique: vi.fn() },
    dayLeadOverride: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PUT } from "./route";

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  location: { findUnique: ReturnType<typeof vi.fn> };
  dayLeadOverride: {
    upsert: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
};

function put(body: unknown) {
  return PUT(
    new Request("http://localhost/api/admin/day-leads", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }) as unknown as NextRequest
  );
}

const DAY = new Date("2026-10-27T00:00:00.000Z");

describe("PUT /api/admin/day-leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mockPrisma.location.findUnique.mockResolvedValue({ id: "loc-1" });
    mockPrisma.dayLeadOverride.upsert.mockImplementation(({ create }) =>
      Promise.resolve({ id: "override-1", ...create })
    );
  });

  it("rejects non-admins", async () => {
    mockSession.mockResolvedValue({ user: { id: "v-1", role: "VOLUNTEER" } });
    const res = await put({
      date: "2026-10-27",
      location: "Wellington",
      chef: "Kiri",
      fohManager: "",
    });
    expect(res.status).toBe(403);
    expect(mockPrisma.dayLeadOverride.upsert).not.toHaveBeenCalled();
  });

  it("saves one role and leaves the other on the standard roster", async () => {
    const res = await put({
      date: "2026-10-27",
      location: "Wellington",
      chef: "  Kiri ",
      fohManager: "",
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.dayLeadOverride.upsert).toHaveBeenCalledWith({
      where: { location_date: { location: "Wellington", date: DAY } },
      update: { chef: "Kiri", fohManager: null, updatedBy: "admin-1" },
      create: {
        location: "Wellington",
        date: DAY,
        chef: "Kiri",
        fohManager: null,
        updatedBy: "admin-1",
      },
    });
    expect(await res.json()).toEqual({
      date: "2026-10-27",
      location: "Wellington",
      override: { chef: "Kiri", fohManager: null },
    });
  });

  it("removes the day's override when both names are empty", async () => {
    const res = await put({
      date: "2026-10-27",
      location: "Wellington",
      chef: " ",
      fohManager: "",
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.dayLeadOverride.deleteMany).toHaveBeenCalledWith({
      where: { location: "Wellington", date: DAY },
    });
    expect(mockPrisma.dayLeadOverride.upsert).not.toHaveBeenCalled();
  });

  it("rejects an unknown location", async () => {
    mockPrisma.location.findUnique.mockResolvedValue(null);
    const res = await put({
      date: "2026-10-27",
      location: "Atlantis",
      chef: "Kiri",
      fohManager: "",
    });
    expect(res.status).toBe(404);
  });

  it("rejects invalid bodies", async () => {
    expect((await put("not json")).status).toBe(400);
    expect(
      (
        await put({
          date: "27/10/2026",
          location: "Wellington",
          chef: "Kiri",
          fohManager: "",
        })
      ).status
    ).toBe(400);
  });
});
