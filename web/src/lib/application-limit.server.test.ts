import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  countPendingApplications,
  getApplicationLimitStatus,
  validateApplicationLimit,
} from "./application-limit.server";
import {
  MAX_PENDING_APPLICATIONS,
  buildApplicationLimitMessage,
} from "./application-limit";

vi.mock("@/lib/prisma", () => ({
  prisma: { signup: { count: vi.fn() } },
}));

const autoApproval = vi.hoisted(() => ({
  checkAutoApprovalEligibility: vi.fn(),
}));
vi.mock("@/lib/auto-approval", () => autoApproval);

const count = vi.mocked(prisma.signup.count);

beforeEach(() => {
  vi.clearAllMocks();
  autoApproval.checkAutoApprovalEligibility.mockResolvedValue({
    eligible: false,
  });
});

describe("countPendingApplications", () => {
  it("counts only PENDING signups on shifts that have not started", async () => {
    count.mockResolvedValue(2);
    const before = Date.now();

    expect(await countPendingApplications("user-1", "shift-9")).toBe(2);

    const where = count.mock.calls[0][0]!.where!;
    expect(where.userId).toBe("user-1");
    expect(where.status).toBe("PENDING");
    expect(where.shiftId).toEqual({ not: "shift-9" });
    const cutoff = (where.shift as { start: { gt: Date } }).start.gt;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("does not exclude a shift unless asked", async () => {
    count.mockResolvedValue(0);
    await countPendingApplications("user-1");
    expect(count.mock.calls[0][0]!.where).not.toHaveProperty("shiftId");
  });
});

describe("getApplicationLimitStatus", () => {
  it("allows an application below the cap without checking auto-approval", async () => {
    count.mockResolvedValue(MAX_PENDING_APPLICATIONS - 1);

    expect(await getApplicationLimitStatus("user-1", "shift-1")).toEqual({
      limit: MAX_PENDING_APPLICATIONS,
      pending: MAX_PENDING_APPLICATIONS - 1,
      reached: false,
    });
    expect(autoApproval.checkAutoApprovalEligibility).not.toHaveBeenCalled();
  });

  it("refuses at the cap when the signup would wait for an admin", async () => {
    count.mockResolvedValue(MAX_PENDING_APPLICATIONS);

    const status = await getApplicationLimitStatus("user-1", "shift-1");

    expect(status.reached).toBe(true);
    expect(autoApproval.checkAutoApprovalEligibility).toHaveBeenCalledWith(
      "user-1",
      "shift-1"
    );
  });

  it("allows a signup at the cap that would be approved instantly", async () => {
    count.mockResolvedValue(MAX_PENDING_APPLICATIONS + 2);
    autoApproval.checkAutoApprovalEligibility.mockResolvedValue({
      eligible: true,
      ruleName: "Trusted volunteers",
    });

    const status = await getApplicationLimitStatus("user-1", "shift-1");

    expect(status).toEqual({
      limit: MAX_PENDING_APPLICATIONS,
      pending: MAX_PENDING_APPLICATIONS + 2,
      reached: false,
    });
  });
});

describe("validateApplicationLimit", () => {
  it("returns null when the application may proceed", async () => {
    count.mockResolvedValue(0);
    expect(await validateApplicationLimit("user-1", "shift-1")).toBeNull();
  });

  it("returns a payload older clients can show verbatim", async () => {
    count.mockResolvedValue(MAX_PENDING_APPLICATIONS);

    expect(await validateApplicationLimit("user-1", "shift-1")).toEqual({
      error: buildApplicationLimitMessage(),
      applicationLimitReached: true,
      applicationLimit: {
        limit: MAX_PENDING_APPLICATIONS,
        pending: MAX_PENDING_APPLICATIONS,
        reached: true,
      },
    });
  });
});

describe("buildApplicationLimitMessage", () => {
  it("names the cap and the way out", () => {
    const message = buildApplicationLimitMessage(5);
    expect(message).toContain("5 shift applications");
    expect(message).toContain("withdraw one");
  });
});
