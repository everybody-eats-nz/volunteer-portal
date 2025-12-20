import { test, expect } from "@playwright/test";
import {
  login,
  ensureAdmin,
  createTestUser,
  deleteTestUsers,
} from "./helpers/test-helpers";

test.describe("Email Preview API", () => {
  let adminEmail: string;
  let volunteerEmail: string;

  test.beforeEach(async ({ page }) => {
    // Create admin user
    adminEmail = `admin-email-preview-${Date.now()}@test.com`;
    await createTestUser(page, adminEmail, "ADMIN");

    // Create volunteer user for unauthorized test
    volunteerEmail = `volunteer-email-preview-${Date.now()}@test.com`;
    await createTestUser(page, volunteerEmail, "VOLUNTEER");
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data
    await deleteTestUsers(page, [adminEmail, volunteerEmail]);
  });

  test("should return 403 for non-admin users", async ({ page, request }) => {
    // Login as volunteer
    await login(page, volunteerEmail, "Test123456");

    // Get cookies for authenticated request
    const cookies = await page.context().cookies();

    // Try to access email preview API
    const response = await request.get(
      "/api/admin/emails/preview/shortage",
      {
        headers: {
          Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
        },
      }
    );

    // Should return 403 Forbidden
    expect(response.status()).toBe(403);
  });

  test("should return 403 for unauthenticated requests", async ({
    request,
  }) => {
    // Try to access without authentication
    const response = await request.get("/api/admin/emails/preview/shortage");

    // Should return 403 Forbidden
    expect(response.status()).toBe(403);
  });

  test("should return 400 for invalid email type", async ({ page, request }) => {
    // Login as admin
    await login(page, adminEmail, "Test123456");
    await ensureAdmin(page);

    // Get cookies for authenticated request
    const cookies = await page.context().cookies();

    // Try to access with invalid email type
    const response = await request.get(
      "/api/admin/emails/preview/invalid-type",
      {
        headers: {
          Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
        },
      }
    );

    // Should return 400 Bad Request
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Invalid email type");
  });

  test("should return email preview for valid shortage request", async ({
    page,
    request,
  }) => {
    // Login as admin
    await login(page, adminEmail, "Test123456");
    await ensureAdmin(page);

    // Get cookies for authenticated request
    const cookies = await page.context().cookies();

    // Request shortage email preview
    const response = await request.get(
      "/api/admin/emails/preview/shortage",
      {
        headers: {
          Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
        },
      }
    );

    // Should return 200 OK
    expect(response.status()).toBe(200);

    // Check response structure
    const body = await response.json();
    expect(body).toHaveProperty("SmartEmailID");
    expect(body).toHaveProperty("Name");
    expect(body).toHaveProperty("Status");
    expect(body).toHaveProperty("Properties");

    // Check Properties structure
    expect(body.Properties).toHaveProperty("From");
    expect(body.Properties).toHaveProperty("ReplyTo");
    expect(body.Properties).toHaveProperty("Subject");
    expect(body.Properties).toHaveProperty("HtmlPreviewUrl");
  });

  test("should return email preview for all valid email types", async ({
    page,
    request,
  }) => {
    // Login as admin
    await login(page, adminEmail, "Test123456");
    await ensureAdmin(page);

    // Get cookies for authenticated request
    const cookies = await page.context().cookies();

    // Test all valid email types
    const validEmailTypes = [
      "shortage",
      "cancellation",
      "confirmation",
      "volunteerCancellation",
      "volunteerNotNeeded",
      "emailVerification",
      "parentalConsentApproval",
      "userInvitation",
      "profileCompletion",
      "migration",
    ];

    for (const emailType of validEmailTypes) {
      const response = await request.get(
        `/api/admin/emails/preview/${emailType}`,
        {
          headers: {
            Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
          },
        }
      );

      // Should return 200 OK for all valid types
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty("SmartEmailID");
      expect(body).toHaveProperty("Name");
    }
  });

  test("should include HtmlPreviewUrl in response", async ({
    page,
    request,
  }) => {
    // Login as admin
    await login(page, adminEmail, "Test123456");
    await ensureAdmin(page);

    // Get cookies for authenticated request
    const cookies = await page.context().cookies();

    // Request email preview
    const response = await request.get(
      "/api/admin/emails/preview/shortage",
      {
        headers: {
          Cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
        },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();

    // HtmlPreviewUrl should be present and be a string
    expect(body.Properties.HtmlPreviewUrl).toBeDefined();
    expect(typeof body.Properties.HtmlPreviewUrl).toBe("string");

    // In development mode, it will be the mock URL
    // In production, it will be the actual Campaign Monitor URL
    expect(body.Properties.HtmlPreviewUrl).toMatch(/^https?:\/\//);
  });
});
