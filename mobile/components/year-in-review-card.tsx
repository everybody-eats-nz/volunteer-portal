import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { FontFamily, Palette, Radius } from "@/constants/theme";

/**
 * "Your 2026 in mahi is ready."
 *
 * Home-tab card for the Year in mahi video, shown once an admin has switched
 * it on and the volunteer has a completed shift that year. Mobile twin of the
 * web dashboard banner, in the video's own forest-and-sun colours in both
 * light and dark mode.
 */
export function YearInReviewCard({
  year,
  onWatch,
}: {
  year: number;
  onWatch: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        Your {year} in mahi is ready
      </Text>
      <Text style={styles.body}>
        Your shifts, the meals you helped serve and your crew, made into a
        video to share.
      </Text>
      <Button
        label="Watch it"
        icon="play"
        iconLeading
        variant="accent"
        size="sm"
        onPress={onWatch}
        style={styles.button}
        accessibilityLabel={`Watch your ${year} in mahi`}
        testID="year-in-review-card-watch"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.forest700,
    borderRadius: Radius.card,
    padding: 20,
    gap: 10,
  },
  title: {
    fontFamily: FontFamily.displayMedium,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.4,
    color: Palette.sun200,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(253,248,239,0.82)",
  },
  button: { alignSelf: "flex-start", marginTop: 4 },
});
