import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SurveyQuestion } from "@/components/survey-question";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Colors, FontFamily, Palette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useKeyboardAwareScroll } from "@/hooks/use-keyboard-aware-scroll";
import { useSurveyDraftStore } from "@/hooks/use-survey-drafts";
import { useSubmitSurvey, useSurvey } from "@/hooks/use-surveys";
import { ApiError } from "@/lib/api";
import { goBackOrHome } from "@/lib/navigation";
import { posthog } from "@/lib/posthog";
import { surveyProblem } from "@/lib/survey-problem";
import {
  countAnswered,
  toSubmission,
  validateAnswers,
  type SurveyAnswers,
  type SurveyAnswerValue,
} from "@/lib/surveys";

/** Shared by every survey with no answers yet, so the selector stays stable. */
const NO_ANSWERS: SurveyAnswers = {};

/**
 * A survey, answered in the app.
 *
 * Reached from the home tab's survey card or from the survey's notification,
 * both of which carry the token. The token is the whole credential, exactly
 * as on the web page behind the emailed link, so this screen loads and submits
 * through the same public routes that page uses.
 */
export default function SurveyScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token: string }>();
  const token = typeof tokenParam === "string" ? tokenParam : "";

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const query = useSurvey(token);
  const submit = useSubmitSurvey(token);
  const answers =
    useSurveyDraftStore((state) => state.drafts[token]) ?? NO_ANSWERS;
  const setAnswer = useSurveyDraftStore((state) => state.setAnswer);
  const clearDraft = useSurveyDraftStore((state) => state.clear);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  /** Set when the server says, at submit time, that it was already answered. */
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);

  const keyboardScroll = useKeyboardAwareScroll();
  /** Top of each question within the scroll content, for jumping to an error. */
  const questionTops = useRef<Record<string, number>>({});

  const survey = query.data?.survey;
  const surveyId = survey?.id;
  const questionCount = survey?.questions.length;
  useEffect(() => {
    if (!surveyId) return;
    posthog?.capture("survey_viewed", {
      survey_id: surveyId,
      question_count: questionCount ?? 0,
    });
  }, [surveyId, questionCount]);

  if (submitted) {
    return (
      <Screen>
        <ThankYou />
      </Screen>
    );
  }

  const problem = query.error ? surveyProblem(query.error) : null;

  if (alreadyDone || problem === "completed") {
    return (
      <Screen>
        <Message
          icon="checkmark-done"
          title="Already done"
          body="You've already answered this survey. Ngā mihi for your feedback!"
          action={<Button label="Done" onPress={goBackOrHome} />}
        />
      </Screen>
    );
  }

  if (problem === "unavailable" || token.length === 0) {
    return (
      <Screen>
        <Message
          icon="document-text-outline"
          title="This survey has closed"
          body="It isn't taking answers any more, or the link is out of date. There's nothing you need to do."
          action={<Button label="Done" onPress={goBackOrHome} />}
        />
      </Screen>
    );
  }

  // A failed background refresh doesn't take a loaded survey off the screen.
  if (!survey) {
    return (
      <Screen>
        {query.isError ? (
          <Message
            icon="cloud-offline-outline"
            title="Couldn't load the survey"
            body="Check your connection and try again."
            action={
              <Button
                label="Try again"
                loading={query.isFetching}
                onPress={() => query.refetch()}
              />
            }
          />
        ) : (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </Screen>
    );
  }

  const { questions } = survey;
  const answered = countAnswered(questions, answers);

  const handleChange = (questionId: string, value: SurveyAnswerValue) => {
    setAnswer(token, questionId, value);
    if (errors[questionId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
    if (submitError) setSubmitError(null);
  };

  const handleSubmit = async () => {
    const missing = validateAnswers(questions, answers);
    setErrors(missing);
    setSubmitError(null);

    const firstMissing = questions.find((q) => missing[q.id]);
    if (firstMissing) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const count = Object.keys(missing).length;
      AccessibilityInfo.announceForAccessibility(
        count === 1
          ? "1 question still needs an answer."
          : `${count} questions still need an answer.`
      );
      const top = questionTops.current[firstMissing.id];
      if (top !== undefined) {
        keyboardScroll.scrollProps.ref.current?.scrollTo({
          y: Math.max(0, top - headerHeight - 16),
          animated: true,
        });
      }
      return;
    }

    try {
      await submit.mutateAsync(toSubmission(questions, answers));
    } catch (error) {
      if (surveyProblem(error) === "completed") {
        clearDraft(token);
        setAlreadyDone(true);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSubmitError(
        // A 400 is the server naming the answer it wouldn't take.
        error instanceof ApiError && error.status === 400
          ? error.message
          : "Couldn't send your answers. Check your connection and try again."
      );
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    posthog?.capture("survey_submitted", {
      survey_id: survey.id,
      question_count: questions.length,
      answered_count: answered,
    });
    clearDraft(token);
    setSubmitted(true);
  };

  return (
    <Screen>
      <Animated.ScrollView
        {...keyboardScroll.scrollProps}
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + 16, paddingBottom: footerHeight + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Eyebrow>Feedback survey</Eyebrow>
          <ThemedText type="display" accessibilityRole="header">
            {survey.title}
          </ThemedText>
          {survey.description ? (
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {survey.description}
            </Text>
          ) : null}
          {questions.some((q) => q.required) && (
            <Text style={[styles.requiredNote, { color: colors.textSecondary }]}>
              <Text style={{ color: colors.destructive }}>* </Text>
              Required
            </Text>
          )}
        </View>

        {questions.map((question, index) => (
          <View
            key={question.id}
            onLayout={(event: LayoutChangeEvent) => {
              questionTops.current[question.id] = event.nativeEvent.layout.y;
            }}
            style={[styles.questionBlock, { borderTopColor: colors.border }]}
          >
            <SurveyQuestion
              question={question}
              number={index + 1}
              total={questions.length}
              value={answers[question.id]}
              error={errors[question.id]}
              onChange={(value) => handleChange(question.id, value)}
              keyboardScroll={keyboardScroll}
            />
          </View>
        ))}

        <Animated.View style={keyboardScroll.spacerStyle} />
      </Animated.ScrollView>

      <View
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 12) + 4,
          },
        ]}
      >
        {submitError ? (
          <View style={styles.submitError} accessibilityLiveRegion="polite">
            <Ionicons
              name="alert-circle"
              size={16}
              color={colors.destructive}
            />
            <Text
              style={[styles.submitErrorText, { color: colors.destructive }]}
            >
              {submitError}
            </Text>
          </View>
        ) : null}
        <View style={styles.footerRow}>
          <View
            style={styles.progress}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`${answered} of ${questions.length} questions answered`}
            accessibilityValue={{
              min: 0,
              max: questions.length,
              now: answered,
            }}
          >
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              <Text style={[styles.progressCount, { color: colors.text }]}>
                {answered} of {questions.length}
              </Text>{" "}
              answered
            </Text>
            <View
              style={[styles.progressTrack, { backgroundColor: colors.border }]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.tint,
                    width: `${(answered / Math.max(questions.length, 1)) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
          <Button
            label="Submit"
            icon="arrow-forward"
            loading={submit.isPending}
            onPress={handleSubmit}
            accessibilityLabel="Submit survey"
          />
        </View>
      </View>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  return (
    <View
      style={[
        styles.flex,
        { backgroundColor: Colors[colorScheme].background },
      ]}
    >
      {children}
    </View>
  );
}

/** Shown once the answers are in. */
function ThankYou() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <View style={styles.centered}>
      <Animated.View
        entering={FadeIn.duration(250)}
        style={[styles.sunBadge, { backgroundColor: colors.accent }]}
      >
        <Ionicons name="checkmark" size={34} color={colors.onAccent} />
      </Animated.View>
      <Animated.View
        entering={FadeInDown.duration(300).delay(80)}
        style={styles.messageText}
      >
        <ThemedText
          type="displayLarge"
          style={styles.center}
          accessibilityRole="header"
        >
          Ngā mihi <ThemedText type="accent">nui</ThemedText>
        </ThemedText>
        <Text style={[styles.messageBody, { color: colors.textSecondary }]}>
          Your answers are in. They help us make volunteering better for the
          whole whānau.
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(300).delay(160)}>
        <Button label="Done" onPress={goBackOrHome} style={styles.messageAction} />
      </Animated.View>
    </View>
  );
}

/** A survey that can't be answered right now, and what to do about it. */
function Message({
  icon,
  title,
  body,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <View style={styles.centered}>
      <View style={[styles.messageBadge, { backgroundColor: colors.primaryLight }]}>
        <Ionicons name={icon} size={28} color={colors.tint} />
      </View>
      <View style={styles.messageText}>
        <ThemedText
          type="title"
          style={styles.center}
          accessibilityRole="header"
        >
          {title}
        </ThemedText>
        <Text style={[styles.messageBody, { color: colors.textSecondary }]}>
          {body}
        </Text>
      </View>
      <View style={styles.messageAction}>{action}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: "center" },
  content: {
    paddingHorizontal: 20,
  },

  // Intro
  intro: {
    gap: 10,
    paddingBottom: 28,
  },
  description: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  requiredNote: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },

  // Questions
  questionBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 24,
    paddingBottom: 28,
  },

  // Footer
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  progress: {
    flex: 1,
    gap: 7,
  },
  progressText: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  progressCount: {
    fontFamily: FontFamily.semiBold,
    fontVariant: ["tabular-nums"],
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  submitError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },
  submitErrorText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 13.5,
    lineHeight: 18,
  },

  // Thank-you and message states
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 20,
  },
  sunBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    // A soft halo, so the sun reads as glowing rather than as a flat sticker.
    shadowColor: Palette.sun300,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
  },
  messageBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  messageText: {
    alignItems: "center",
    gap: 10,
  },
  messageBody: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  messageAction: {
    alignSelf: "center",
    marginTop: 4,
  },
});
