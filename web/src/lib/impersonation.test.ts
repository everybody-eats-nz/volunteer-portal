import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JWT } from "next-auth/jwt";

const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

import { startImpersonation, stopImpersonation } from "./impersonation";

type Row = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: "ADMIN" | "VOLUNTEER";
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  archivedAt: Date | null;
};

const row = (overrides: Partial<Row> & Pick<Row, "id" | "role">): Row => ({
  name: `${overrides.id} name`,
  email: `${overrides.id}@example.com`,
  phone: null,
  firstName: null,
  lastName: null,
  emailVerified: true,
  archivedAt: null,
  ...overrides,
});

/** Serve `findUnique({ where: { id } })` from a fixed set of rows. */
function seed(...rows: Row[]) {
  findUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) =>
      rows.find((r) => r.id === where.id) ?? null,
  );
}

const tokenFor = (user: Row): JWT => ({
  sub: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

beforeEach(() => {
  findUnique.mockReset();
});

describe("startImpersonation", () => {
  const admin = row({ id: "admin", role: "ADMIN" });
  const volunteer = row({ id: "vol", role: "VOLUNTEER", firstName: "Vol" });

  it("switches an admin's token to the target loaded from the database", async () => {
    seed(admin, volunteer);
    const token = tokenFor(admin);

    expect(await startImpersonation(token, { targetUserId: "vol" })).toBe(true);
    expect(token).toMatchObject({
      sub: "vol",
      email: "vol@example.com",
      role: "VOLUNTEER",
      firstName: "Vol",
      impersonating: {
        adminId: "admin",
        adminEmail: "admin@example.com",
        adminName: "admin name",
      },
    });
  });

  it("refuses a volunteer, whatever identity and role the payload claims", async () => {
    seed(admin, volunteer);
    const token = tokenFor(volunteer);
    const before = { ...token };

    // The shape the old client sent, forged by a volunteer to become an admin.
    const forged = {
      targetUserId: "admin",
      targetUser: { id: "admin", email: "admin@example.com", role: "ADMIN" },
      impersonationData: { adminId: "admin", adminEmail: "", adminName: null },
    };

    expect(await startImpersonation(token, forged)).toBe(false);
    expect(token).toEqual(before);
  });

  it("checks the database role, not the role in the token", async () => {
    // Demoted since sign-in: the token still says ADMIN.
    seed(row({ id: "admin", role: "VOLUNTEER" }), volunteer);
    const token = tokenFor(admin);
    const before = { ...token };

    expect(await startImpersonation(token, { targetUserId: "vol" })).toBe(false);
    expect(token).toEqual(before);
  });

  it("refuses an archived admin", async () => {
    seed(row({ id: "admin", role: "ADMIN", archivedAt: new Date() }), volunteer);
    const token = tokenFor(admin);

    expect(await startImpersonation(token, { targetUserId: "vol" })).toBe(false);
    expect(token.sub).toBe("admin");
  });

  it("refuses to nest impersonation", async () => {
    seed(admin, volunteer);
    const token: JWT = {
      ...tokenFor(admin),
      impersonating: { adminId: "admin", adminEmail: "", adminName: null },
    };

    expect(await startImpersonation(token, { targetUserId: "vol" })).toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["no payload", undefined],
    ["a non-object payload", true],
    ["a missing id", {}],
    ["a non-string id", { targetUserId: { not: "x" } }],
    ["an unknown user", { targetUserId: "nobody" }],
  ])("refuses %s", async (_label, payload) => {
    seed(admin, volunteer);
    const token = tokenFor(admin);
    const before = { ...token };

    expect(await startImpersonation(token, payload)).toBe(false);
    expect(token).toEqual(before);
  });
});

describe("stopImpersonation", () => {
  const admin = row({ id: "admin", role: "ADMIN", firstName: "Ad" });
  const volunteer = row({ id: "vol", role: "VOLUNTEER" });

  it("restores the admin recorded in the token from the database", async () => {
    seed(admin, volunteer);
    const token: JWT = {
      ...tokenFor(volunteer),
      impersonating: { adminId: "admin", adminEmail: "", adminName: null },
    };

    expect(await stopImpersonation(token)).toBe(true);
    expect(token).toMatchObject({
      sub: "admin",
      email: "admin@example.com",
      role: "ADMIN",
      firstName: "Ad",
    });
    expect(token.impersonating).toBeUndefined();
  });

  it("does nothing for a session that is not impersonating", async () => {
    seed(admin, volunteer);
    const token = tokenFor(volunteer);
    const before = { ...token };

    expect(await stopImpersonation(token)).toBe(false);
    expect(token).toEqual(before);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("takes the restored role from the database", async () => {
    // Demoted while impersonating.
    seed(row({ id: "admin", role: "VOLUNTEER" }), volunteer);
    const token: JWT = {
      ...tokenFor(volunteer),
      impersonating: { adminId: "admin", adminEmail: "", adminName: null },
    };

    expect(await stopImpersonation(token)).toBe(true);
    expect(token.role).toBe("VOLUNTEER");
  });

  it("leaves the token alone when the admin account no longer exists", async () => {
    seed(volunteer);
    const token: JWT = {
      ...tokenFor(volunteer),
      impersonating: { adminId: "admin", adminEmail: "", adminName: null },
    };
    const before = structuredClone(token);

    expect(await stopImpersonation(token)).toBe(false);
    expect(token).toEqual(before);
  });
});
