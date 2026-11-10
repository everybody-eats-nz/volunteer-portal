import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/services/campaign-monitor", () => ({
  CampaignMonitorService: vi.fn(),
}));
vi.mock("@/lib/newsletter-sync", () => ({
  syncNewsletterSubscriptions: vi.fn(),
}));
vi.mock("@/lib/email-service", () => ({ getEmailService: vi.fn() }));
vi.mock("@/lib/auto-label-utils", () => ({
  autoLabelUnder16User: vi.fn(),
  isUserUnder16: vi.fn().mockReturnValue(false),
}));
vi.mock("@/lib/posthog-server", () => ({ phAlias: vi.fn() }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { PUT } from "./route";

const mockSession = getServerSession as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = prisma.user.update as ReturnType<typeof vi.fn>;

const put = (body: unknown) =>
  PUT(
    new Request("http://localhost/api/profile", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  );

const savedData = () => mockUpdate.mock.calls[0][0].data as Record<string, unknown>;

describe("PUT /api/profile photo handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ user: { email: "vol@example.com" } });
    const user = {
      id: "user-1",
      email: "vol@example.com",
      role: "VOLUNTEER",
      firstName: "Vol",
      lastName: "Unteer",
      profileCompleted: true,
      newsletterLists: [],
    };
    mockFindUnique.mockResolvedValue(user);
    mockUpdate.mockResolvedValue({ ...user, profileCompleted: true });
  });

  it("does not store a photo URL sent by the client", async () => {
    const response = await put({
      phone: "021 555 0001",
      profilePhotoUrl:
        "https://evil.example/storage/v1/object/public/x/uploads/victim.jpg",
    });

    expect(response.status).toBe(200);
    expect(savedData()).not.toHaveProperty("profilePhotoUrl");
    expect(savedData()).toMatchObject({ phone: "021 555 0001" });
  });

  it.each([[""], [null]])("clears the photo when sent %j", async (value) => {
    const response = await put({ profilePhotoUrl: value });

    expect(response.status).toBe(200);
    expect(savedData()).toMatchObject({ profilePhotoUrl: null });
  });
});
