import { test, expect } from "./base";
import { loginAsAdmin } from "./helpers/auth";

test.describe("Admin 404 page", () => {
  test("unmatched /admin/* URL renders the 404 inside the admin chrome", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await page.goto("/admin/this-page-does-not-exist");

    // The 404 boundary content is visible...
    await expect(page.getByTestId("admin-not-found")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "This page took a wrong turn" })
    ).toBeVisible();

    // ...and it renders WITH the admin chrome (sidebar + header), which is the
    // whole point of this fix - admins are never stranded on a bare 404.
    await expect(page.getByTestId("admin-sidebar")).toBeVisible();
    await expect(page.getByTestId("admin-page-header")).toHaveText(
      "Page not found"
    );
  });

  test("deeply-nested unmatched admin URL still renders the 404 with chrome", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await page.goto("/admin/users/nope/deeper");

    await expect(page.getByTestId("admin-not-found")).toBeVisible();
    await expect(page.getByTestId("admin-sidebar")).toBeVisible();
  });

  test("dashboard link navigates back to the admin dashboard", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await page.goto("/admin/does-not-exist");
    await expect(page.getByTestId("admin-not-found")).toBeVisible();

    await page.getByTestId("admin-not-found-dashboard-link").click();

    await expect(page).toHaveURL(/\/admin$/);
    // Confirm we actually landed on the working dashboard (not another 404):
    // its content renders and the 404 copy is gone from view.
    await expect(page.getByTestId("admin-dashboard-page")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "This page took a wrong turn" })
    ).toHaveCount(0);
  });
});
