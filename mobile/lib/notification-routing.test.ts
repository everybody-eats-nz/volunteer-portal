import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { navigateToNotificationTarget } from "@/lib/notification-routing";

// `vi.mock` is hoisted above the import, so the module under test resolves
// these stubs instead of the real expo-router / web-browser / store.
const pushMock = vi.fn();
const setPendingIdMock = vi.fn();
const openBrowserMock = vi.fn();

vi.mock("expo-router", () => ({ router: { push: (...args: unknown[]) => pushMock(...args) } }));
vi.mock("expo-web-browser", () => ({
  openBrowserAsync: (...args: unknown[]) => openBrowserMock(...args),
  WebBrowserPresentationStyle: { AUTOMATIC: "AUTOMATIC" },
}));
vi.mock("@/hooks/use-pending-feed-item", () => ({
  usePendingFeedItemStore: {
    getState: () => ({ setPendingId: setPendingIdMock }),
  },
}));
vi.mock("@/lib/api", () => ({ API_URL: "https://volunteers.everybodyeats.nz" }));

describe("navigateToNotificationTarget", () => {
  beforeEach(() => {
    // Silence the module's debug logging during the run.
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("shifts", () => {
    it("routes a single-shift shortage link to the shift detail modal", () => {
      navigateToNotificationTarget("/shifts/clxyz123");
      expect(pushMock).toHaveBeenCalledWith({
        pathname: "/shift/[id]",
        params: { id: "clxyz123" },
      });
    });

    // Regression: a multi-shift shortage notification deep-links to
    // /shifts/details, which previously matched the generic /shifts/:id regex
    // and opened the detail modal for a shift literally named "details",
    // 404ing with "Shift not found".
    it("routes a multi-shift shortage link to the shifts tab, not a shift id", () => {
      navigateToNotificationTarget("/shifts/details?date=2026-06-30");
      expect(pushMock).toHaveBeenCalledWith({
        pathname: "/(tabs)/shifts",
        params: { date: "2026-06-30" },
      });
      expect(pushMock).not.toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/shift/[id]" })
      );
    });

    // The backend may append &location=... (see send-shortage/route.ts), but
    // the mobile shifts tab applies the user's own location filter, so only
    // the date is forwarded. This documents that intentional drop.
    it("forwards only the date (not location) for /shifts/details", () => {
      navigateToNotificationTarget("/shifts/details?date=2026-06-30&location=Wellington");
      expect(pushMock).toHaveBeenCalledWith({
        pathname: "/(tabs)/shifts",
        params: { date: "2026-06-30" },
      });
    });

    it("falls back to the shifts tab when /shifts/details carries no date", () => {
      navigateToNotificationTarget("/shifts/details");
      expect(pushMock).toHaveBeenCalledWith("/(tabs)/shifts");
    });

    it("treats /shifts/mine as the shifts tab, not a shift id", () => {
      navigateToNotificationTarget("/shifts/mine");
      expect(pushMock).toHaveBeenCalledWith("/(tabs)/shifts");
      expect(pushMock).not.toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/shift/[id]" })
      );
    });
  });

  describe("other targets", () => {
    it("stashes the feed item id and opens the home tab for /dashboard", () => {
      navigateToNotificationTarget("/dashboard?feedItemId=feed42");
      expect(setPendingIdMock).toHaveBeenCalledWith("feed42");
      expect(pushMock).toHaveBeenCalledWith("/(tabs)");
    });

    it("hands surveys off to the in-app browser", () => {
      navigateToNotificationTarget("/surveys/tok123");
      expect(openBrowserMock).toHaveBeenCalledWith(
        "https://volunteers.everybodyeats.nz/surveys/tok123",
        expect.anything()
      );
    });

    it("routes admin shift links to the approvals queue", () => {
      navigateToNotificationTarget("/admin/shifts/abc");
      expect(pushMock).toHaveBeenCalledWith("/admin/approvals");
    });
  });

  describe("safety", () => {
    it("no-ops for non-string input", () => {
      navigateToNotificationTarget(undefined);
      navigateToNotificationTarget(null);
      navigateToNotificationTarget(42);
      expect(pushMock).not.toHaveBeenCalled();
    });

    it("no-ops for non-internal paths", () => {
      navigateToNotificationTarget("https://evil.com/phishing");
      expect(pushMock).not.toHaveBeenCalled();
    });
  });
});
