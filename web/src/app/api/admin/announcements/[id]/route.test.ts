import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/storage", () => ({
  deleteFile: vi.fn(),
  extractFilePathFromUrl: vi.fn(),
  STORAGE_BUCKET: "test",
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    announcement: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PATCH } from "./route";

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockAnnouncement = prisma.announcement as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

function patch(body: unknown, id = "ann-1") {
  return PATCH(
    new Request(`http://localhost/api/admin/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );
}

describe("PATCH /api/admin/announcements/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ user: { role: "ADMIN" } });
    mockAnnouncement.findUnique.mockResolvedValue({ targetShiftIds: [] });
    mockAnnouncement.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: "ann-1", category: data.category })
    );
  });

  it("rejects non-admins", async () => {
    mockSession.mockResolvedValue({ user: { role: "VOLUNTEER" } });
    const res = await patch({ category: "PROMOTIONAL" });
    expect(res.status).toBe(403);
    expect(mockAnnouncement.update).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing announcement", async () => {
    mockAnnouncement.findUnique.mockResolvedValue(null);
    const res = await patch({ category: "PROMOTIONAL" });
    expect(res.status).toBe(404);
  });

  it("re-categorises an announcement", async () => {
    const res = await patch({ category: "PROMOTIONAL" });
    expect(res.status).toBe(200);
    expect(mockAnnouncement.update).toHaveBeenCalledWith({
      where: { id: "ann-1" },
      data: { category: "PROMOTIONAL" },
      select: { id: true, category: true },
    });
    expect(await res.json()).toEqual({
      announcement: { id: "ann-1", category: "PROMOTIONAL" },
    });
  });

  it("rejects an unknown or missing category", async () => {
    expect((await patch({ category: "NEWS" })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect(mockAnnouncement.update).not.toHaveBeenCalled();
  });

  it("refuses shift-related for an announcement that targets no shifts", async () => {
    const res = await patch({ category: "SHIFT_RELATED" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least one shift/);
    expect(mockAnnouncement.update).not.toHaveBeenCalled();
  });

  it("allows shift-related when the announcement targets shifts", async () => {
    mockAnnouncement.findUnique.mockResolvedValue({
      targetShiftIds: ["shift-1"],
    });
    const res = await patch({ category: "SHIFT_RELATED" });
    expect(res.status).toBe(200);
  });
});
