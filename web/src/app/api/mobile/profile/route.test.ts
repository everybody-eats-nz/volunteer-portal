import { vi, describe, it, expect, beforeEach } from "vitest";

vi.stubEnv("AUTH_SECRET", "test-secret");

// Mock dependencies before importing routes
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
    signup: { count: vi.fn(), findMany: vi.fn() },
    friendship: { findMany: vi.fn() },
    userAchievement: { groupBy: vi.fn(), findMany: vi.fn() },
    location: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn(),
}));

vi.mock("@/lib/achievements", () => ({
  getUserAchievements: vi.fn().mockResolvedValue([]),
  getAvailableAchievements: vi.fn().mockResolvedValue([]),
  checkAndUnlockAchievements: vi.fn().mockResolvedValue(undefined),
  calculateUserProgress: vi.fn().mockResolvedValue({
    shifts_completed: 5,
    hours_volunteered: 20,
    consecutive_months: 2,
  }),
}));

import { GET, PUT } from "./route";
import { requireMobileUser } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

const mockRequireMobileUser = requireMobileUser as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  signup: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  friendship: { findMany: ReturnType<typeof vi.fn> };
  userAchievement: {
    groupBy: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  location: { findMany: ReturnType<typeof vi.fn> };
};

const MOCK_USER = {
  id: "user-1",
  name: "Aroha Williams",
  email: "aroha@example.com",
  firstName: "Aroha",
  lastName: "Williams",
  phone: "021 123 4567",
  pronouns: "she/her",
  profilePhotoUrl: "https://example.com/photo.jpg",
  role: "VOLUNTEER",
  dateOfBirth: new Date("1995-06-15"),
  emergencyContactName: "Hemi Williams",
  emergencyContactRelationship: "Partner",
  emergencyContactPhone: "021 765 4321",
  medicalConditions: null,
  notificationPreference: "EMAIL",
  receiveShortageNotifications: true,
  excludedShortageNotificationTypes: [],
  emailNewsletterSubscription: true,
  newsletterLists: [],
  createdAt: new Date("2024-06-15"),
  customLabels: [],
};

function makeRequest(method = "GET", body?: unknown) {
  const init: RequestInit = {
    method,
    headers: { Authorization: "Bearer valid-token" },
  };
  if (body) {
    init.headers = {
      ...init.headers,
      "Content-Type": "application/json",
    };
    init.body = JSON.stringify(body);
  }
  return new Request("http://localhost/api/mobile/profile", init);
}

describe("GET /api/mobile/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireMobileUser.mockResolvedValue(null);

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);

    const json = await response.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 404 when user not found in database", async () => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const response = await GET(makeRequest());
    expect(response.status).toBe(404);
  });

  it("returns profile with stats and achievements", async () => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);
    mockPrisma.signup.count.mockResolvedValue(5);
    mockPrisma.signup.findMany.mockResolvedValue([
      {
        shift: {
          start: new Date("2024-07-01T08:00:00Z"),
          end: new Date("2024-07-01T12:00:00Z"),
        },
      },
    ]);
    mockPrisma.user.count.mockResolvedValue(10);
    mockPrisma.friendship.findMany.mockResolvedValue([]);
    mockPrisma.userAchievement.groupBy.mockResolvedValue([]);
    mockPrisma.location.findMany.mockResolvedValue([
      { name: "Wellington" },
      { name: "Auckland" },
    ]);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.profile.firstName).toBe("Aroha");
    expect(json.profile.lastName).toBe("Williams");
    expect(json.profile.email).toBe("aroha@example.com");
    expect(json.profile.image).toBe("https://example.com/photo.jpg");
    expect(json.profile.emergencyContactName).toBe("Hemi Williams");
    expect(json.profile.notificationPreference).toBe("EMAIL");
    expect(json.profile.receiveShortageNotifications).toBe(true);
    expect(json.stats.shiftsCompleted).toBe(5);
    expect(json.totalVolunteers).toBe(10);
    expect(json.achievements).toEqual([]);
  });

  it("returns notification and newsletter preferences", async () => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      ...MOCK_USER,
      notificationPreference: "BOTH",
      emailNewsletterSubscription: false,
      newsletterLists: ["list-1", "list-2"],
    });
    mockPrisma.signup.count.mockResolvedValue(0);
    mockPrisma.signup.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(5);
    mockPrisma.friendship.findMany.mockResolvedValue([]);
    mockPrisma.userAchievement.groupBy.mockResolvedValue([]);
    mockPrisma.location.findMany.mockResolvedValue([]);

    const response = await GET(makeRequest());
    const json = await response.json();

    expect(json.profile.notificationPreference).toBe("BOTH");
    expect(json.profile.emailNewsletterSubscription).toBe(false);
    expect(json.profile.newsletterLists).toEqual(["list-1", "list-2"]);
  });
});

describe("PUT /api/mobile/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireMobileUser.mockResolvedValue(null);

    const response = await PUT(makeRequest("PUT", { firstName: "Test" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });

    const response = await PUT(
      makeRequest("PUT", { notificationPreference: "INVALID_VALUE" })
    );
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.error).toBe("Invalid request body");
  });

  it("updates profile fields successfully", async () => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      firstName: "Aroha",
      lastName: "Williams",
    });
    mockPrisma.user.update.mockResolvedValue({
      firstName: "Aroha",
      lastName: "Williams",
      phone: "021 999 8888",
      pronouns: "she/her",
      profilePhotoUrl: null,
      emergencyContactName: null,
      emergencyContactRelationship: null,
      emergencyContactPhone: null,
      medicalConditions: null,
    });

    const response = await PUT(
      makeRequest("PUT", { phone: "021 999 8888" })
    );
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.profile.phone).toBe("021 999 8888");
  });

  it("syncs the name field when firstName is updated", async () => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      firstName: "Aroha",
      lastName: "Williams",
    });
    mockPrisma.user.update.mockResolvedValue({
      firstName: "Tāne",
      lastName: "Williams",
      phone: null,
      pronouns: null,
      profilePhotoUrl: null,
      emergencyContactName: null,
      emergencyContactRelationship: null,
      emergencyContactPhone: null,
      medicalConditions: null,
    });

    await PUT(makeRequest("PUT", { firstName: "Tāne" }));

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstName: "Tāne",
          name: "Tāne Williams",
        }),
      })
    );
  });

  it("updates notification preferences", async () => {
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockPrisma.user.update.mockResolvedValue({
      firstName: "Aroha",
      lastName: "Williams",
      phone: null,
      pronouns: null,
      profilePhotoUrl: null,
      emergencyContactName: null,
      emergencyContactRelationship: null,
      emergencyContactPhone: null,
      medicalConditions: null,
    });

    await PUT(
      makeRequest("PUT", {
        notificationPreference: "BOTH",
        receiveShortageNotifications: false,
      })
    );

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notificationPreference: "BOTH",
          receiveShortageNotifications: false,
        }),
      })
    );
  });
});
