import { Page, expect } from "@playwright/test";

/**
 * Create a test user via test API endpoint
 * Uses /api/test/users which is only available in non-production
 */
export async function createTestUser(
  page: Page,
  email: string,
  role: "ADMIN" | "VOLUNTEER" = "VOLUNTEER",
  additionalData?: Record<string, string | boolean | number | string[] | null>
): Promise<void> {
  const response = await page.request.post("/api/test/users", {
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

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(`Failed to create test user: ${response.status()} - ${errorText}`);
  }
}

/**
 * Create a migration user (user without password that needs to complete registration)
 */
export async function createMigrationUser(
  page: Page,
  email: string,
  additionalData?: Record<string, string | boolean | number | Date>
): Promise<{ id: string; email: string }> {
  const response = await page.request.post("/api/test/users", {
    data: {
      email,
      firstName: "Migration",
      lastName: "User",
      isMigrationUser: true,
      ...additionalData,
    },
  });

  return await response.json();
}

/**
 * Delete test users via API
 */
export async function deleteTestUsers(
  page: Page,
  emails: string[]
): Promise<void> {
  for (const email of emails) {
    await page.request.delete(
      `/api/test/users?email=${encodeURIComponent(email)}`
    );
  }
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

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(`Failed to create shift: ${response.status()} - ${errorText}`);
  }

  const result = await response.json();
  if (!result.id) {
    throw new Error(`Shift created but no ID returned: ${JSON.stringify(result)}`);
  }

  console.log(`Created shift ${result.id} for ${data.start.toISOString()}`);
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

/**
 * Get user ID by email (for tests that need to reference users)
 */
export async function getUserByEmail(
  page: Page,
  email: string
): Promise<{ id: string; email: string } | null> {
  const response = await page.request.get(
    `/api/test/users?email=${encodeURIComponent(email)}`
  );
  if (response.ok()) {
    return await response.json();
  }
  return null;
}

/**
 * Create a signup (volunteer registration for a shift)
 */
export async function createSignup(
  page: Page,
  data: { userId: string; shiftId: string; status?: string }
): Promise<{ id: string }> {
  const response = await page.request.post("/api/test/signups", {
    data,
  });
  return await response.json();
}

/**
 * Delete signups by shift IDs
 */
export async function deleteSignupsByShiftIds(
  page: Page,
  shiftIds: string[]
): Promise<void> {
  if (shiftIds.length === 0) return;
  await page.request.delete(`/api/test/signups?shiftIds=${shiftIds.join(",")}`);
}

/**
 * Get shift type by name
 */
export async function getShiftTypeByName(
  page: Page,
  name: string
): Promise<{ id: string; name: string } | null> {
  const response = await page.request.get(
    `/api/test/shift-types?name=${encodeURIComponent(name)}`
  );
  if (response.ok()) {
    return await response.json();
  }
  return null;
}

/**
 * Create a notification
 */
export async function createNotification(
  page: Page,
  data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    shiftId?: string;
  }
): Promise<{ id: string }> {
  const response = await page.request.post("/api/test/notifications", {
    data,
  });
  return await response.json();
}

/**
 * Delete notifications
 */
export async function deleteNotifications(
  page: Page,
  filters: { userId?: string; type?: string }
): Promise<void> {
  const params = new URLSearchParams();
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.type) params.set("type", filters.type);

  await page.request.delete(`/api/test/notifications?${params.toString()}`);
}
