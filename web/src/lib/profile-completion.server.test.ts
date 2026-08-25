import { beforeEach, describe, expect, it, vi } from "vitest";

// The shared test setup stubs Prisma without a `user` delegate, so give this
// file its own stub that records the flag repairs.
const { update } = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: { user: { update } } }));

const { syncProfileCompletedFlag } = await import("./profile-completion.server");

const completeFields = {
  id: "user-1",
  firstName: "Aroha",
  phone: "021 123 4567",
  dateOfBirth: new Date("1994-03-12"),
  emergencyContactName: "Hemi Williams",
  emergencyContactPhone: "021 765 4321",
  volunteerAgreementAccepted: true,
  healthSafetyPolicyAccepted: true,
};

describe("syncProfileCompletedFlag", () => {
  beforeEach(() => {
    update.mockReset();
  });

  it("lets a complete profile through without touching the flag", async () => {
    const result = await syncProfileCompletedFlag({
      ...completeFields,
      profileCompleted: true,
    });

    expect(result).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it("blocks an incomplete profile without touching an already-false flag", async () => {
    const result = await syncProfileCompletedFlag({
      ...completeFields,
      dateOfBirth: null,
      profileCompleted: false,
    });

    expect(result).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  // The drift that left volunteers blocked with nothing to fix: every field
  // filled in, but the cached flag still said incomplete.
  it("repairs a stale false flag and lets the signup proceed", async () => {
    const result = await syncProfileCompletedFlag({
      ...completeFields,
      profileCompleted: false,
    });

    expect(result).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { profileCompleted: true },
    });
  });

  it("repairs a stale true flag and blocks the signup", async () => {
    const result = await syncProfileCompletedFlag({
      ...completeFields,
      dateOfBirth: null,
      profileCompleted: true,
    });

    expect(result).toBe(false);
    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { profileCompleted: false },
    });
  });
});
