import { test, expect } from "./base";
import type { Browser, Page } from "@playwright/test";
import { loginAsAdmin, loginAsVolunteer } from "./helpers/auth";
import {
  createTestUser,
  createShift,
  deleteTestShifts,
  deleteTestUsers,
  getUserByEmail,
  visibleTestId,
} from "./helpers/test-helpers";

/**
 * E2E coverage for the redesigned friend profile page
 * (web/src/app/friends/[friendId]/).
 *
 * The page requires an authenticated volunteer viewing an ACCEPTED friend,
 * so beforeAll seeds a pair of users, an accepted friendship, a shared past
 * shift (which also unlocks achievements for the friend) and an upcoming
 * shift for the friend — all via the test/admin APIs.
 *
 * Serial mode keeps the whole file in one worker so this setup runs exactly
 * once; parallel workers each re-running beforeAll race each other on the
 * admin shift API.
 */
test.describe.configure({ mode: "serial" });

// The page streams its content in via Suspense after several DB queries
const PAGE_LOAD_TIMEOUT = 15000;

const FRIEND_FIRST_NAME = "Aroha";
const FRIEND_LAST_NAME = "Ngata";
const FRIEND_DISPLAY_NAME = `${FRIEND_FIRST_NAME} ${FRIEND_LAST_NAME}`;
const SHIFT_LOCATION = "Wellington";

// Seeded once in beforeAll; unique per run so leftover data from an
// interrupted run can never collide.
let viewerEmail: string;
let friendEmail: string;
let friendId: string;
let achievementId: string | undefined;
let achievementName: string;
let shiftIds: string[] = [];
let upcomingShiftDate: string; // yyyy-MM-dd, NZT

/** Shift starting at 00:30 UTC is 12:30/13:30 NZT — same calendar date in
 * both zones, so the NZT date the page renders equals the UTC date. */
function shiftStartDaysFromNow(days: number): Date {
  const start = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  start.setUTCHours(0, 30, 0, 0);
  return start;
}

async function withPage<T>(
  browser: Browser,
  fn: (page: Page) => Promise<T>
): Promise<T> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    return await fn(page);
  } finally {
    await context.close();
  }
}

test.beforeAll(async ({ browser }, testInfo) => {
  const runId = `w${testInfo.workerIndex}-${Date.now()}`;
  viewerEmail = `friend-profile-viewer-${runId}@example.com`;
  friendEmail = `friend-profile-friend-${runId}@example.com`;
  achievementName = `E2E Friend Profile Star ${runId}`;

  await withPage(browser, async (page) => {
    await createTestUser(page, viewerEmail, "VOLUNTEER", {
      firstName: "Manaia",
      lastName: "Viewer",
    });
    await createTestUser(page, friendEmail, "VOLUNTEER", {
      firstName: FRIEND_FIRST_NAME,
      lastName: FRIEND_LAST_NAME,
    });

    const friend = await getUserByEmail(page, friendEmail);
    const viewer = await getUserByEmail(page, viewerEmail);
    if (!friend || !viewer) {
      throw new Error("Failed to look up seeded test users");
    }
    friendId = friend.id;

    // Shifts need an admin session; signups go through the test API.
    await loginAsAdmin(page);

    const pastStart = shiftStartDaysFromNow(-7);
    const upcomingStart = shiftStartDaysFromNow(7);
    upcomingShiftDate = upcomingStart.toISOString().slice(0, 10);

    const pastShift = await createShift(page, {
      location: SHIFT_LOCATION,
      start: pastStart,
      capacity: 4,
    });
    const upcomingShift = await createShift(page, {
      location: SHIFT_LOCATION,
      start: upcomingStart,
      capacity: 4,
    });
    shiftIds = [pastShift.id, upcomingShift.id];

    // Shared past shift (both volunteers) + an upcoming shift for the friend.
    for (const signup of [
      { userId: viewer.id, shiftId: pastShift.id },
      { userId: friend.id, shiftId: pastShift.id },
      { userId: friend.id, shiftId: upcomingShift.id },
    ]) {
      const response = await page.request.post("/api/test/signups", {
        data: { ...signup, status: "CONFIRMED" },
      });
      if (!response.ok()) {
        throw new Error(`Failed to create signup: ${await response.text()}`);
      }
    }

    // A dedicated achievement the friend is guaranteed to unlock (one
    // completed shift), so the test doesn't depend on seeded definitions.
    const achievementResponse = await page.request.post(
      "/api/admin/achievements",
      {
        data: {
          name: achievementName,
          description: "Complete a volunteer shift (e2e seed)",
          category: "MILESTONE",
          icon: "🌟",
          criteria: JSON.stringify({ type: "shifts_completed", value: 1 }),
          points: 15,
          isActive: true,
        },
      }
    );
    if (!achievementResponse.ok()) {
      throw new Error(
        `Failed to create achievement: ${await achievementResponse.text()}`
      );
    }
    achievementId = (await achievementResponse.json()).id;

    // Establish the ACCEPTED friendship through the real friends API.
    await loginAsVolunteer(page, viewerEmail);
    const requestResponse = await page.request.post("/api/friends", {
      data: { email: friendEmail, message: "Kia ora, let's volunteer!" },
    });
    if (!requestResponse.ok()) {
      throw new Error(
        `Failed to send friend request: ${await requestResponse.text()}`
      );
    }

    await loginAsVolunteer(page, friendEmail);
    const friendsResponse = await page.request.get("/api/friends");
    const { pendingRequests } = await friendsResponse.json();
    const pendingRequest = pendingRequests.find(
      (request: { id: string; fromUser: { email: string } }) =>
        request.fromUser.email === viewerEmail
    );
    if (!pendingRequest) {
      throw new Error("Friend request from viewer not found");
    }
    const acceptResponse = await page.request.post(
      `/api/friends/requests/${pendingRequest.id}/accept`
    );
    if (!acceptResponse.ok()) {
      throw new Error(
        `Failed to accept friend request: ${await acceptResponse.text()}`
      );
    }

    // Unlock the friend's achievements based on their completed shift.
    const unlockResponse = await page.request.post("/api/achievements");
    if (!unlockResponse.ok()) {
      throw new Error(
        `Failed to unlock achievements: ${await unlockResponse.text()}`
      );
    }
  });
});

test.afterAll(async ({ browser }) => {
  await withPage(browser, async (page) => {
    await loginAsAdmin(page);
    await deleteTestUsers(page, [viewerEmail, friendEmail]);
    await deleteTestShifts(page, shiftIds);
    if (achievementId) {
      const deleteResponse = await page.request.delete(
        `/api/admin/achievements/${achievementId}`
      );
      if (!deleteResponse.ok()) {
        console.warn(
          `Failed to delete achievement ${achievementId}: ${await deleteResponse.text()}`
        );
      }
    }
  });
});

test.describe("Friend Profile Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsVolunteer(page, viewerEmail);
    await page.goto(`/friends/${friendId}`);
  });

  test("renders the hero with the friend's name", async ({ page }) => {
    const hero = visibleTestId(page, "friend-profile-hero");
    await expect(hero).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });
    await expect(hero).toContainText(FRIEND_DISPLAY_NAME);
    // Friendship context is part of the hero band
    await expect(hero).toContainText("Connected since");
  });

  test("renders the together bento stats", async ({ page }) => {
    const statsGrid = visibleTestId(page, "friend-stats-grid");
    await expect(statsGrid).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });

    // Scope to the grid: a "shared-shifts" testid also exists on the
    // shared-shifts timeline section further down the page.
    const sharedShifts = statsGrid.getByTestId("shared-shifts");
    await expect(sharedShifts).toContainText("Shifts together");
    // Both volunteers were signed up for the same past shift
    await expect(sharedShifts).toContainText("1");

    const mutualFriends = statsGrid.getByTestId("mutual-friends");
    await expect(mutualFriends).toContainText("Mutual friends");
    // Fresh users share no other friends
    await expect(mutualFriends).toContainText("0");
  });

  test("renders achievements with the latest unlock featured", async ({
    page,
  }) => {
    const achievements = visibleTestId(page, "friend-achievements");
    await expect(achievements).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });

    // The friend has UserAchievement rows, so the featured card renders
    // instead of the empty state.
    await expect(achievements).toContainText("Latest unlock");
    // The dedicated e2e achievement was unlocked by the friend's completed
    // shift — it appears either as the featured card or on the shelf.
    await expect(achievements).toContainText(achievementName);
  });

  test("links an upcoming shift row to the shift details page", async ({
    page,
  }) => {
    const upcomingShifts = visibleTestId(page, "upcoming-shifts");
    await expect(upcomingShifts).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });

    const expectedHref = `/shifts/details?date=${upcomingShiftDate}&location=${encodeURIComponent(
      SHIFT_LOCATION
    )}`;
    const shiftLink = upcomingShifts.locator(
      `a[href="${expectedHref}"]`
    );
    await expect(shiftLink).toBeVisible();
    await expect(shiftLink).toContainText(SHIFT_LOCATION);

    await shiftLink.click();
    await page.waitForURL(`**/shifts/details?*`);
    expect(page.url()).toContain(`date=${upcomingShiftDate}`);
    expect(page.url()).toContain(`location=${SHIFT_LOCATION}`);
  });
});
