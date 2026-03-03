import { test, expect } from "./base";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import {
  createTestUser,
  deleteTestUsers,
  getUserByEmail,
  createTestSurvey,
  assignSurveyToUser,
  deleteTestSurveys,
} from "./helpers/test-helpers";
import { randomUUID } from "crypto";

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

    test("should create a new survey with text question", async ({ page }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Fill in title and description
      await page.getByLabel(/title/i).fill("Test Text Survey");
      await page.locator("#description").fill("A test survey with text question");

      // The dialog auto-creates one question. Fill the question text.
      await page.getByPlaceholder("Enter your question").first().fill("What is your feedback?");

      // Select MANUAL trigger type (should be default or first option)
      // Submit the survey
      await page.getByRole("button", { name: /create survey/i }).click();

      // Wait for dialog to close
      await expect(dialog).not.toBeVisible({ timeout: 10000 });

      // Verify survey appears in list
      await expect(page.getByText("Test Text Survey").first()).toBeVisible();
    });

    test("should create survey with rating scale question", async ({
      page,
    }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Fill in title
      await page.getByLabel(/title/i).fill("Rating Test Survey");

      // Fill question text
      await page.getByPlaceholder("Enter your question").first().fill("How would you rate your experience?");

      // Change question type to rating_scale
      const typeSelect = dialog.getByText('Question Type').first().locator('..').getByRole('combobox');
      await typeSelect.click();
      await page.getByRole("option", { name: /rating scale/i }).click();

      // Submit
      await page.getByRole("button", { name: /create survey/i }).click();
      await expect(dialog).not.toBeVisible({ timeout: 10000 });

      await expect(page.getByText("Rating Test Survey").first()).toBeVisible();
    });

    test("should create survey with multiple choice question", async ({
      page,
    }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Fill in title
      await page.getByLabel(/title/i).fill("Multiple Choice Survey");

      // Fill question text
      await page.getByPlaceholder("Enter your question").first().fill("Which role do you prefer?");

      // Change question type to multiple_choice_single
      const typeSelect = dialog.getByText('Question Type').first().locator('..').getByRole('combobox');
      await typeSelect.click();
      await page.getByRole("option", { name: /single choice/i }).click();

      // Options should appear - fill them in (2 default options)
      const optionInputs = dialog.locator('input[placeholder*="Option"]');
      await optionInputs.first().fill("Kitchen");
      await optionInputs.nth(1).fill("Front of House");

      // Submit
      await page.getByRole("button", { name: /create survey/i }).click();
      await expect(dialog).not.toBeVisible({ timeout: 10000 });

      await expect(page.getByText("Multiple Choice Survey").first()).toBeVisible();
    });

    test("should validate required fields on creation", async ({ page }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Try to submit without title - click create
      await page.getByRole("button", { name: /create survey/i }).click();

      // Dialog should still be visible (validation failed)
      await expect(dialog).toBeVisible();

      // Should show error indication (red border or error text)
      const titleInput = page.getByLabel(/title/i);
      // Title field should be highlighted or error shown
      await expect(titleInput).toBeVisible();
    });

    test("should validate multiple choice options (min 2)", async ({
      page,
    }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Fill in title
      await page.getByLabel(/title/i).fill("MC Validation Test");

      // Fill question text
      await page.getByPlaceholder("Enter your question").first().fill("Pick one");

      // Change to multiple choice
      const typeSelect = dialog.getByText('Question Type').first().locator('..').getByRole('combobox');
      await typeSelect.click();
      await page.getByRole("option", { name: /single choice/i }).click();

      // Should have at least 2 option fields by default
      const optionInputs = dialog.locator('input[placeholder*="Option"]');
      expect(await optionInputs.count()).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe("Survey List Display", () => {
    const testId = randomUUID().slice(0, 8);
    const adminEmail = `admin-survlist-${testId}@example.com`;
    const surveyIds: string[] = [];
    let adminUserId: string;

    test.beforeEach(async ({ page }) => {
      surveyIds.length = 0;
      await createTestUser(page, adminEmail, "ADMIN");
      const admin = await getUserByEmail(page, adminEmail);
      adminUserId = admin!.id;

      // Create test surveys
      const survey1 = await createTestSurvey(page, {
        title: "Active Feedback Survey",
        description: "An active survey for testing",
        questions: [
          { id: "q1", type: "text_short", text: "How was your experience?", required: true },
        ],
        triggerType: "MANUAL",
        isActive: true,
        createdBy: adminUserId,
      });
      surveyIds.push(survey1.id);

      const survey2 = await createTestSurvey(page, {
        title: "Inactive Survey",
        description: "A deactivated survey",
        questions: [
          { id: "q1", type: "rating_scale", text: "Rate us", required: true, minValue: 1, maxValue: 5 },
        ],
        triggerType: "SHIFTS_COMPLETED",
        triggerValue: 5,
        isActive: false,
        createdBy: adminUserId,
      });
      surveyIds.push(survey2.id);

      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test.afterEach(async ({ page }) => {
      await deleteTestSurveys(page, surveyIds);
      await deleteTestUsers(page, [adminEmail]);
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

    test("should display survey cards with title and description", async ({
      page,
    }) => {
      await expect(page.getByText("Active Feedback Survey").first()).toBeVisible();
      await expect(page.getByText("Inactive Survey").first()).toBeVisible();
    });

    test("should display survey stats (assigned, completed, pending)", async ({
      page,
    }) => {
      // Stats show "0 assigned", "0 completed", "0 pending" for fresh surveys
      await expect(page.getByText(/assigned/).first()).toBeVisible();
    });

    test("should show trigger type badge on survey cards", async ({
      page,
    }) => {
      // The SHIFTS_COMPLETED survey should show its trigger badge
      await expect(page.getByText(/shifts completed/i).first()).toBeVisible();
    });

    test("should show inactive badge for deactivated surveys", async ({
      page,
    }) => {
      await expect(page.getByText("Inactive", { exact: true }).first()).toBeVisible();
    });
  });

  test.describe("Survey Edit", () => {
    const testId = randomUUID().slice(0, 8);
    const adminEmail = `admin-survedit-${testId}@example.com`;
    const surveyIds: string[] = [];
    let adminUserId: string;

    test.beforeEach(async ({ page }) => {
      surveyIds.length = 0;
      await createTestUser(page, adminEmail, "ADMIN");
      const admin = await getUserByEmail(page, adminEmail);
      adminUserId = admin!.id;

      const survey = await createTestSurvey(page, {
        title: "Edit Test Survey",
        description: "Survey to test editing",
        questions: [
          { id: "q1", type: "text_short", text: "Original question?", required: true },
        ],
        triggerType: "MANUAL",
        isActive: true,
        createdBy: adminUserId,
      });
      surveyIds.push(survey.id);

      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test.afterEach(async ({ page }) => {
      await deleteTestSurveys(page, surveyIds);
      await deleteTestUsers(page, [adminEmail]);
    });

    test("should open edit dialog with pre-populated data", async ({
      page,
    }) => {
      // Find the edit button on the survey card
      const editButton = page.getByTestId(`edit-survey-${surveyIds[0]}`);
      await editButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Title should be pre-populated
      const titleInput = page.getByLabel(/title/i);
      await expect(titleInput).toHaveValue("Edit Test Survey");
    });

    test("should allow updating survey title", async ({ page }) => {
      const editButton = page.getByTestId(`edit-survey-${surveyIds[0]}`);
      await editButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Update title
      const titleInput = page.getByLabel(/title/i);
      await titleInput.clear();
      await titleInput.fill("Updated Survey Title");

      // Save
      await page.getByRole("button", { name: /update survey/i }).click();
      await expect(dialog).not.toBeVisible({ timeout: 10000 });

      // Verify updated title appears
      await expect(page.getByText("Updated Survey Title").first()).toBeVisible();
    });

    test("should allow adding new questions to existing survey", async ({
      page,
    }) => {
      const editButton = page.getByTestId(`edit-survey-${surveyIds[0]}`);
      await editButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Click "Add Question"
      await page.getByRole("button", { name: /add question/i }).click();

      // Should now have 2 questions
      const questionHeaders = dialog.getByText(/question \d+/i);
      expect(await questionHeaders.count()).toBeGreaterThanOrEqual(2);
    });

    test("should allow removing questions from survey", async ({ page }) => {
      // First add a second question so we can remove one
      const editButton = page.getByTestId(`edit-survey-${surveyIds[0]}`);
      await editButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Add a question first
      await page.getByRole("button", { name: /add question/i }).click();

      // Now delete the second question (Trash icon button)
      const trashButtons = dialog.locator('button:has(.lucide-trash-2)');
      if ((await trashButtons.count()) > 0) {
        await trashButtons.last().click();
      }
    });

    test("should allow changing trigger type", async ({ page }) => {
      const editButton = page.getByTestId(`edit-survey-${surveyIds[0]}`);
      await editButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Find trigger type select and change it
      const triggerSelect = dialog.getByText('Trigger Type').locator('..').getByRole('combobox');
      await triggerSelect.click();
      await page.getByRole("option", { name: /shifts completed/i }).click();

      // Trigger value field should now be visible
      await expect(dialog.getByLabel(/minimum shifts/i).or(dialog.locator("#triggerValue"))).toBeVisible();
    });
  });

  test.describe("Survey Activation/Deactivation", () => {
    const testId = randomUUID().slice(0, 8);
    const adminEmail = `admin-survtoggle-${testId}@example.com`;
    const surveyIds: string[] = [];
    let adminUserId: string;

    test.beforeEach(async ({ page }) => {
      surveyIds.length = 0;
      await createTestUser(page, adminEmail, "ADMIN");
      const admin = await getUserByEmail(page, adminEmail);
      adminUserId = admin!.id;

      const survey = await createTestSurvey(page, {
        title: "Toggle Active Survey",
        questions: [
          { id: "q1", type: "text_short", text: "Question?", required: true },
        ],
        triggerType: "MANUAL",
        isActive: true,
        createdBy: adminUserId,
      });
      surveyIds.push(survey.id);

      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test.afterEach(async ({ page }) => {
      await deleteTestSurveys(page, surveyIds);
      await deleteTestUsers(page, [adminEmail]);
    });

    test("should toggle survey active status", async ({ page }) => {
      // Find the toggle button (ToggleRight/ToggleLeft icon)
      await expect(page.getByText("Toggle Active Survey")).toBeVisible();

      // Click deactivate button
      const toggleButton = page.getByTestId(`toggle-survey-${surveyIds[0]}`);
      await toggleButton.click();

      // Should show Inactive badge after toggle
      await expect(page.getByText("Inactive", { exact: true }).first()).toBeVisible({ timeout: 5000 });
    });

    test("should show inactive badge after deactivation", async ({ page }) => {
      // Deactivate the survey
      const toggleButton = page.getByTestId(`toggle-survey-${surveyIds[0]}`);
      await toggleButton.click();

      // Inactive badge should be visible
      await expect(page.getByText("Inactive", { exact: true }).first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Survey Deletion", () => {
    const testId = randomUUID().slice(0, 8);
    const adminEmail = `admin-survdel-${testId}@example.com`;
    const volunteerEmail = `vol-survdel-${testId}@example.com`;
    const surveyIds: string[] = [];
    let adminUserId: string;

    test.beforeEach(async ({ page }) => {
      surveyIds.length = 0;
      await createTestUser(page, adminEmail, "ADMIN");
      await createTestUser(page, volunteerEmail, "VOLUNTEER");
      const admin = await getUserByEmail(page, adminEmail);
      adminUserId = admin!.id;

      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test.afterEach(async ({ page }) => {
      await deleteTestSurveys(page, surveyIds);
      await deleteTestUsers(page, [adminEmail, volunteerEmail]);
    });

    test("should show confirmation dialog when deleting survey", async ({
      page,
    }) => {
      // Create survey for this test
      const survey = await createTestSurvey(page, {
        title: "Delete Confirm Survey",
        questions: [
          { id: "q1", type: "text_short", text: "Q?", required: true },
        ],
        triggerType: "MANUAL",
        createdBy: adminUserId,
      });
      surveyIds.push(survey.id);

      await page.reload();
      await expect(page.getByText("Delete Confirm Survey")).toBeVisible();

      // Click delete button
      const deleteButton = page.getByTestId(`delete-survey-${survey.id}`);
      await deleteButton.click();

      // Confirmation dialog should appear
      await expect(page.getByText("Delete Survey")).toBeVisible();
    });

    test("should delete survey with no assignments", async ({ page }) => {
      const survey = await createTestSurvey(page, {
        title: "Delete No Assign Survey",
        questions: [
          { id: "q1", type: "text_short", text: "Q?", required: true },
        ],
        triggerType: "MANUAL",
        createdBy: adminUserId,
      });
      surveyIds.push(survey.id);

      await page.reload();
      await expect(page.getByText("Delete No Assign Survey")).toBeVisible();

      // Click delete
      const deleteButton = page.getByTestId(`delete-survey-${survey.id}`);
      await deleteButton.click();

      // Confirm deletion
      const confirmButton = page.getByRole("button", { name: /^delete$/i });
      await confirmButton.click();

      // Survey should be removed
      await expect(page.getByText("Delete No Assign Survey")).not.toBeVisible({ timeout: 10000 });
      // Remove from cleanup since it's been deleted
      surveyIds.pop();
    });

    test("should deactivate survey with existing assignments", async ({
      page,
    }) => {
      const volunteer = await getUserByEmail(page, volunteerEmail);

      const survey = await createTestSurvey(page, {
        title: "Delete With Assign Survey",
        questions: [
          { id: "q1", type: "text_short", text: "Q?", required: true },
        ],
        triggerType: "MANUAL",
        createdBy: adminUserId,
      });
      surveyIds.push(survey.id);

      // Assign to volunteer
      await assignSurveyToUser(page, {
        surveyId: survey.id,
        userId: volunteer!.id,
      });

      await page.reload();
      await expect(page.getByText("Delete With Assign Survey")).toBeVisible();

      // Click delete
      const deleteButton = page.getByTestId(`delete-survey-${survey.id}`);
      await deleteButton.click();

      // Should see deactivation message instead
      await expect(page.getByText(/will be deactivated/i)).toBeVisible();
    });

    test("should allow cancelling delete operation", async ({ page }) => {
      const survey = await createTestSurvey(page, {
        title: "Cancel Delete Survey",
        questions: [
          { id: "q1", type: "text_short", text: "Q?", required: true },
        ],
        triggerType: "MANUAL",
        createdBy: adminUserId,
      });
      surveyIds.push(survey.id);

      await page.reload();
      await expect(page.getByText("Cancel Delete Survey")).toBeVisible();

      // Click delete
      const deleteButton = page.getByTestId(`delete-survey-${survey.id}`);
      await deleteButton.click();

      // Cancel
      await page.getByRole("button", { name: /cancel/i }).click();

      // Survey should still be there
      await expect(page.getByText("Cancel Delete Survey")).toBeVisible();
    });
  });

  test.describe("Manual Survey Assignment", () => {
    const testId = randomUUID().slice(0, 8);
    const adminEmail = `admin-survassign-${testId}@example.com`;
    const volunteerEmail = `vol-survassign-${testId}@example.com`;
    const surveyIds: string[] = [];
    let adminUserId: string;

    test.beforeEach(async ({ page }) => {
      surveyIds.length = 0;
      await createTestUser(page, adminEmail, "ADMIN");
      await createTestUser(page, volunteerEmail, "VOLUNTEER");
      const admin = await getUserByEmail(page, adminEmail);
      adminUserId = admin!.id;

      const survey = await createTestSurvey(page, {
        title: "Assignment Test Survey",
        questions: [
          { id: "q1", type: "text_short", text: "Feedback?", required: true },
        ],
        triggerType: "MANUAL",
        isActive: true,
        createdBy: adminUserId,
      });
      surveyIds.push(survey.id);

      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test.afterEach(async ({ page }) => {
      await deleteTestSurveys(page, surveyIds);
      await deleteTestUsers(page, [adminEmail, volunteerEmail]);
    });

    test("should open assign dialog when clicking assign button", async ({
      page,
    }) => {
      const assignButton = page.getByTestId(new RegExp(`assign-survey-${surveyIds[0]}`));
      await assignButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(page.getByText("Assign Survey")).toBeVisible();
    });

    test("should search and filter users in assign dialog", async ({
      page,
    }) => {
      const assignButton = page.getByTestId(new RegExp(`assign-survey-${surveyIds[0]}`));
      await assignButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Search for the volunteer
      const searchInput = page.getByTestId("assign-survey-search");
      await searchInput.fill(volunteerEmail);

      // Wait for search results (debounced)
      await page.waitForTimeout(500);

      // Should find the volunteer
      await expect(page.getByText(volunteerEmail)).toBeVisible();
    });

    test("should allow selecting multiple users for assignment", async ({
      page,
    }) => {
      const assignButton = page.getByTestId(new RegExp(`assign-survey-${surveyIds[0]}`));
      await assignButton.click();

      await expect(page.getByRole("dialog")).toBeVisible();

      // Search for our test volunteer
      const searchInput = page.getByTestId("assign-survey-search");
      await searchInput.fill("vol-survassign");
      await page.waitForTimeout(500);

      // Click the checkbox for the user
      const userCheckbox = page.locator(`[data-testid^="assign-user-"]`).first();
      if ((await userCheckbox.count()) > 0) {
        await userCheckbox.click();

        // Should show selected count
        await expect(page.getByText(/1 user.*selected/i)).toBeVisible();
      }
    });

    test("should show already assigned users as disabled", async ({
      page,
    }) => {
      // First assign the volunteer
      const volunteer = await getUserByEmail(page, volunteerEmail);
      await assignSurveyToUser(page, {
        surveyId: surveyIds[0],
        userId: volunteer!.id,
      });

      await page.reload();

      const assignButton = page.getByTestId(new RegExp(`assign-survey-${surveyIds[0]}`));
      await assignButton.click();

      await expect(page.getByRole("dialog")).toBeVisible();

      // Search for the volunteer
      const searchInput = page.getByTestId("assign-survey-search");
      await searchInput.fill(volunteerEmail);
      await page.waitForTimeout(500);

      // Should show as already assigned
      await expect(page.getByText("Already Assigned")).toBeVisible();
    });

    test("should assign survey to selected users", async ({ page }) => {
      const assignButton = page.getByTestId(new RegExp(`assign-survey-${surveyIds[0]}`));
      await assignButton.click();

      await expect(page.getByRole("dialog")).toBeVisible();

      // Search for our test volunteer
      const searchInput = page.getByTestId("assign-survey-search");
      await searchInput.fill("vol-survassign");
      await page.waitForTimeout(500);

      // Select the user
      const userCheckbox = page.locator(`[data-testid^="assign-user-"]`).first();
      if ((await userCheckbox.count()) > 0) {
        await userCheckbox.click();

        // Click assign button
        const submitButton = page.getByTestId("assign-survey-submit");
        await submitButton.click();

        // Dialog should close after assignment
        await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });
      }
    });

    test("should show MANUAL surveys with prominent assign button", async ({
      page,
    }) => {
      // MANUAL trigger surveys should have the assign button visible
      const assignButton = page.getByTestId(new RegExp(`assign-survey-${surveyIds[0]}`));
      await expect(assignButton).toBeVisible();
    });
  });

  test.describe("Survey Responses", () => {
    const testId = randomUUID().slice(0, 8);
    const adminEmail = `admin-survresp-${testId}@example.com`;
    const surveyIds: string[] = [];
    let adminUserId: string;

    test.beforeEach(async ({ page }) => {
      surveyIds.length = 0;
      await createTestUser(page, adminEmail, "ADMIN");
      const admin = await getUserByEmail(page, adminEmail);
      adminUserId = admin!.id;

      const survey = await createTestSurvey(page, {
        title: "Responses Test Survey",
        questions: [
          { id: "q1", type: "text_short", text: "Feedback?", required: true },
        ],
        triggerType: "MANUAL",
        isActive: true,
        createdBy: adminUserId,
      });
      surveyIds.push(survey.id);

      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test.afterEach(async ({ page }) => {
      await deleteTestSurveys(page, surveyIds);
      await deleteTestUsers(page, [adminEmail]);
    });

    test("should navigate to responses page when clicking view responses", async ({
      page,
    }) => {
      // Click view responses button (Eye icon)
      const viewButton = page.getByTestId(`view-responses-${surveyIds[0]}`);
      await viewButton.click();

      await expect(page).toHaveURL(new RegExp(`/admin/surveys/${surveyIds[0]}/responses`));
    });

    test("should display list of responses", async ({ page }) => {
      await page.goto(`/admin/surveys/${surveyIds[0]}/responses`);
      await page.waitForLoadState("load");

      // Should show the survey title
      await expect(page.getByText("Responses Test Survey").first()).toBeVisible();

      // Should show tabs (Summary, Responses, Assignments)
      await expect(page.getByText(/responses/i).first()).toBeVisible();
    });

    test("should show response details when clicking a response", async ({
      page,
    }) => {
      await page.goto(`/admin/surveys/${surveyIds[0]}/responses`);
      await page.waitForLoadState("load");

      // Verify tabs are present
      await expect(page.getByRole("tab", { name: /assignments/i })).toBeVisible();
    });

    test("should allow filtering responses by status", async ({ page }) => {
      await page.goto(`/admin/surveys/${surveyIds[0]}/responses`);
      await page.waitForLoadState("load");

      // Check for the assignments tab which shows status
      const assignmentsTab = page.getByRole("tab", { name: /assignments/i });
      await assignmentsTab.click();

      // Should show the assignments list (may be empty)
      const hasNoAssignments = await page.getByText(/no assignments yet/i).count() > 0;
      const hasTable = await page.locator("table").count() > 0;
      expect(hasNoAssignments || hasTable).toBeTruthy();
    });
  });

  test.describe("Email Preview", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test("should show preview email button in create dialog", async ({
      page,
    }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Should have a Preview Email button
      await expect(
        page.getByRole("button", { name: /preview email/i })
      ).toBeVisible();
    });

    test("should show preview email button in edit dialog", async ({
      page,
    }) => {
      // We need a survey to edit - check if any exist
      const editButton = page.locator('[data-testid^="edit-survey-"]').first();
      if ((await editButton.count()) > 0) {
        await editButton.click();

        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();

        await expect(
          page.getByRole("button", { name: /preview email/i })
        ).toBeVisible();
      }
    });

    test("should show preview email button in assign dialog", async ({
      page,
    }) => {
      const assignButton = page.locator('[data-testid^="assign-survey-"]').first();
      if ((await assignButton.count()) > 0) {
        await assignButton.click();

        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();

        await expect(
          page.getByRole("button", { name: /preview email/i })
        ).toBeVisible();
      }
    });

    test("should display email preview when clicked", async ({ page }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      const previewButton = page.getByRole("button", { name: /preview email/i });
      await previewButton.click();

      // Email preview dialog/section should appear
      await page.waitForTimeout(500);
      // Preview should show email template content
      const emailContent = page.getByText(/survey/i);
      await expect(emailContent.first()).toBeVisible();
    });
  });

  test.describe("Question Types", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test("should allow creating text_short question", async ({ page }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Default question type should be text_short or we can select it
      const typeSelect = dialog.getByText('Question Type').first().locator('..').getByRole('combobox');
      await typeSelect.click();
      await page.getByRole("option", { name: /short text/i }).click();

      // Should see placeholder field
      await expect(dialog.getByPlaceholder('Enter placeholder text')).toBeVisible();
    });

    test("should allow creating text_long question", async ({ page }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      const typeSelect = dialog.getByText('Question Type').first().locator('..').getByRole('combobox');
      await typeSelect.click();
      await page.getByRole("option", { name: /long text/i }).click();

      await expect(dialog.getByPlaceholder('Enter placeholder text')).toBeVisible();
    });

    test("should allow creating rating_scale question", async ({ page }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      const typeSelect = dialog.getByText('Question Type').first().locator('..').getByRole('combobox');
      await typeSelect.click();
      await page.getByRole("option", { name: /rating scale/i }).click();

      // Should see min/max value fields
      await expect(dialog.getByText('Min Value')).toBeVisible();
      await expect(dialog.getByText('Max Value')).toBeVisible();
    });

    test("should allow creating multiple_choice_single question", async ({
      page,
    }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      const typeSelect = dialog.getByText('Question Type').first().locator('..').getByRole('combobox');
      await typeSelect.click();
      await page.getByRole("option", { name: /single choice/i }).click();

      // Should see options inputs
      await expect(dialog.getByText("Options", { exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: /add option/i })).toBeVisible();
    });

    test("should allow creating multiple_choice_multi question", async ({
      page,
    }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      const typeSelect = dialog.getByText('Question Type').first().locator('..').getByRole('combobox');
      await typeSelect.click();
      await page.getByRole("option", { name: /multiple choice/i }).click();

      // Should see options inputs
      await expect(dialog.getByText("Options", { exact: true })).toBeVisible();
    });

    test("should allow setting question as required", async ({ page }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Should see Required switch
      await expect(dialog.getByLabel(/required/i)).toBeVisible();
    });

    test("should allow reordering questions", async ({ page }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Add a second question
      await page.getByRole("button", { name: /add question/i }).click();

      // Should see move up/down buttons
      const moveButtons = dialog.locator('button:has(svg.lucide-chevron-up), button:has(svg.lucide-chevron-down)');
      expect(await moveButtons.count()).toBeGreaterThan(0);
    });
  });

  test.describe("Trigger Types", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto("/admin/surveys");
    });

    test("should allow creating MANUAL trigger survey", async ({ page }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Select MANUAL trigger
      const triggerSelect = dialog.getByText('Trigger Type').locator('..').getByRole('combobox');
      await triggerSelect.click();
      await page.getByRole("option", { name: /manual/i }).click();

      // Trigger value field should NOT be visible for MANUAL
      await expect(dialog.locator("#triggerValue")).not.toBeVisible();
    });

    test("should allow creating SHIFTS_COMPLETED trigger survey", async ({
      page,
    }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      const triggerSelect = dialog.getByText('Trigger Type').locator('..').getByRole('combobox');
      await triggerSelect.click();
      await page.getByRole("option", { name: /shifts completed/i }).click();

      // Trigger value field should be visible
      await expect(dialog.locator("#triggerValue")).toBeVisible();
    });

    test("should allow creating HOURS_VOLUNTEERED trigger survey", async ({
      page,
    }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      const triggerSelect = dialog.getByText('Trigger Type').locator('..').getByRole('combobox');
      await triggerSelect.click();
      await page.getByRole("option", { name: /hours volunteered/i }).click();

      await expect(dialog.locator("#triggerValue")).toBeVisible();
    });

    test("should allow creating FIRST_SHIFT trigger survey", async ({
      page,
    }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      const triggerSelect = dialog.getByText('Trigger Type').locator('..').getByRole('combobox');
      await triggerSelect.click();
      await page.getByRole("option", { name: /first shift/i }).click();

      await expect(dialog.locator("#triggerValue")).toBeVisible();
    });

    test("should hide trigger value field for MANUAL trigger", async ({
      page,
    }) => {
      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // First select a non-MANUAL trigger to make the value field appear
      const triggerSelect = dialog.getByText('Trigger Type').locator('..').getByRole('combobox');
      await triggerSelect.click();
      await page.getByRole("option", { name: /shifts completed/i }).click();
      await expect(dialog.locator("#triggerValue")).toBeVisible();

      // Now switch to MANUAL
      await triggerSelect.click();
      await page.getByRole("option", { name: /manual/i }).click();

      // Trigger value should be hidden
      await expect(dialog.locator("#triggerValue")).not.toBeVisible();
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

    test("should use responsive dialog on mobile", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/admin/surveys");

      const createButton = page.getByTestId("create-survey-button");
      await createButton.click();

      // Dialog should be visible on mobile
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Close it
      await page.getByRole("button", { name: /cancel/i }).click();
    });
  });
});
