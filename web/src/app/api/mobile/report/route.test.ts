import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contentReport: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn(),
}));

import { POST } from "./route";
import { requireMobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

const mockAuth = requireMobileUser as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  contentReport: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

function makeRequest(body?: unknown) {
  return new Request("http://localhost/api/mobile/report", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-token",
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/mobile/report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: "user-1" });
    mockPrisma.contentReport.findFirst.mockResolvedValue(null);
    mockPrisma.contentReport.create.mockResolvedValue({ id: "report-1" });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ targetType: "post", targetId: "abc", reason: "Spam" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid targetType", async () => {
    const res = await POST(makeRequest({ targetType: "image", targetId: "abc", reason: "Spam" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when targetType is missing", async () => {
    const res = await POST(makeRequest({ targetId: "abc", reason: "Spam" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when targetId is empty", async () => {
    const res = await POST(makeRequest({ targetType: "post", targetId: "  ", reason: "Spam" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when reason is missing", async () => {
    const res = await POST(makeRequest({ targetType: "post", targetId: "abc" }));
    expect(res.status).toBe(400);
  });

  it("creates a report with a valid known reason", async () => {
    const res = await POST(makeRequest({ targetType: "post", targetId: "abc", reason: "Spam" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(mockPrisma.contentReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: "Spam", targetType: "post" }),
      })
    );
  });

  it("sanitises an unrecognised reason to 'Other'", async () => {
    const res = await POST(makeRequest({ targetType: "comment", targetId: "xyz", reason: "I just don't like them" }));
    expect(res.status).toBe(200);
    expect(mockPrisma.contentReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: "Other" }),
      })
    );
  });

  it("accepts all three valid targetTypes", async () => {
    for (const targetType of ["comment", "post", "user"]) {
      vi.clearAllMocks();
      mockAuth.mockResolvedValue({ userId: "user-1" });
      mockPrisma.contentReport.findFirst.mockResolvedValue(null);
      mockPrisma.contentReport.create.mockResolvedValue({ id: "report-1" });

      const res = await POST(makeRequest({ targetType, targetId: "abc", reason: "Spam" }));
      expect(res.status).toBe(200);
    }
  });

  it("returns 200 without creating a duplicate report", async () => {
    mockPrisma.contentReport.findFirst.mockResolvedValue({ id: "existing-report" });

    const res = await POST(makeRequest({ targetType: "post", targetId: "abc", reason: "Spam" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(mockPrisma.contentReport.create).not.toHaveBeenCalled();
  });

  it("trims whitespace from targetId", async () => {
    const res = await POST(makeRequest({ targetType: "post", targetId: "  abc123  ", reason: "Spam" }));
    expect(res.status).toBe(200);
    expect(mockPrisma.contentReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ targetId: "abc123" }),
      })
    );
  });
});
