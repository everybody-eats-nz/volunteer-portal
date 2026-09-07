import { router } from "expo-router";

/**
 * Go back, or fall back to the tabs when there is nothing to go back to.
 *
 * Screens above the tab bar are normally pushed onto the stack, so `back()` is
 * the right dismissal. But a deep link or a push-notification tap can open one
 * of them as the first route of a cold start, and there `router.back()`
 * silently does nothing — leaving the volunteer stuck on the screen with a
 * back affordance that appears broken. Replacing with the tabs gets them into
 * the app instead.
 */
export function goBackOrHome() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace("/(tabs)");
}
