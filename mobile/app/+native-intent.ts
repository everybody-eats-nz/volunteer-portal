import { mapDeepLinkToRoute } from "@/lib/deep-link-routing";

/**
 * Rewrites incoming deep links (iOS Universal Links / Android App Links, plus
 * custom-scheme links) to the matching in-app route before Expo Router
 * navigates. Mapping logic lives in `lib/deep-link-routing.ts` so it can be
 * unit tested. `initial` (whether this is the cold-start link) is part of the
 * Expo Router signature but unused here.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    return mapDeepLinkToRoute(path);
  } catch (error) {
    console.warn("[+native-intent] Failed to map deep link:", path, error);
    return "/";
  }
}
