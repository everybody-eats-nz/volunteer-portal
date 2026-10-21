import { Ionicons } from "@expo/vector-icons";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Colors, FontFamily, Radius, Tones } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSurveyDraftStore } from "@/hooks/use-survey-drafts";
import type { PendingSurvey } from "@/lib/surveys";

/**
 * "We'd love your feedback."
 *
 * A survey the team has asked this volunteer to fill in, on the home tab.
 * Mobile twin of the web dashboard's survey banner: for volunteers who only
 * use the app this card, and the push notification that came with the survey,
 * are the only places they will ever see it.
 */
export function SurveyCard({
  survey,
  onTake,
  onDismiss,
}: {
  survey: PendingSurvey;
  onTake: () => void;
  /** "Don't ask again": the survey stays reachable from its notification. */
  onDismiss: () => void;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const forestTone = Tones[colorScheme].forest;
  // Answers they have already given are kept for this session, so say so.
  const started = useSurveyDraftStore(
    (state) => state.drafts[survey.token] !== undefined
  );
  const action = started ? "Continue the survey" : "Take the survey";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceSoft, borderColor: colors.border },
      ]}
    >
      <View style={styles.headRow}>
        <View style={[styles.badge, { backgroundColor: forestTone.bg }]}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={19}
            color={forestTone.fg}
          />
        </View>
        <View style={styles.headText}>
          <Eyebrow>We&apos;d love your feedback</Eyebrow>
          <Text
            style={[styles.title, { color: colors.text }]}
            accessibilityRole="header"
          >
            {survey.title}
          </Text>
        </View>
      </View>

      {survey.description ? (
        <Text
          style={[styles.body, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {survey.description}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={action}
          icon="arrow-forward"
          size="sm"
          onPress={onTake}
          accessibilityLabel={`${action}: ${survey.title}`}
        />
        <Pressable
          onPress={onDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Don't ask again about the survey: ${survey.title}`}
          android_ripple={{
            color:
              colorScheme === "dark"
                ? "rgba(253,248,239,0.12)"
                : "rgba(29,83,55,0.12)",
            borderless: true,
          }}
          style={({ pressed }) => [
            styles.dismiss,
            { opacity: pressed && Platform.OS === "ios" ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.dismissText, { color: colors.textSecondary }]}>
            Don&apos;t ask again
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  headRow: { flexDirection: "row", gap: 12 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: Radius.tile,
    alignItems: "center",
    justifyContent: "center",
  },
  headText: { flex: 1, gap: 4 },
  title: {
    fontFamily: FontFamily.displayMedium,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: 12,
    rowGap: 6,
    marginTop: 2,
  },
  dismiss: {
    // 40pt + the 12pt vertical hitSlop clears the 44pt minimum.
    minHeight: 40,
    justifyContent: "center",
  },
  dismissText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
