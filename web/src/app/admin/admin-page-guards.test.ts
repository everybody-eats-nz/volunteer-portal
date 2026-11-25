import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    location: { findMany: vi.fn().mockResolvedValue([]) },
    shiftType: { findMany: vi.fn().mockResolvedValue([]) },
    announcement: { findMany: vi.fn().mockResolvedValue([]) },
    customLabel: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));
vi.mock("@/lib/services/messaging", () => ({
  listThreadsForAdmin: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/components/admin-page-wrapper", () => ({ AdminPageWrapper: () => null }));
vi.mock("@/components/admin/messages/messages-inbox", () => ({
  MessagesInbox: () => null,
}));
vi.mock("./announcements/announcements-content", () => ({
  AnnouncementsContent: () => null,
}));
vi.mock("./notifications/notifications-content", () => ({
  NotificationsContent: () => null,
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { listThreadsForAdmin } from "@/lib/services/messaging";
import AdminMessagesPage from "./messages/page";
import AnnouncementsPage from "./announcements/page";
import NotificationsPage from "./notifications/page";

const mockSession = getServerSession as ReturnType<typeof vi.fn>;

const searchParams = Promise.resolve({});

// These pages render independently of the admin layout, so each must refuse a
// non-admin itself, before any query runs.
const pages = [
  {
    name: "messages",
    render: () => AdminMessagesPage({ searchParams }),
    query: listThreadsForAdmin,
  },
  {
    name: "announcements",
    render: () => AnnouncementsPage(),
    query: prisma.announcement.findMany,
  },
  {
    name: "notifications",
    render: () => NotificationsPage(),
    query: prisma.shiftType.findMany,
  },
];

describe.each(pages)("/admin/$name access", ({ name, render, query }) => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a signed-out visitor to login without querying", async () => {
    mockSession.mockResolvedValue(null);

    await expect(render()).rejects.toThrow(
      `REDIRECT:/login?callbackUrl=/admin/${name}`,
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("sends a volunteer to the dashboard without querying", async () => {
    mockSession.mockResolvedValue({ user: { role: "VOLUNTEER" } });

    await expect(render()).rejects.toThrow("REDIRECT:/dashboard");
    expect(query).not.toHaveBeenCalled();
  });

  it("loads the page for an admin", async () => {
    mockSession.mockResolvedValue({ user: { role: "ADMIN" } });

    await expect(render()).resolves.toBeDefined();
    expect(query).toHaveBeenCalled();
  });
});
