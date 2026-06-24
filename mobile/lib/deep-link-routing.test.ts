import { describe, expect, it } from "vitest";

import { mapDeepLinkToRoute } from "@/lib/deep-link-routing";

describe("mapDeepLinkToRoute", () => {
  describe("shifts", () => {
    it("maps /shifts/:id to the shift detail route", () => {
      expect(mapDeepLinkToRoute("/shifts/clxyz123")).toBe("/shift/clxyz123");
    });

    it("maps the shifts list to the shifts tab", () => {
      expect(mapDeepLinkToRoute("/shifts")).toBe("/(tabs)/shifts");
    });

    it("treats /shifts/mine as the shifts tab, not a shift id", () => {
      expect(mapDeepLinkToRoute("/shifts/mine")).toBe("/(tabs)/shifts");
    });

    it("treats /shifts/details as the shifts tab, not a shift id", () => {
      expect(mapDeepLinkToRoute("/shifts/details")).toBe("/(tabs)/shifts");
    });
  });

  describe("dashboard", () => {
    it("maps /dashboard to the home tab", () => {
      expect(mapDeepLinkToRoute("/dashboard")).toBe("/(tabs)");
    });

    it("keeps the home tab when /dashboard carries a query string", () => {
      expect(mapDeepLinkToRoute("/dashboard?feedItemId=abc")).toBe("/(tabs)");
    });
  });

  describe("friends", () => {
    it("maps /friends/:id to the unified user profile screen", () => {
      expect(mapDeepLinkToRoute("/friends/u42")).toBe("/user/u42");
    });

    it("maps /friends?fromUserId=:id to that user's profile", () => {
      expect(mapDeepLinkToRoute("/friends?fromUserId=u99")).toBe("/user/u99");
    });

    it("maps the bare friends list to the profile tab", () => {
      expect(mapDeepLinkToRoute("/friends")).toBe("/(tabs)/profile");
    });
  });

  describe("profile & achievements", () => {
    it("maps /profile to the profile tab", () => {
      expect(mapDeepLinkToRoute("/profile")).toBe("/(tabs)/profile");
    });

    it("maps /profile sub-pages to the profile tab", () => {
      expect(mapDeepLinkToRoute("/profile/edit")).toBe("/(tabs)/profile");
    });

    it("maps /achievements to the profile tab", () => {
      expect(mapDeepLinkToRoute("/achievements")).toBe("/(tabs)/profile");
    });
  });

  describe("full URLs", () => {
    it("normalises a https universal link on our domain", () => {
      expect(
        mapDeepLinkToRoute("https://volunteers.everybodyeats.nz/shifts/789")
      ).toBe("/shift/789");
    });

    it("reads query params from a full URL", () => {
      expect(
        mapDeepLinkToRoute(
          "https://volunteers.everybodyeats.nz/friends?fromUserId=u7"
        )
      ).toBe("/user/u7");
    });
  });

  describe("passthrough & safety", () => {
    it("passes custom-scheme OAuth redirects through untouched", () => {
      expect(mapDeepLinkToRoute("com.everybodyeats.app://oauthredirect")).toBe(
        "com.everybodyeats.app://oauthredirect"
      );
    });

    it("passes the app's own scheme links through untouched", () => {
      expect(mapDeepLinkToRoute("everybody-eats://oauthredirect")).toBe(
        "everybody-eats://oauthredirect"
      );
    });

    it("returns an unrecognised internal path unchanged", () => {
      expect(mapDeepLinkToRoute("/something-else")).toBe("/something-else");
    });

    it("never navigates to an external host from a http link", () => {
      const result = mapDeepLinkToRoute("https://evil.com/phishing");
      expect(result).toBe("/");
      expect(result).not.toContain("evil.com");
    });

    it("does not leak an embedded absolute URL as the destination", () => {
      const result = mapDeepLinkToRoute(
        "https://volunteers.everybodyeats.nz/https://evil.com"
      );
      // Stays internal: never returns the embedded http(s) URL itself.
      expect(result.startsWith("/")).toBe(true);
      expect(result).not.toMatch(/^https?:/);
    });
  });
});
