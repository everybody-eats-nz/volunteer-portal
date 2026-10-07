import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock dependencies before importing the route
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    notification: { create: vi.fn() },
  },
}));

vi.mock("@/lib/bot-protection", () => ({
  checkForBot: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/auto-label-utils", () => ({
  autoLabelUnder16User: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email-verification", () => ({
  createVerificationToken: vi.fn().mockResolvedValue("verification-token"),
}));

vi.mock("@/lib/email-service", () => ({
  getEmailService: () => ({
    sendEmailVerification: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/lib/newsletter-sync", () => ({
  syncNewsletterSubscriptions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/funnel", () => ({
  captureFunnelEvent: vi.fn(),
  FunnelEvent: { REGISTER_COMPLETED: "register_completed" },
  getPhidFromCookies: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/posthog-server", () => ({
  phAlias: vi.fn(),
}));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

const BASE_BODY = {
  email: "aroha@example.com",
  password: "Password123",
  confirmPassword: "Password123",
  firstName: "Aroha",
  lastName: "Williams",
  volunteerAgreementAccepted: true,
  healthSafetyPolicyAccepted: true,
};

function registerRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** The `data` the route passed to `prisma.user.create`. */
function createdUserData() {
  expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
  return mockPrisma.user.create.mock.calls[0][0].data;
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-1",
      email: "aroha@example.com",
      name: "Aroha Williams",
      firstName: "Aroha",
      lastName: "Williams",
      role: "VOLUNTEER",
      createdAt: new Date("2026-10-06"),
    });
  });

  it("saves shortage and announcement opt-outs chosen at signup", async () => {
    const res = await POST(
      registerRequest({
        ...BASE_BODY,
        receiveShortageNotifications: false,
        excludedShortageNotificationTypes: ["shift-type-kitchen"],
        announcementOptOuts: ["PROMOTIONAL"],
      })
    );

    expect(res.status).toBe(201);
    expect(createdUserData()).toMatchObject({
      receiveShortageNotifications: false,
      excludedShortageNotificationTypes: ["shift-type-kitchen"],
      announcementOptOuts: ["PROMOTIONAL"],
    });
  });

  it("defaults to every shortage alert and announcement when omitted", async () => {
    const res = await POST(registerRequest(BASE_BODY));

    expect(res.status).toBe(201);
    expect(createdUserData()).toMatchObject({
      receiveShortageNotifications: true,
      excludedShortageNotificationTypes: [],
      announcementOptOuts: [],
    });
  });

  it("drops announcement categories that can't be opted out of", async () => {
    const res = await POST(
      registerRequest({
        ...BASE_BODY,
        announcementOptOuts: [
          "URGENT",
          "SHIFT_RELATED",
          "SHIFT_SHORTAGE",
          "NOT_A_CATEGORY",
          "PROMOTIONAL",
        ],
      })
    );

    expect(res.status).toBe(201);
    expect(createdUserData().announcementOptOuts).toEqual(["PROMOTIONAL"]);
  });

  it("rejects a non-boolean shortage preference", async () => {
    const res = await POST(
      registerRequest({ ...BASE_BODY, receiveShortageNotifications: "no" })
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });
});
