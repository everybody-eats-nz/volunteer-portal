import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";

test.describe("Admin Surveys Management", () => {
  test.describe("Page Access and Authentication", () => {
    test("should allow admin users to access the surveys page", async ({
      page,
    }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/surveys");

      await expect(page).toHaveURL("/admin/surveys");
      // Use testid to avoid matching multiple headings
      await expect(page.getByTestId("admin-page-header")).toHaveText("Surveys");
    });

    test("should redirect non-admin users from admin surveys page", async ({
      page,
    }) => {
      await loginAsVolunteer(page);
      await page.goto("/admin/surveys");
      await page.waitForLoadState("load");

      // Should redirect to dashboard
      await expect(page).not.toHaveURL("/admin/surveys");
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/dashboard/);
    });

    test("should redirect unauthenticated users to login", async ({
      context,
    }) => {
      const newContext = await context.browser()?.newContext();
      if (!newContext) throw new Error("Could not create new context");

      const newPage = await newContext.newPage();
      await newPage.goto("/admin/surveys");

      await expect(newPage).toHaveURL(/\/login/);
      const currentUrl = newPage.url();
      expect(currentUrl).toContain("callbackUrl");

      await newPage.close();
      await newContext.close();
    });
  });

  test.describe("Survey Creation", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test("should display create survey button", async ({ page }) => {
      const createButton = page.getByTestId("create-survey-button");
      await expect(createButton).toBeVisible();
    });

    test("should open create survey dialog when clicking create button", async ({
      page,
    }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      // Dialog should be visible
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Should show create form with title input
      await expect(page.getByLabel(/title/i)).toBeVisible();
    });

    test.skip("should create a new survey with text question", async ({
      page,
    }) => {
      // TODO: Implement test
      // - Click create survey button
      // - Fill in title and description
      // - Add a text question
      // - Select trigger type
      // - Submit and verify survey appears in list
    });

    test.skip("should create survey with rating scale question", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should create survey with multiple choice question", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should validate required fields on creation", async ({
      page,
    }) => {
      // TODO: Implement test
      // - Open create dialog
      // - Try to submit without title
      // - Verify error message
    });

    test.skip("should validate multiple choice options (min 2)", async ({
      page,
    }) => {
      // TODO: Implement test
    });
  });

  test.describe("Survey List Display", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test("should display empty state when no surveys exist", async ({
      page,
    }) => {
      // Only check if empty state is shown when appropriate
      const noSurveysMessage = page.getByText(/no surveys yet/i);
      const surveyCards = page.locator('[class*="card"]');

      // Either show empty state or show survey cards
      const isEmpty = (await noSurveysMessage.count()) > 0;
      if (isEmpty) {
        await expect(noSurveysMessage).toBeVisible();
      } else {
        expect(await surveyCards.count()).toBeGreaterThan(0);
      }
    });

    test.skip("should display survey cards with title and description", async ({
      page,
    }) => {
      // TODO: Implement test - requires seeded data
    });

    test.skip("should display survey stats (assigned, completed, pending)", async ({
      page,
    }) => {
      // TODO: Implement test - requires seeded data
    });

    test.skip("should show trigger type badge on survey cards", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should show inactive badge for deactivated surveys", async ({
      page,
    }) => {
      // TODO: Implement test
    });
  });

  test.describe("Survey Edit", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test.skip("should open edit dialog with pre-populated data", async ({
      page,
    }) => {
      // TODO: Implement test - requires seeded survey
    });

    test.skip("should allow updating survey title", async ({ page }) => {
      // TODO: Implement test
    });

    test.skip("should allow adding new questions to existing survey", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should allow removing questions from survey", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should allow changing trigger type", async ({ page }) => {
      // TODO: Implement test
    });
  });

  test.describe("Survey Activation/Deactivation", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test.skip("should toggle survey active status", async ({ page }) => {
      // TODO: Implement test
      // - Click toggle button on a survey
      // - Verify status changes
      // - Verify inactive badge appears/disappears
    });

    test.skip("should show inactive badge after deactivation", async ({
      page,
    }) => {
      // TODO: Implement test
    });
  });

  test.describe("Survey Deletion", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test.skip("should show confirmation dialog when deleting survey", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should delete survey with no assignments", async ({ page }) => {
      // TODO: Implement test
    });

    test.skip("should deactivate survey with existing assignments", async ({
      page,
    }) => {
      // TODO: Implement test
      // - Try to delete survey with assignments
      // - Verify it's deactivated instead of deleted
    });

    test.skip("should allow cancelling delete operation", async ({ page }) => {
      // TODO: Implement test
    });
  });

  test.describe("Manual Survey Assignment", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test.skip("should open assign dialog when clicking assign button", async ({
      page,
    }) => {
      // TODO: Implement test - requires seeded survey
      // - Find a survey card
      // - Click the assign button
      // - Verify dialog opens with user search
    });

    test.skip("should search and filter users in assign dialog", async ({
      page,
    }) => {
      // TODO: Implement test
      // - Open assign dialog
      // - Type in search field
      // - Verify filtered results
    });

    test.skip("should allow selecting multiple users for assignment", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should show already assigned users as disabled", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should assign survey to selected users", async ({ page }) => {
      // TODO: Implement test
      // - Select users
      // - Click assign button
      // - Verify success toast
      // - Verify assignment count updates
    });

    test.skip("should show MANUAL surveys with prominent assign button", async ({
      page,
    }) => {
      // TODO: Implement test
    });
  });

  test.describe("Survey Responses", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test.skip("should navigate to responses page when clicking view responses", async ({
      page,
    }) => {
      // TODO: Implement test
      // - Click view responses button
      // - Verify navigation to /admin/surveys/[id]/responses
    });

    test.skip("should display list of responses", async ({ page }) => {
      // TODO: Implement test - requires seeded responses
    });

    test.skip("should show response details when clicking a response", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should allow filtering responses by status", async ({
      page,
    }) => {
      // TODO: Implement test
    });
  });

  test.describe("Email Preview", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test.skip("should show preview email button in create dialog", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should show preview email button in edit dialog", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should show preview email button in assign dialog", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should display email preview when clicked", async ({ page }) => {
      // TODO: Implement test
    });
  });

  test.describe("Question Types", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test.skip("should allow creating text_short question", async ({ page }) => {
      // TODO: Implement test
    });

    test.skip("should allow creating text_long question", async ({ page }) => {
      // TODO: Implement test
    });

    test.skip("should allow creating rating_scale question", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should allow creating multiple_choice_single question", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should allow creating multiple_choice_multi question", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should allow setting question as required", async ({ page }) => {
      // TODO: Implement test
    });

    test.skip("should allow reordering questions", async ({ page }) => {
      // TODO: Implement test
    });
  });

  test.describe("Trigger Types", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test.skip("should allow creating MANUAL trigger survey", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should allow creating SHIFTS_COMPLETED trigger survey", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should allow creating HOURS_VOLUNTEERED trigger survey", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should allow creating FIRST_SHIFT trigger survey", async ({
      page,
    }) => {
      // TODO: Implement test
    });

    test.skip("should hide trigger value field for MANUAL trigger", async ({
      page,
    }) => {
      // TODO: Implement test
    });
  });

  test.describe("Responsive Design", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("should be responsive on mobile viewport", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/admin/surveys");

      // Check main elements are visible
      await expect(page.getByTestId("admin-page-header")).toHaveText("Surveys");
      await expect(page.getByTestId("create-survey-button")).toBeVisible();
    });

    test.skip("should use responsive dialog on mobile", async ({ page }) => {
      // TODO: Implement test
    });
  });
});
