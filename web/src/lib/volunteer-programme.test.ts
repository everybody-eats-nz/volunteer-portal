import { describe, it, expect } from "vitest";
import {
  inVolunteerProgramme,
  inVolunteerProgrammeSql,
  isExternalDriver,
} from "./volunteer-programme";

/**
 * The rule that separates "in the volunteer programme" from "has a login" lives
 * in exactly one module. These tests pin the two expressions of it — the Prisma
 * filter and the raw-SQL predicate — to the same definition, because the
 * analytics that use one and the archiver that uses the other must agree.
 */

describe("isExternalDriver", () => {
  it("is false for a plain volunteer with no driver profile", () => {
    expect(isExternalDriver({})).toBe(false);
    expect(isExternalDriver({ driverProfile: null })).toBe(false);
  });

  it("is false for a volunteer who also drives an Everybody Eats van", () => {
    expect(
      isExternalDriver({ driverProfile: { organisation: { isInternal: true } } })
    ).toBe(false);
  });

  it("is true for a Sustainability Trust driver", () => {
    expect(
      isExternalDriver({
        driverProfile: { organisation: { isInternal: false } },
      })
    ).toBe(true);
  });

  it("is false when a driver has no organisation recorded", () => {
    // An unknown organisation is not evidence of being outside the programme,
    // and quietly excluding people from volunteer counts is the worse error.
    expect(isExternalDriver({ driverProfile: { organisation: null } })).toBe(
      false
    );
  });
});

describe("inVolunteerProgramme", () => {
  it("excludes users whose driver profile belongs to a non-internal org", () => {
    expect(inVolunteerProgramme).toEqual({
      NOT: { driverProfile: { is: { organisation: { is: { isInternal: false } } } } },
    });
  });
});

describe("inVolunteerProgrammeSql", () => {
  it("builds a NOT EXISTS predicate against the given User alias", () => {
    const sql = inVolunteerProgrammeSql("u");
    const text = sql.strings.join("?");
    expect(text).toContain("NOT EXISTS");
    expect(text).toContain('"DriverProfile"');
    expect(text).toContain('org."isInternal" = FALSE');
    expect(sql.sql).toContain('"u".id');
  });

  it("takes no runtime parameters, so it composes into any query", () => {
    expect(inVolunteerProgrammeSql("u").values).toEqual([]);
  });
});
