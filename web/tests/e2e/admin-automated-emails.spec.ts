import { test, expect } from "./base";
import { clearSession, loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import { gotoSettled } from "./helpers/streaming";
import {
  EMAIL_CATALOG,
  EMAIL_GROUPS,
  emailsInGroup,
} from "../../src/lib/email-catalog";

test.describe("Automated emails admin page", () => {
  test.describe("as an admin", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await gotoSettled(page, "/admin/emails");
    });

    test("lists every email the portal sends, grouped", async ({ page }) => {
      await expect(page.getByTestId("admin-page-header")).toContainText(
        "Automated Emails"
      );
      for (const group of EMAIL_GROUPS) {
        await expect(
          page.getByTestId(`emails-group-${group.id}`)
        ).toContainText(group.title);
      }

      await expect(page.locator('[data-testid^="email-row-"]')).toHaveCount(
        EMAIL_CATALOG.length
      );

      for (const email of EMAIL_CATALOG) {
        const row = page.getByTestId(`email-row-${email.key}`);
        await expect(row.getByTestId("email-name")).toHaveText(email.name);
        await expect(row.getByTestId("email-trigger")).toHaveText(
          email.trigger
        );
        await expect(row.getByTestId("email-recipient")).toHaveText(
          email.recipient
        );
      }
    });

    test("shows whether each template is set up, and only its ID", async ({
      page,
    }) => {
      // Which templates are set depends on the environment the tests run in,
      // so check that each row tells one consistent story either way.
      for (const email of EMAIL_CATALOG) {
        const row = page.getByTestId(`email-row-${email.key}`);
        const configured = (await row.getAttribute("data-configured")) === "true";
        await row.getByTestId("email-toggle").click();

        if (configured) {
          // A template that is set up needs no badge: only gaps are flagged.
          await expect(row.getByTestId("email-not-set-up")).toHaveCount(0);
          await expect(row.getByTestId("email-template-id-copy")).toBeVisible();
          const templateId = await row
            .getByTestId("email-template-id")
            .innerText();
          expect(templateId).not.toBe("");
          await expect(row.getByTestId("email-template-open")).toHaveAttribute(
            "href",
            new RegExp(`/triggered/workflow/${encodeURIComponent(templateId)}$`)
          );
        } else {
          await expect(row.getByTestId("email-not-set-up")).toHaveText(
            "Not set up"
          );
          await expect(row.getByTestId("email-if-not-set-up")).toHaveText(
            email.ifNotSetUp
          );
          await expect(row.getByTestId("email-template-id")).toHaveCount(0);
          await expect(row.getByTestId("email-template-open")).toHaveCount(0);
        }
      }

      // The page names templates, never the settings behind them.
      await expect(page.getByTestId("admin-emails-page")).not.toContainText(
        "CAMPAIGN_MONITOR"
      );
    });

    test("opens an email to show the variables its template can use", async ({
      page,
    }) => {
      const email = EMAIL_CATALOG.find((e) => e.key === "shift-confirmation")!;
      const row = page.getByTestId(`email-row-${email.key}`);
      const toggle = row.getByTestId("email-toggle");

      await expect(row.getByTestId("email-details")).toHaveCount(0);

      await toggle.click();

      const variables = row.getByTestId("email-variables");
      await expect(variables).toBeVisible();
      for (const variable of email.variables) {
        await expect(
          variables.getByText(variable.name, { exact: true })
        ).toBeVisible();
      }

      await toggle.click();
      await expect(row.getByTestId("email-details")).toHaveCount(0);
    });

    test("filters by group and by search", async ({ page }) => {
      const rows = page.locator('[data-testid^="email-row-"]');

      await page.getByTestId("emails-filter-team").click();
      await expect(rows).toHaveCount(emailsInGroup("team").length);
      await expect(page.getByTestId("emails-group-shifts")).toHaveCount(0);

      await page.getByTestId("emails-filter-all").click();
      await expect(rows).toHaveCount(EMAIL_CATALOG.length);

      // A variable name finds the emails that send it.
      await page.getByTestId("emails-search-input").fill("tempPassword");
      await expect(rows).toHaveCount(1);
      await expect(page.getByTestId("email-row-user-invitation")).toBeVisible();

      await page.getByTestId("emails-search-input").fill("no such email");
      await expect(rows).toHaveCount(0);
      await page
        .getByTestId("emails-empty")
        .getByRole("button", { name: "Clear search" })
        .click();
      await expect(rows).toHaveCount(EMAIL_CATALOG.length);
    });

    test("is reachable from the admin sidebar", async ({ page }) => {
      await gotoSettled(page, "/admin");
      await page.getByTestId("sidebar-emails").click();
      await page.waitForURL("**/admin/emails");
      await expect(page.getByTestId("emails-search-input")).toBeVisible();
    });
  });

  test("sends a volunteer back to their dashboard", async ({ page }) => {
    await loginAsVolunteer(page);
    await page.goto("/admin/emails");
    await page.waitForURL("**/dashboard");
    await expect(page.getByTestId("admin-emails-page")).toHaveCount(0);
  });

  test("asks a signed-out visitor to log in", async ({ page }) => {
    await clearSession(page);
    await page.goto("/admin/emails");
    await page.waitForURL(/\/login/);
  });
});
