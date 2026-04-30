import { router } from "expo-router";
import {
  openBrowserAsync,
  WebBrowserPresentationStyle,
} from "expo-web-browser";

import { usePendingFeedItemStore } from "@/hooks/use-pending-feed-item";

const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://volunteers.everybodyeats.nz";

/**
 * Translate a web-app URL (from a notification's actionUrl) to a mobile
 * route and navigate there. Silently no-ops for URLs we don't have a
 * screen for — better than crashing the app on an unmapped path.
 */
export function navigateToNotificationTarget(actionUrl: unknown) {
  console.log("[notification-routing] actionUrl:", actionUrl);
  if (typeof actionUrl !== "string" || !actionUrl.startsWith("/")) return;

  const [pathname, queryString = ""] = actionUrl.split("?");
  const query = new URLSearchParams(queryString);
  console.log(
    "[notification-routing] pathname:",
    pathname,
    "query:",
    queryString
  );

  // /dashboard?feedItemId=... -> home tab + open the feed item sheet for
  // that item. Used for announcement notifications so taps deep-link into
  // the relevant feed card instead of just landing on the home tab.
  if (pathname === "/dashboard") {
    const feedItemId = query.get("feedItemId");
    if (feedItemId) {
      usePendingFeedItemStore.getState().setPendingId(feedItemId);
    }
    router.push("/(tabs)");
    return;
  }

  // /surveys/:token -> open the web survey page in an in-app browser.
  // Surveys aren't implemented natively on mobile, so we hand off to the
  // web experience rather than no-op.
  if (pathname.startsWith("/surveys/")) {
    openBrowserAsync(`${WEB_BASE_URL}${actionUrl}`, {
      presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
    });
    return;
  }

  // /shifts/:id -> shift detail modal
  const shiftDetail = pathname.match(/^\/shifts\/([^/]+)$/);
  if (shiftDetail) {
    router.push({ pathname: "/shift/[id]", params: { id: shiftDetail[1] } });
    return;
  }

  // /shifts or /shifts/mine -> shifts tab
  if (pathname === "/shifts" || pathname.startsWith("/shifts/")) {
    router.push("/(tabs)/shifts");
    return;
  }

  // Friend notifications — navigate to the other user's profile screen.
  // FRIEND_REQUEST_ACCEPTED uses /friends/:userId (they're now a friend).
  // FRIEND_REQUEST_RECEIVED uses /friends?fromUserId=:userId (not a friend
  // yet, so the generic user screen handles the "send request" state).
  const friendProfile = pathname.match(/^\/friends\/([^/]+)$/);
  if (friendProfile) {
    router.push({
      pathname: "/user/[id]",
      params: { id: friendProfile[1] },
    });
    return;
  }
  const fromUserId = query.get("fromUserId");
  if (pathname === "/friends" && fromUserId) {
    router.push({ pathname: "/user/[id]", params: { id: fromUserId } });
    return;
  }

  // /friends* fallback -> profile tab (friends live under profile on mobile)
  if (pathname === "/friends" || pathname.startsWith("/friends/")) {
    router.push("/(tabs)/profile");
    return;
  }

  // /achievements* -> profile tab
  if (pathname.startsWith("/achievements")) {
    router.push("/(tabs)/profile");
    return;
  }
}
