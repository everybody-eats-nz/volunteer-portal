import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";
import { sendDueNoShowEmails, UNDO_GRACE_MS } from "./no-show-emails.server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    signup: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  },
}));

const email = vi.hoisted(() => ({
  isNoShowEmailConfigured: vi.fn().mockReturnValue(true),
  sendNoShowNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email-service", () => ({ getEmailService: () => email }));
vi.mock("@/lib/locations", () => ({
  getLocationAddresses: vi
    .fn()
    .mockResolvedValue({ Wellington: "60 Dixon Street, Wellington" }),
}));
vi.mock("@/lib/timezone", () => ({
  formatInNZT: (_d: Date, fmt: string) => (fmt.includes("yyyy") ? "Friday 6 November 2026" : "5:00 PM"),
}));

const findMany = vi.mocked(prisma.signup.findMany);
const updateMany = vi.mocked(prisma.signup.updateMany);
const update = vi.mocked(prisma.signup.update);

const NOW = new Date("2026-11-06T09:00:00Z");

function noShow(id = "signup-1") {
  return {
    id,
    user: { email: "sam@example.com", name: null, firstName: "Sam", lastName: "Tui" },
    shift: {
      start: new Date("2026-11-06T04:00:00Z"),
      end: new Date("2026-11-06T08:00:00Z"),
      location: "Wellington",
      shiftType: { name: "Kitchen Prep" },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  email.isNoShowEmailConfigured.mockReturnValue(true);
  email.sendNoShowNotification.mockResolvedValue(undefined);
  updateMany.mockResolvedValue({ count: 1 } as never);
});

describe("sendDueNoShowEmails", () => {
  it("emails a no-show once their shift is over", async () => {
    findMany.mockResolvedValue([noShow()] as never);

    const result = await sendDueNoShowEmails(NOW);

    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(email.sendNoShowNotification).toHaveBeenCalledWith({
      to: "sam@example.com",
      volunteerName: "Sam Tui",
      shiftName: "Kitchen Prep",
      shiftDate: "Friday 6 November 2026",
      shiftTime: "5:00 PM - 5:00 PM",
      location: "60 Dixon Street, Wellington",
    });
  });

  it("only looks at marks made through the portal, past the undo window, for finished shifts", async () => {
    findMany.mockResolvedValue([] as never);

    await sendDueNoShowEmails(NOW);

    const where = findMany.mock.calls[0][0]!.where!;
    expect(where).toMatchObject({
      status: "NO_SHOW",
      noShowEmailSentAt: null,
      noShowMarkedAt: {
        not: null,
        lte: new Date(NOW.getTime() - UNDO_GRACE_MS),
      },
      shift: { end: { lte: NOW } },
    });
  });

  it("never sends twice when another run claimed it first", async () => {
    findMany.mockResolvedValue([noShow()] as never);
    updateMany.mockResolvedValue({ count: 0 } as never);

    const result = await sendDueNoShowEmails(NOW);

    expect(result.sent).toBe(0);
    expect(email.sendNoShowNotification).not.toHaveBeenCalled();
  });

  it("releases the claim when the email fails, so the next run retries", async () => {
    findMany.mockResolvedValue([noShow()] as never);
    email.sendNoShowNotification.mockRejectedValue(new Error("CM down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendDueNoShowEmails(NOW);

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(update).toHaveBeenCalledWith({
      where: { id: "signup-1" },
      data: { noShowEmailSentAt: null },
    });
  });

  it("keeps emails queued until the template is configured", async () => {
    email.isNoShowEmailConfigured.mockReturnValue(false);

    const result = await sendDueNoShowEmails(NOW);

    expect(result.skippedReason).toMatch(/NO_SHOW_EMAIL_ID/);
    expect(findMany).not.toHaveBeenCalled();
  });
});
