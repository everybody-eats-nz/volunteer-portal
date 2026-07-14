import {
  openBrowserAsync,
  WebBrowserPresentationStyle,
} from "expo-web-browser";
import { Linking } from "react-native";

/**
 * Open a link supplied by the marketing CMS. Web URLs open in the in-app
 * browser; plain email addresses (some event "ticket links" are just a
 * contact email) open the mail composer. Bare domains get https:// added.
 */
export async function openCmsLink(raw: string): Promise<void> {
  const value = raw.trim();
  if (!value) return;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    await Linking.openURL(`mailto:${value}`);
    return;
  }
  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  await openBrowserAsync(url, {
    presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
  });
}
