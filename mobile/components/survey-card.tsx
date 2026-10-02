import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useSurveyDraftStore } from "@/hooks/use-survey-drafts";
import { questionCountLabel, type PendingSurvey } from "@/lib/surveys";

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
        <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={19}
            color={colors.tint}
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
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {questionCountLabel(survey.questionCount)}
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
          accessibilityLabel={`${action}: ${survey.title}, ${questionCountLabel(survey.questionCount)}`}
        />
        <Pressable
          onPress={onDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Don't ask again about the survey: ${survey.title}`}
          style={({ pressed }) => [
            styles.dismiss,
            { opacity: pressed ? 0.6 : 1 },
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
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  headRow: { flexDirection: "row", gap: 12 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 14,
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
  meta: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  dismiss: {
    minHeight: 40,
    justifyContent: "center",
  },
  dismissText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    textDecorationLine: "underline",
  },
});
