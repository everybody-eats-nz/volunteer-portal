import { expect, type Page } from "@playwright/test";

/**
 * Drops whatever session the page's browser context holds, and proves it is
 * gone before returning.
 *
 * The login helpers used to log out through the /logout page and swallow any
 * failure. That page signs out from a client effect, so a slow hydration (a
 * first-visit dev compile in CI) ran past its 10s wait, the error was
 * swallowed, and the old session survived. /login then redirected the still
 * signed-in admin to /admin and the volunteer login timed out waiting for
 * /dashboard. Sessions are JWT cookies, so clearing the cookies is the whole
 * sign-out and needs no hydration.
 *
 * The page is parked on about:blank first: a request the previous page still
 * has in flight (next-auth's session refetch) can answer with a refreshed
 * session cookie and quietly sign the user back in after the clear.
 */
export async function clearSession(page: Page) {
  // Retried as a whole: the previous page can also have a navigation of its
  // own in flight (a post-login or post-signout redirect), which interrupts
  // the about:blank goto, or lands after it and sets its cookies again.
  await expect(async () => {
    await page.goto("about:blank");
    await page.context().clearCookies();
    await assertSignedOut(page);
  }).toPass({ timeout: 15_000 });
}

/**
 * Throws if the browser context still has a live session.
 */
async function assertSignedOut(page: Page) {
  const response = await page.request.get("/api/auth/session");
  const session = await response.json().catch(() => null);
  if (session?.user) {
    throw new Error(
      `Expected no session, but still signed in as ${session.user.email}`
    );
  }
}

/**
 * Helper function to login as admin user
 * Uses the quick-login button with test ID for reliability
 */
export async function loginAsAdmin(page: Page) {
  await clearSession(page);

  try {
    await page.goto("/login");
    await page.waitForLoadState("load");

    // Use .first(): the subtree briefly exists in React's hidden streaming
    // staging container too. See helpers/streaming.ts for the full explanation.
    const adminLoginButton = page
      .getByTestId("quick-login-admin-button")
      .first();
    await adminLoginButton.waitFor({ state: "visible", timeout: 10000 });
    await adminLoginButton.click();

    await page.waitForURL("/admin");
    await page.waitForLoadState("load");
    // Wait for admin dashboard content — confirms the session is fully active.
    // .first() for the same streaming reason as above. Any match is sufficient:
    // if the session were invalid we'd be at /login instead of /admin, so this
    // element wouldn't appear at all.
    await page
      .getByTestId("admin-dashboard-page")
      .first()
      .waitFor({ state: "attached", timeout: 15000 });
  } catch (error) {
    console.log("Error during admin login:", error);
    throw error;
  }
}

/**
 * Helper function to login as volunteer user
 * Uses the quick-login button with test ID for reliability
 * If customEmail is provided, uses credentials login instead
 */
export async function loginAsVolunteer(page: Page, customEmail?: string) {
  await clearSession(page);

  try {
    await page.goto("/login");
    await page.waitForLoadState("load");

    if (customEmail) {
      // Use credentials form for custom email
      // Clear the pre-filled email and enter custom email
      await page.getByLabel("Email address").fill(customEmail);

      // Fill in password (test users have password "Test123456")
      await page.getByLabel("Password").fill("Test123456");

      // Click login button
      await page.getByTestId("login-submit-button").click();
    } else {
      // Use quick login for default volunteer
      const volunteerLoginButton = page.getByTestId(
        "quick-login-volunteer-button"
      );
      await volunteerLoginButton.waitFor({ state: "visible", timeout: 10000 });
      await volunteerLoginButton.click();
    }

    await page.waitForURL("/dashboard");
    await page.waitForLoadState("load");
    await page.waitForTimeout(1000);
  } catch (error) {
    console.log("Error during volunteer login:", error);
    throw error;
  }
}

/**
 * Logs out through the real /logout page, for specs that test signing out.
 * Specs that only need to switch users should use clearSession instead.
 */
export async function logout(page: Page) {
  try {
    // waitUntil "commit" rather than the default "load": /logout signs out from
    // a mount effect and then navigates the whole document to /login, which
    // aborts any goto still waiting for load ("net::ERR_ABORTED; maybe frame
    // was detached"). The abort itself is caught by callers, but it leaves the
    // signout navigation in flight, and the /login goto that follows raced it
    // and hung for the full test timeout - taking the rest of the worker's
    // tests down with it. Committing early lets waitForURL below follow the
    // signout chain to its end instead of competing with it.
    await page.goto("/logout", { waitUntil: "commit" });

    // Wait for redirect to login page
    await page.waitForURL("**/login", { timeout: 10000 });
    await page.waitForLoadState("load");
    await assertSignedOut(page);
  } catch (error) {
    console.log("Error during logout:", error);
    throw error;
  }
}
