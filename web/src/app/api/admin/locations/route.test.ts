import { vi, describe, it, expect, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: { location: { findUnique: vi.fn() }, $transaction: vi.fn() },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PATCH } from "./route";

type MockFn = ReturnType<typeof vi.fn>;

/**
 * A stand-in transaction client: every `model.method` is a lazily created
 * mock resolving to an empty result, so the rename cascade runs end to end.
 */
function mockTx() {
  const fns: Record<string, MockFn> = {};
  const fn = (model: string, method: string) =>
    (fns[`${model}.${method}`] ??= vi.fn(async () =>
      method === "findMany" ? [] : { count: 0 }
    ));
  const tx = new Proxy(
    { $executeRaw: vi.fn(async () => 0) } as Record<string, unknown>,
    {
      get: (target, model: string) =>
        target[model] ??
        new Proxy({}, { get: (_, method: string) => fn(model, method) }),
    }
  );
  return { tx, fn };
}

function patch(body: Record<string, unknown>) {
  return PATCH(
    new Request("http://localhost/api/admin/locations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as unknown as NextRequest
  );
}

describe("PATCH /api/admin/locations rename", () => {
  let tx: ReturnType<typeof mockTx>;

  beforeEach(() => {
    vi.clearAllMocks();
    (getServerSession as unknown as MockFn).mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN" },
    });
    (prisma.location.findUnique as unknown as MockFn).mockResolvedValue({
      name: "Glen Innes",
    });
    tx = mockTx();
    tx.fn("location", "update").mockResolvedValue({
      id: "loc-1",
      name: "Tāmaki",
    });
    (prisma.$transaction as unknown as MockFn).mockImplementation(
      async (run: (client: unknown) => unknown) => run(tx.tx)
    );
  });

  it("carries day themes over to the new name", async () => {
    const res = await patch({ id: "loc-1", name: "Tāmaki" });

    expect(res.status).toBe(200);
    expect(tx.fn("shiftDayTheme", "updateMany")).toHaveBeenCalledWith({
      where: { location: "Glen Innes" },
      data: { location: "Tāmaki" },
    });
  });

  it("leaves day themes alone when the name is unchanged", async () => {
    const res = await patch({ id: "loc-1", address: "1 Main Road" });

    expect(res.status).toBe(200);
    expect(tx.fn("shiftDayTheme", "updateMany")).not.toHaveBeenCalled();
  });
});
