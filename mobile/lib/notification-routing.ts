import { router } from "expo-router";
import {
  openBrowserAsync,
  WebBrowserPresentationStyle,
} from "expo-web-browser";

import { usePendingFeedItemStore } from "@/hooks/use-pending-feed-item";
import { API_URL } from "./api";

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

  // /help/team -> volunteer ↔ team direct-message thread on the help tab
  if (pathname === "/help/team") {
    router.push("/help/team");
    return;
  }

  // /surveys/:token -> open the web survey page in an in-app browser.
  // Surveys aren't implemented natively on mobile, so we hand off to the
  // web experience rather than no-op.
  if (pathname.startsWith("/surveys/")) {
    openBrowserAsync(`${API_URL}${actionUrl}`, {
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

  // Admin: a pending-signup notification links to /admin/shifts/:id on web.
  // Mobile has no per-shift admin page, so route to the approvals queue where
  // the signup can actually be actioned.
  if (
    pathname === "/admin/approvals" ||
    pathname.startsWith("/admin/shifts/")
  ) {
    router.push("/admin/approvals");
    return;
  }

  // Admin: a new-message push links to the admin inbox.
  if (pathname === "/admin/messages" || pathname.startsWith("/admin/messages")) {
    router.push("/admin/messages");
    return;
  }

  // /shifts or /shifts/mine -> shifts tab
  if (pathname === "/shifts" || pathname.startsWith("/shifts/")) {
    router.push("/(tabs)/shifts");
    return;
  }

  // Friend notifications — both flow to the unified /user/:id screen.
  // FRIEND_REQUEST_ACCEPTED uses /friends/:userId (renders the full view).
  // FRIEND_REQUEST_RECEIVED uses /friends?fromUserId=:userId (renders the
  // trimmed view with the accept/decline action).
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
