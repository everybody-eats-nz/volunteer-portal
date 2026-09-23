import { test, expect } from "./base";
import { logout } from "./helpers/auth";
import { gotoSettled } from "./helpers/streaming";
import { createTestUser, deleteTestUsers } from "./helpers/test-helpers";

const CURRENT_PASSWORD = "Test123456";
const NEW_PASSWORD = "Changed789Xy";

async function signIn(page: Parameters<typeof createTestUser>[0], email: string, password: string) {
  await page.goto("/login");
  await page.waitForLoadState("load");
  await page.getByTestId("email-input").fill(email);
  await page.getByTestId("password-input").fill(password);
  await page.getByTestId("login-submit-button").click();
}

test.describe("Profile — change password", () => {
  let email: string;

  test.beforeEach(async ({ page }) => {
    email = `change-password-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    await createTestUser(page, email);
    await signIn(page, email, CURRENT_PASSWORD);
    await page.waitForURL("/dashboard");
    await gotoSettled(page, "/profile");
  });

  test.afterEach(async ({ page }) => {
    await deleteTestUsers(page, [email]);
  });

  test("shows a Password & Security card with the change form", async ({
    page,
  }) => {
    await expect(page.getByTestId("password-security-heading")).toHaveText(
      "Password & Security"
    );

    const form = page.getByTestId("change-password-form");
    await expect(form).toBeVisible();
    await expect(page.getByTestId("current-password-input")).toHaveAttribute(
      "type",
      "password"
    );
    await expect(page.getByTestId("new-password-input")).toBeVisible();
    await expect(page.getByTestId("confirm-password-input")).toBeVisible();
    await expect(page.getByTestId("change-password-submit-button")).toHaveText(
      "Update password"
    );

    // Show/hide toggle reveals the typed value
    await page.getByTestId("new-password-input").fill("Peek123");
    await page.getByTestId("new-password-toggle").click();
    await expect(page.getByTestId("new-password-input")).toHaveAttribute(
      "type",
      "text"
    );
  });

  test("rejects a wrong current password and keeps the old one working", async ({
    page,
  }) => {
    await page.getByTestId("current-password-input").fill("NotMyPassword1");
    await page.getByTestId("new-password-input").fill(NEW_PASSWORD);
    await page.getByTestId("confirm-password-input").fill(NEW_PASSWORD);
    await page.getByTestId("change-password-submit-button").click();

    const error = page.getByTestId("change-password-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText(/doesn't match your current password/i);
    await expect(page.getByTestId("current-password-input")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    await expect(page.getByTestId("change-password-success")).toHaveCount(0);
  });

  test("rejects a confirmation that doesn't match", async ({ page }) => {
    await page.getByTestId("current-password-input").fill(CURRENT_PASSWORD);
    await page.getByTestId("new-password-input").fill(NEW_PASSWORD);
    await page.getByTestId("confirm-password-input").fill("Different1x");

    await expect(page.getByTestId("password-match-check")).toHaveText(
      "Passwords do not match"
    );

    await page.getByTestId("change-password-submit-button").click();
    const error = page.getByTestId("change-password-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText(/don't match/i);
  });

  test("changes the password and the new one signs in", async ({ page }) => {
    await page.getByTestId("current-password-input").fill(CURRENT_PASSWORD);
    await page.getByTestId("new-password-input").fill(NEW_PASSWORD);
    await page.getByTestId("confirm-password-input").fill(NEW_PASSWORD);
    await expect(page.getByTestId("password-match-check")).toHaveText(
      "Passwords match"
    );
    await page.getByTestId("change-password-submit-button").click();

    const success = page.getByTestId("change-password-success");
    await expect(success).toBeVisible();
    await expect(success).toContainText(/your password has been changed/i);

    // Fields are cleared after a successful change
    await expect(page.getByTestId("current-password-input")).toHaveValue("");
    await expect(page.getByTestId("new-password-input")).toHaveValue("");

    // Old password no longer works, new one does
    await logout(page);
    await signIn(page, email, CURRENT_PASSWORD);
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();

    await signIn(page, email, NEW_PASSWORD);
    await page.waitForURL("/dashboard");
  });
});
