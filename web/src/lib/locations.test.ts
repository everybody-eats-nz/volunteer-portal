import { describe, it, expect, vi } from "vitest";
// Normal import -> the globally mocked prisma (see test-setup.ts), the same
// instance the real locations module reads through.
import { prisma } from "@/lib/prisma";

// test-setup.ts globally mocks `@/lib/locations`, so a normal import would
// return the stubbed helpers. Load the REAL module here to exercise the actual
// query logic. Its `prisma` dependency stays mocked, and that mock's
// `location.findMany` returns Auckland + Wellington (see test-setup.ts).
async function loadReal() {
  return vi.importActual<typeof import("@/lib/locations")>("@/lib/locations");
}

describe("locations helpers", () => {
  it("getActiveLocationNames returns location names from the database", async () => {
    const { getActiveLocationNames } = await loadReal();
    expect(await getActiveLocationNames()).toEqual(["Auckland", "Wellington"]);
  });

  it("getLocationAddresses maps each location name to its address", async () => {
    const { getLocationAddresses } = await loadReal();
    expect(await getLocationAddresses()).toEqual({
      Auckland: "123 Auckland St, Auckland",
      Wellington: "456 Wellington St, Wellington",
    });
  });

  it("queries fresh on every call (not a cached module snapshot)", async () => {
    const findMany = prisma.location.findMany as unknown as ReturnType<
      typeof vi.fn
    >;
    const { getActiveLocationNames } = await loadReal();

    const before = findMany.mock.calls.length;
    await getActiveLocationNames();
    await getActiveLocationNames();
    // Two calls -> two queries; nothing is memoized at module scope.
    expect(findMany.mock.calls.length).toBe(before + 2);
  });
});
