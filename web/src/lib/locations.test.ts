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

describe("normalizeLocationName", () => {
  it("collapses internal runs of whitespace to a single space", async () => {
    const { normalizeLocationName } = await loadReal();
    expect(
      normalizeLocationName("The Gathered Table Event:  Britomart Hotel")
    ).toBe("The Gathered Table Event: Britomart Hotel");
  });

  it("trims surrounding whitespace", async () => {
    const { normalizeLocationName } = await loadReal();
    expect(normalizeLocationName("  Wellington ")).toBe("Wellington");
  });

  it("normalizes pasted Unicode spaces, not just ASCII ones", async () => {
    const { normalizeLocationName } = await loadReal();
    // A non-breaking space renders identically in a dropdown, so a name
    // carrying one looks correct while never matching its shifts.
    expect(normalizeLocationName("Pop\u00a0Up Venue")).toBe("Pop Up Venue");
    expect(normalizeLocationName("Glen\u2009Innes")).toBe("Glen Innes");
  });

  it("leaves an already-canonical name untouched", async () => {
    const { normalizeLocationName } = await loadReal();
    expect(normalizeLocationName("Glen Innes")).toBe("Glen Innes");
  });
});

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
