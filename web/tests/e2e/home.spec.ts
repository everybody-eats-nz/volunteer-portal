import { test, expect } from "./base";
import type { Page } from "@playwright/test";

test.describe("Home Page", () => {
  test.describe("Unauthenticated User Experience", () => {
    test("should display home page with all main elements", async ({ page }) => {
      // Navigate to home page
      await page.goto("/");
      await page.waitForLoadState("load");

      // Verify we're on the home page (not redirected)
      await expect(page).toHaveURL("/");

      // Check main page container
      const homePage = page.getByTestId("home-page");
      await expect(homePage).toBeVisible();

      // Check hero section
      const heroSection = page.getByTestId("hero-section");
      await expect(heroSection).toBeVisible();

      // Check main title
      const heroTitle = page.getByTestId("hero-title");
      await expect(heroTitle).toBeVisible();
      await expect(heroTitle).toContainText("Making a difference one plate at a time");

      // Check hero description
      const heroDescription = page.getByTestId("hero-description");
      await expect(heroDescription).toBeVisible();
      await expect(heroDescription).toContainText("Everybody Eats is an innovative, charitable restaurant");

      // Check hero action buttons
      const heroActions = page.getByTestId("hero-actions");
      await expect(heroActions).toBeVisible();

      const browsShiftsButton = page.getByTestId("hero-browse-shifts-button");
      await expect(browsShiftsButton).toBeVisible();
      await expect(browsShiftsButton).toContainText("Browse volunteer shifts");

      const joinVolunteerButton = page.getByTestId("hero-join-volunteer-button");
      await expect(joinVolunteerButton).toBeVisible();
      await expect(joinVolunteerButton).toContainText("Join as volunteer");
    });

    test("should display hero image", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("load");

      // Check hero image (on desktop)
      const heroImage = page.getByTestId("hero-image");
      // Hero image is hidden on mobile, so we check if it exists
      if (await heroImage.isVisible()) {
        await expect(heroImage).toHaveAttribute("alt", "People enjoying meals together at Everybody Eats restaurant");
      }
    });

    test("should display features section", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("load");

      // Check features section
      const featuresSection = page.getByTestId("features-section");
      await expect(featuresSection).toBeVisible();

      // Check individual feature cards
      const communityImpact = page.getByTestId("feature-community-impact");
      await expect(communityImpact).toBeVisible();
      await expect(communityImpact).toContainText("Community Impact");

      const flexibleScheduling = page.getByTestId("feature-flexible-scheduling");
      await expect(flexibleScheduling).toBeVisible();
      await expect(flexibleScheduling).toContainText("Flexible Scheduling");

      const meaningfulWork = page.getByTestId("feature-meaningful-work");
      await expect(meaningfulWork).toBeVisible();
      await expect(meaningfulWork).toContainText("Meaningful Work");
    });

    test("should display call-to-action section for unauthenticated users", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("load");

      // Check CTA section
      const ctaSection = page.getByTestId("cta-section");
      await expect(ctaSection).toBeVisible();

      // Check main CTA buttons (for unauthenticated users)
      const ctaButtons = page.getByTestId("cta-buttons");
      await expect(ctaButtons).toBeVisible();

      const browseShiftsButton = page.getByTestId("cta-browse-shifts-unauthenticated");
      await expect(browseShiftsButton).toBeVisible();
      await expect(browseShiftsButton).toContainText("Browse Available Shifts");

      const joinVolunteerButton = page.getByTestId("cta-join-volunteer-button");
      await expect(joinVolunteerButton).toBeVisible();
      await expect(joinVolunteerButton).toContainText("Join as Volunteer");
    });

    test("should display opportunities grid", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("load");

      // Check opportunities grid
      const opportunitiesGrid = page.getByTestId("opportunities-grid");
      await expect(opportunitiesGrid).toBeVisible();

      // Check individual opportunity cards
      const communityMeals = page.getByTestId("opportunity-community-meals");
      await expect(communityMeals).toBeVisible();
      await expect(communityMeals).toContainText("Community Meals");

      const foodDistribution = page.getByTestId("opportunity-food-distribution");
      await expect(foodDistribution).toBeVisible();
      await expect(foodDistribution).toContainText("Food Distribution");

      const eventSupport = page.getByTestId("opportunity-event-support");
      await expect(eventSupport).toBeVisible();
      await expect(eventSupport).toContainText("Event Support");
    });

    test("should display final call-to-action section for unauthenticated users", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("load");

      // Check final CTA section
      const finalCtaSection = page.getByTestId("final-cta-section");
      await expect(finalCtaSection).toBeVisible();

      const finalCtaTitle = page.getByTestId("final-cta-title");
      await expect(finalCtaTitle).toBeVisible();
      await expect(finalCtaTitle).toContainText("Ready to Make a Difference?");

      // Check final CTA buttons (only visible for unauthenticated users)
      const finalCtaButtons = page.getByTestId("final-cta-buttons");
      await expect(finalCtaButtons).toBeVisible();

      const getStartedButton = page.getByTestId("final-get-started-button");
      await expect(getStartedButton).toBeVisible();
      await expect(getStartedButton).toContainText("Get Started");

      const signInButton = page.getByTestId("final-sign-in-button");
      await expect(signInButton).toBeVisible();
      await expect(signInButton).toContainText("Sign In");
    });

    test("should navigate to shifts page from hero browse button", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("load");

      const browseShiftsButton = page.getByTestId("hero-browse-shifts-button");
      await expect(browseShiftsButton).toBeVisible();
      await browseShiftsButton.click();
      await page.waitForLoadState("load");

      await expect(page).toHaveURL("/shifts");
    });

    test("should navigate to registration page from hero join button", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("load");

      const joinVolunteerButton = page.getByTestId("hero-join-volunteer-button");
      await expect(joinVolunteerButton).toBeVisible();
      await joinVolunteerButton.click();
      await page.waitForLoadState("load");

      await expect(page).toHaveURL("/register");
    });

    test("should navigate to registration page from CTA join button", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("load");

      const joinVolunteerButton = page.getByTestId("cta-join-volunteer-button");
      await expect(joinVolunteerButton).toBeVisible();
      await joinVolunteerButton.click();
      await page.waitForLoadState("load");

      await expect(page).toHaveURL("/register");
    });

    test("should navigate to shifts page from CTA browse button", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("load");

      const browseShiftsButton = page.getByTestId("cta-browse-shifts-unauthenticated");
      await expect(browseShiftsButton).toBeVisible();
      await browseShiftsButton.click();
      await page.waitForLoadState("load");

      await expect(page).toHaveURL("/shifts");
    });

    test("should navigate to registration page from final get started button", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("load");

      const getStartedButton = page.getByTestId("final-get-started-button");
      await expect(getStartedButton).toBeVisible();
      await getStartedButton.click();
      await page.waitForLoadState("load");

      await expect(page).toHaveURL("/register");
    });

    test("should navigate to login page from final sign in button", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("load");

      const signInButton = page.getByTestId("final-sign-in-button");
      await expect(signInButton).toBeVisible();
      await signInButton.click();
      await page.waitForLoadState("load");

      await expect(page).toHaveURL("/login");
    });

    test("should be responsive on mobile viewport", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/");
      await page.waitForLoadState("load");

      // Check that main elements are still visible and accessible
      const heroTitle = page.getByTestId("hero-title");
      await expect(heroTitle).toBeVisible();

      const heroActions = page.getByTestId("hero-actions");
      await expect(heroActions).toBeVisible();

      const featuresSection = page.getByTestId("features-section");
      await expect(featuresSection).toBeVisible();

      const ctaSection = page.getByTestId("cta-section");
      await expect(ctaSection).toBeVisible();

      // Hero image should be hidden on mobile
      const heroImage = page.getByTestId("hero-image");
      await expect(heroImage).not.toBeVisible();
    });

    test("should have proper accessibility attributes", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("load");

      // Check that the main title is properly marked as heading
      const heroTitle = page.getByTestId("hero-title");
      await expect(heroTitle).toHaveRole("heading");

      // Check that action buttons are properly labeled
      const browseShiftsButton = page.getByTestId("hero-browse-shifts-button");
      await expect(browseShiftsButton).toBeVisible();
      await expect(browseShiftsButton).toHaveAttribute("href", "/shifts");

      const joinVolunteerButton = page.getByTestId("hero-join-volunteer-button");
      await expect(joinVolunteerButton).toBeVisible();
      await expect(joinVolunteerButton).toHaveAttribute("href", "/register");

      // Check image alt text
      const heroImage = page.getByTestId("hero-image");
      if (await heroImage.isVisible()) {
        await expect(heroImage).toHaveAttribute("alt", /people enjoying meals/i);
      }
    });

    test("should handle loading states gracefully", async ({ page }) => {
      await page.goto("/");

      // Wait for the main content to be visible
      const homePage = page.getByTestId("home-page");
      await expect(homePage).toBeVisible({ timeout: 10000 });

      // Check that no error messages are displayed
      const errorMessage = page.getByText(/error|failed|something went wrong/i);
      await expect(errorMessage).not.toBeVisible();
    });
  });

  test.describe("Authenticated User Experience", () => {
    async function loginAsVolunteer(page: Page) {
      await page.goto("/login");
      await page.waitForLoadState("load");

      const volunteerLoginButton = page.getByRole("button", {
        name: /login as volunteer/i,
      });
      await volunteerLoginButton.waitFor({ state: "visible", timeout: 5000 });
      await volunteerLoginButton.click();

      try {
        await page.waitForURL((url) => !url.pathname.includes("/login"), {
          timeout: 10000,
        });
      } catch (error) {
        console.log("Login may have failed or taken too long");
      }

      await page.waitForLoadState("load");
    }

    async function loginAsAdmin(page: Page) {
      await page.goto("/login");
      await page.waitForLoadState("load");

      const adminLoginButton = page.getByRole("button", {
        name: /login as admin/i,
      });
      await adminLoginButton.waitFor({ state: "visible", timeout: 5000 });
      await adminLoginButton.click();

      try {
        await page.waitForURL((url) => !url.pathname.includes("/login"), {
          timeout: 10000,
        });
      } catch (error) {
        console.log("Login may have failed or taken too long");
      }

      await page.waitForLoadState("load");
    }

    test("should redirect volunteer users to dashboard", async ({ page }) => {
      await loginAsVolunteer(page);

      // Try to navigate to home page
      await page.goto("/");
      await page.waitForLoadState("load");

      // Should be redirected to dashboard
      await expect(page).toHaveURL("/dashboard");
    });

    test("should redirect admin users to admin dashboard", async ({ page }) => {
      await loginAsAdmin(page);

      // Try to navigate to home page
      await page.goto("/");
      await page.waitForLoadState("load");

      // Should be redirected to admin dashboard
      await expect(page).toHaveURL("/admin");
    });

    test("should handle redirect on direct home page access for authenticated users", async ({ page }) => {
      await loginAsVolunteer(page);

      // Navigate directly to home page multiple times
      for (let i = 0; i < 3; i++) {
        await page.goto("/");
        await page.waitForLoadState("load");
        await expect(page).toHaveURL("/dashboard");
      }
    });
  });
});