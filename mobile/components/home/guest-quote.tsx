import { StyleSheet, Text, View } from "react-native";

import { Colors, FontFamily } from "@/constants/theme";
import type { DinerFeedbackNote } from "@/lib/dummy-data";

/**
 * A guest's pay-at-table note, set as a quiet pull quote. Only positive,
 * consented notes ever reach the app (the marketing CMS gates publication),
 * so they are always safe to show.
 *
 * `preview` is the feed row: one clamped note behind a hairline rule, with
 * the rest counted in the byline. The detail sheet shows each note in full.
 */
export function GuestQuote({
  note,
  colors,
  preview = false,
  moreCount = 0,
}: {
  note: DinerFeedbackNote;
  colors: (typeof Colors)["light"];
  preview?: boolean;
  /** Further notes from the same night, counted in the preview byline. */
  moreCount?: number;
}) {
  const name = note.name?.trim() || "A guest";
  const more =
    moreCount > 0 ? ` · ${moreCount} more ${moreCount === 1 ? "note" : "notes"}` : "";
  return (
    <View
      style={[
        styles.guestQuote,
        preview && [styles.guestQuotePreview, { borderLeftColor: colors.border }],
      ]}
    >
      <Text
        style={[
          styles.guestQuoteText,
          preview && styles.guestQuoteTextPreview,
          { color: colors.text },
        ]}
        numberOfLines={preview ? 3 : undefined}
      >
        “{note.message}”
      </Text>
      <Text
        style={[styles.guestQuoteByline, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        {name}
        {more}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  guestQuote: {
    gap: 6,
  },
  guestQuotePreview: {
    marginTop: 6,
    marginBottom: 2,
    paddingLeft: 12,
    borderLeftWidth: 2,
    gap: 4,
  },
  guestQuoteText: {
    fontSize: 18,
    lineHeight: 26,
    fontFamily: FontFamily.displayItalic,
  },
  guestQuoteTextPreview: {
    fontSize: 16,
    lineHeight: 23,
  },
  guestQuoteByline: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
  },
});
