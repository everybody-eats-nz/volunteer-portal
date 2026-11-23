import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/mobile-auth", () => ({
  requireMobileAdmin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    signup: { findMany: vi.fn() },
  },
}));

import { GET } from "./route";
import { requireMobileAdmin } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

const mockRequireMobileAdmin = requireMobileAdmin as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.signup.findMany as ReturnType<typeof vi.fn>;

function get(query = "") {
  return GET(
    new Request(`http://localhost/api/mobile/admin/signups/pending${query}`, {
      headers: { Authorization: "Bearer valid-token" },
    })
  );
}

describe("GET /api/mobile/admin/signups/pending", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireMobileAdmin.mockResolvedValue({ userId: "admin_1" });
    mockFindMany.mockResolvedValue([]);
  });

  it("returns 403 to a non-admin", async () => {
    mockRequireMobileAdmin.mockResolvedValue(null);

    const response = await get();

    expect(response.status).toBe(403);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  // Admins work the queue from the top, so the soonest shift has to be there,
  // not whichever volunteer happened to apply first.
  it("orders the queue by shift date, soonest first, keeping each shift together", async () => {
    await get();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ shift: { start: "asc" } }, { shiftId: "asc" }, { createdAt: "asc" }],
      })
    );
  });

  it("only looks at upcoming shifts at the chosen location", async () => {
    await get("?location=Wellington");

    const { where } = mockFindMany.mock.calls[0][0];
    expect(where.status).toEqual({ in: ["PENDING", "REGULAR_PENDING"] });
    expect(where.shift.location).toBe("Wellington");
    expect(where.shift.start.gte).toBeInstanceOf(Date);
  });
});
