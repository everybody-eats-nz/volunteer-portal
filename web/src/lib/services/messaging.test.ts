import { describe, it, expect, beforeEach, vi } from "vitest";
import { listThreadsForAdmin } from "./messaging";
import { prisma } from "@/lib/prisma";

// Mock the prisma client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    messageThread: {
      findMany: vi.fn(),
    },
  },
}));

// messaging.ts imports notification helpers at module load; stub them out so
// the import graph doesn't pull in real services.
vi.mock("@/lib/messaging-notify", () => ({
  broadcastNewMessageToAdmins: vi.fn(),
  notifyVolunteerOfTeamMessage: vi.fn(),
}));

const findMany = prisma.messageThread.findMany as ReturnType<typeof vi.fn>;

function buildThread(overrides: Record<string, unknown> = {}) {
  return {
    id: "thread-1",
    status: "OPEN",
    lastMessageAt: new Date("2025-01-01T00:00:00Z"),
    teamLastReadAt: null,
    volunteer: {
      id: "vol-1",
      firstName: "Aroha",
      lastName: "Ngata",
      name: null,
      email: "aroha@example.com",
      profilePhotoUrl: null,
      defaultLocation: "Wellington",
    },
    messages: [
      {
        body: "Kia ora, can I help on Friday?",
        senderRole: "VOLUNTEER",
        createdAt: new Date("2025-01-01T00:00:00Z"),
      },
    ],
    ...overrides,
  };
}

describe("listThreadsForAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("only queries threads that have at least one message", async () => {
    findMany.mockResolvedValue([]);

    await listThreadsForAdmin();

    expect(findMany).toHaveBeenCalledTimes(1);
    const where = findMany.mock.calls[0][0].where;
    // Guards the regression: empty threads created when a volunteer merely
    // opens the mobile chat screen must not appear in the admin inbox.
    expect(where.messages).toEqual({ some: {} });
  });

  it("keeps the message filter alongside status and search filters", async () => {
    findMany.mockResolvedValue([]);

    await listThreadsForAdmin({ status: "RESOLVED", search: "aroha" });

    const where = findMany.mock.calls[0][0].where;
    expect(where.messages).toEqual({ some: {} });
    expect(where.status).toBe("RESOLVED");
    expect(where.volunteer).toBeDefined();
  });

  it("maps a thread with messages into a list item", async () => {
    findMany.mockResolvedValue([buildThread()]);

    const items = await listThreadsForAdmin();

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "thread-1",
      status: "OPEN",
      unreadForTeam: true,
      lastMessage: { body: "Kia ora, can I help on Friday?" },
      volunteer: { id: "vol-1", name: "Aroha Ngata" },
    });
  });
});
