import {
  openBrowserAsync,
  WebBrowserPresentationStyle,
} from "expo-web-browser";
import { Linking } from "react-native";

/** Schemes we hand to the OS rather than opening in the in-app browser. */
const HANDOFF_SCHEME = /^(mailto|tel|sms):/i;

const BARE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HTTP_SCHEME = /^https?:\/\//i;

const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Open a link that came from content rather than from our own routes:
 * marketing CMS events, journal posts, and links inside announcement bodies.
 *
 * Web URLs open in the in-app browser. Mail and phone links hand off to the
 * system, as do plain email addresses (some event "ticket links" are just a
 * contact email). Bare domains get https:// added. Any other scheme is
 * ignored, so a pasted `javascript:` or app-scheme URL can't be launched out
 * of user-authored copy.
 */
export async function openExternalLink(raw: string): Promise<void> {
  const value = raw.trim();
  if (!value) return;
  if (HANDOFF_SCHEME.test(value)) {
    await Linking.openURL(value);
    return;
  }
  if (BARE_EMAIL.test(value)) {
    await Linking.openURL(`mailto:${value}`);
    return;
  }
  if (ANY_SCHEME.test(value) && !HTTP_SCHEME.test(value)) return;
  const url = HTTP_SCHEME.test(value) ? value : `https://${value}`;
  await openBrowserAsync(url, {
    presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
  });
}
