import { vi, describe, it, expect, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    location: { findUnique: vi.fn() },
    dayLeadRoster: {
      upsert: vi.fn((args) => ({ op: "upsert", args })),
      deleteMany: vi.fn((args) => ({ op: "deleteMany", args })),
    },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PUT } from "./route";

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  location: { findUnique: ReturnType<typeof vi.fn> };
  dayLeadRoster: {
    upsert: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

function put(body: unknown) {
  return PUT(
    new Request("http://localhost/api/admin/day-leads/roster", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as NextRequest
  );
}

describe("PUT /api/admin/day-leads/roster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mockPrisma.location.findUnique.mockResolvedValue({ id: "loc-1" });
  });

  it("rejects non-admins", async () => {
    mockSession.mockResolvedValue({ user: { id: "v-1", role: "VOLUNTEER" } });
    const res = await put({ location: "Wellington", days: [] });
    expect(res.status).toBe(403);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("upserts named weekdays and clears the rest in one transaction", async () => {
    const res = await put({
      location: "Wellington",
      days: [
        { dayOfWeek: 2, chef: "Sam", fohManager: "Alex" },
        { dayOfWeek: 3, chef: "Mere", fohManager: "" },
        // Both empty: Thursday has no standard leads any more
        { dayOfWeek: 4, chef: " ", fohManager: "" },
      ],
    });

    expect(res.status).toBe(200);
    expect(mockPrisma.dayLeadRoster.deleteMany).toHaveBeenCalledWith({
      where: { location: "Wellington", dayOfWeek: { notIn: [2, 3] } },
    });
    expect(mockPrisma.dayLeadRoster.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.dayLeadRoster.upsert).toHaveBeenCalledWith({
      where: { location_dayOfWeek: { location: "Wellington", dayOfWeek: 3 } },
      update: { chef: "Mere", fohManager: null, updatedBy: "admin-1" },
      create: {
        location: "Wellington",
        dayOfWeek: 3,
        chef: "Mere",
        fohManager: null,
        updatedBy: "admin-1",
      },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({
      location: "Wellington",
      roster: {
        2: { chef: "Sam", fohManager: "Alex" },
        3: { chef: "Mere", fohManager: null },
      },
    });
  });

  it("rejects an unknown location", async () => {
    mockPrisma.location.findUnique.mockResolvedValue(null);
    const res = await put({ location: "Atlantis", days: [] });
    expect(res.status).toBe(404);
  });
});
