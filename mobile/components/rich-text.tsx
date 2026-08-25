import type { ComponentProps } from "react";
import Markdown, { MarkdownIt } from "react-native-markdown-display";

import { openExternalLink } from "@/lib/external-links";

/**
 * Markdown parser shared by every piece of authored copy in the app.
 *
 * `linkify` is the point: announcements, menu notes and captions are typed
 * into a plain textarea, so people paste bare URLs and email addresses rather
 * than markdown link syntax. markdown-it turns those into real links, so a
 * volunteer can tap through without an admin knowing `[text](url)`.
 */
const parser = MarkdownIt({ typographer: true, linkify: true });

/** Open taps ourselves (in-app browser) instead of the library's `Linking`. */
const handleLinkPress = (url: string) => {
  void openExternalLink(url);
  return false;
};

type MarkdownStyle = ComponentProps<typeof Markdown>["style"];

/**
 * Authored copy: markdown where it's used, tappable links either way.
 */
export function RichText({
  children,
  style,
}: {
  children: string;
  style?: MarkdownStyle;
}) {
  return (
    <Markdown markdownit={parser} onLinkPress={handleLinkPress} style={style}>
      {children}
    </Markdown>
  );
}
