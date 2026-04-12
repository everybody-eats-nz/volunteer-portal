import { vi, describe, it, expect, beforeEach } from "vitest";

vi.stubEnv("AUTH_SECRET", "test-secret");

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shiftType: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn(),
}));

import { GET } from "./route";
import { requireMobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

const mockRequireMobileUser = requireMobileUser as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  shiftType: { findMany: ReturnType<typeof vi.fn> };
};

function makeRequest() {
  return new Request("http://localhost/api/mobile/shift-types", {
    headers: { Authorization: "Bearer valid-token" },
  });
}

describe("GET /api/mobile/shift-types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireMobileUser.mockResolvedValue(null);

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);
  });

  it("returns shift types sorted by name", async () => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockPrisma.shiftType.findMany.mockResolvedValue([
      { id: "st-1", name: "Cleaning" },
      { id: "st-2", name: "Kitchen" },
      { id: "st-3", name: "Service" },
    ]);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json).toEqual([
      { id: "st-1", name: "Cleaning" },
      { id: "st-2", name: "Kitchen" },
      { id: "st-3", name: "Service" },
    ]);

    expect(mockPrisma.shiftType.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  });

  it("returns empty array when no shift types exist", async () => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockPrisma.shiftType.findMany.mockResolvedValue([]);

    const response = await GET(makeRequest());
    const json = await response.json();
    expect(json).toEqual([]);
  });
});
