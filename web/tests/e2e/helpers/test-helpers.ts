import { Page, expect } from "@playwright/test";

/**
 * Create a test user via test API endpoint
 * Uses /api/test/users which is only available in non-production
 */
export async function createTestUser(
  page: Page,
  email: string,
  role: "ADMIN" | "VOLUNTEER" = "VOLUNTEER",
  additionalData?: {
    availableLocations?: string;
    availableDays?: string;
    receiveShortageNotifications?: boolean;
    excludedShortageNotificationTypes?: string[];
  }
): Promise<void> {
  await page.request.post("/api/test/users", {
    data: {
      email,
      password: "Test123456",
      firstName: "Test",
      lastName: "User",
      role,
      profileCompleted: true,
      ...additionalData,
    },
  });
}

/**
 * Delete test users
 * Note: For E2E tests, consider using database resets between test runs
 * instead of manual cleanup. This function is kept for backward compatibility.
 */
export async function deleteTestUsers(
  page: Page,
  emails: string[]
): Promise<void> {
  // TODO: Implement admin API endpoint for bulk user deletion if needed
  // For now, tests should use isolated data or database resets
  console.warn(
    "deleteTestUsers: Consider using database resets instead of manual cleanup"
  );
}

/**
 * Login with email and password
 */
export async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"));
}

/**
 * Ensure user has admin role (for test verification)
 */
export async function ensureAdmin(page: Page): Promise<void> {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin/);
}

/**
 * Create a test shift via admin API
 */
export async function createShift(
  page: Page,
  data: {
    location: string;
    start: Date;
    end?: Date;
    capacity: number;
    shiftTypeId?: string;
    notes?: string;
  }
): Promise<{ id: string }> {
  const response = await page.request.post("/api/admin/shifts", {
    data: {
      shiftTypeId: data.shiftTypeId,
      location: data.location,
      start: data.start.toISOString(),
      end:
        data.end?.toISOString() ||
        new Date(data.start.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      capacity: data.capacity,
      notes: data.notes || "Test shift",
    },
  });

  const result = await response.json();
  return { id: result.id };
}

/**
 * Delete test shifts via admin API
 */
export async function deleteTestShifts(
  page: Page,
  shiftIds: string[]
): Promise<void> {
  if (shiftIds.length === 0) return;

  // Delete shifts one by one using admin API
  for (const shiftId of shiftIds) {
    await page.request.delete(`/api/admin/shifts/${shiftId}`);
  }
}
