import { describe, it, expect, vi, beforeEach } from "vitest";

import { POST, PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { requireVanAdmin } from "@/lib/van/admin-guard";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organisation: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/van/admin-guard", () => ({
  requireVanAdmin: vi.fn(),
}));

const guard = vi.mocked(requireVanAdmin);
const create = vi.mocked(prisma.organisation.create);
const update = vi.mocked(prisma.organisation.update);
const findUnique = vi.mocked(prisma.organisation.findUnique);
const count = vi.mocked(prisma.organisation.count);

const post = (body: unknown) =>
  POST(new Request("http://t/api", { method: "POST", body: JSON.stringify(body) }));
const patch = (body: unknown) =>
  PATCH(new Request("http://t/api", { method: "PATCH", body: JSON.stringify(body) }));

const org = (overrides: Record<string, unknown> = {}) => ({
  id: "org-1",
  name: "Kaibosh",
  isInternal: false,
  isCatchAll: false,
  isActive: true,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  guard.mockResolvedValue({ userId: "admin-1" });
  create.mockImplementation((({ data }: { data: object }) =>
    Promise.resolve({ id: "new", ...data })) as never);
  update.mockResolvedValue(org() as never);
  count.mockResolvedValue(5);
});

describe("POST /api/admin/van/organisations", () => {
  it("refuses anyone who is not a van admin", async () => {
    guard.mockResolvedValue({
      denied: Response.json({ error: "Unauthorized" }, { status: 403 }) as never,
    });

    const response = await post({ name: "Kaibosh" });

    expect(response.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("creates the organisation an admin asked for", async () => {
    const response = await post({ name: "  Kaibosh  ", isInternal: true });

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith({
      data: { name: "Kaibosh", isInternal: true, isCatchAll: false },
    });
  });

  it("never lets a second catch-all in, however it is asked for", async () => {
    // Only one row may carry it: the trip flow keys off that row to let a
    // driver name a one-off borrower, and two of them make it ambiguous.
    await post({ name: "Sneaky", isCatchAll: true });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isCatchAll: false }),
    });
  });

  it("says so plainly when the name is taken", async () => {
    create.mockRejectedValue(new Error("unique constraint"));

    const response = await post({ name: "Kaibosh" });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "An organisation with that name already exists.",
    });
  });
});

describe("PATCH /api/admin/van/organisations", () => {
  it("renames an organisation", async () => {
    findUnique.mockResolvedValue(org() as never);

    const response = await patch({ id: "org-1", name: "Kaibosh Food Rescue" });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { name: "Kaibosh Food Rescue" },
    });
  });

  it("refuses to retire the catch-all", async () => {
    findUnique.mockResolvedValue(org({ isCatchAll: true }) as never);

    const response = await patch({ id: "org-1", isActive: false });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses to retire the last organisation a van could belong to", async () => {
    // Allowing this recreates the dead end this whole screen exists to fix.
    findUnique.mockResolvedValue(org() as never);
    count.mockResolvedValue(1);

    const response = await patch({ id: "org-1", isActive: false });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("retires one when others remain", async () => {
    findUnique.mockResolvedValue(org() as never);
    count.mockResolvedValue(2);

    const response = await patch({ id: "org-1", isActive: false });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { isActive: false },
    });
  });

  it("does not count the catch-all guard against restoring one", async () => {
    findUnique.mockResolvedValue(org({ isActive: false }) as never);

    const response = await patch({ id: "org-1", isActive: true });

    expect(response.status).toBe(200);
    expect(count).not.toHaveBeenCalled();
  });

  it("never clears the catch-all flag, however it is asked for", async () => {
    findUnique.mockResolvedValue(org({ isCatchAll: true }) as never);

    await patch({ id: "org-1", isCatchAll: false, name: "Renamed" });

    expect(update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { name: "Renamed" },
    });
  });

  it("404s on an organisation that is not there", async () => {
    findUnique.mockResolvedValue(null as never);

    const response = await patch({ id: "ghost", name: "Nope" });

    expect(response.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });
});
