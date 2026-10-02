import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Colors, FontFamily, Palette, type ThemeColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { KeyboardAwareScroll } from "@/hooks/use-keyboard-aware-scroll";
import {
  ratingPoints,
  ratingRows,
  type SurveyAnswerValue,
  type SurveyQuestion as Question,
} from "@/lib/surveys";

type Theme = {
  colors: ThemeColors;
  isDark: boolean;
};

type QuestionProps = {
  question: Question;
  /** Position in the survey, from 1. */
  number: number;
  total: number;
  value: SurveyAnswerValue | undefined;
  /** Shown under the answer when a required question was skipped. */
  error?: string;
  onChange: (value: SurveyAnswerValue) => void;
  keyboardScroll: KeyboardAwareScroll;
};

/**
 * One survey question and the control that answers it. The answer goes back
 * in the shape the submit route expects for the question's type: text as a
 * string, a single choice as the option's text, several choices as a list, a
 * rating as a number and yes/no as a boolean.
 */
export function SurveyQuestion({
  question,
  number,
  total,
  value,
  error,
  onChange,
  keyboardScroll,
}: QuestionProps) {
  const colorScheme = useColorScheme();
  const theme: Theme = {
    colors: Colors[colorScheme],
    isDark: colorScheme === "dark",
  };
  const { colors } = theme;

  const select = (next: SurveyAnswerValue) => {
    Haptics.selectionAsync();
    onChange(next);
  };

  return (
    <View style={styles.question}>
      <Text style={[styles.kicker, { color: colors.textSecondary }]}>
        {`Question ${number} of ${total}`.toUpperCase()}
      </Text>
      <Text
        style={[styles.prompt, { color: colors.text }]}
        accessibilityRole="header"
        accessibilityLabel={
          question.required ? `${question.text}, required` : question.text
        }
      >
        {question.text}
        {question.required && (
          <Text style={{ color: colors.destructive }}> *</Text>
        )}
      </Text>

      {question.type === "text_short" || question.type === "text_long" ? (
        <TextAnswer
          question={question}
          value={typeof value === "string" ? value : ""}
          hasError={!!error}
          onChange={onChange}
          keyboardScroll={keyboardScroll}
          theme={theme}
        />
      ) : question.type === "multiple_choice_single" ? (
        <View accessibilityRole="radiogroup" style={styles.options}>
          {(question.options ?? []).map((option, index) => (
            <ChoiceRow
              key={`${index}-${option}`}
              label={option}
              kind="radio"
              selected={value === option}
              onPress={() => select(option)}
              theme={theme}
            />
          ))}
        </View>
      ) : question.type === "multiple_choice_multi" ? (
        <MultiChoice
          question={question}
          selected={Array.isArray(value) ? value : []}
          onChange={select}
          theme={theme}
        />
      ) : question.type === "rating_scale" ? (
        <RatingScale
          question={question}
          value={typeof value === "number" ? value : null}
          onChange={select}
          theme={theme}
        />
      ) : question.type === "yes_no" ? (
        <View accessibilityRole="radiogroup" style={styles.yesNo}>
          <ChoiceRow
            label="Yes"
            kind="radio"
            selected={value === true}
            onPress={() => select(true)}
            theme={theme}
            style={styles.yesNoOption}
          />
          <ChoiceRow
            label="No"
            kind="radio"
            selected={value === false}
            onPress={() => select(false)}
            theme={theme}
            style={styles.yesNoOption}
          />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={15} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* ── Text ── */

function TextAnswer({
  question,
  value,
  hasError,
  onChange,
  keyboardScroll,
  theme: { colors, isDark },
}: {
  question: Question;
  value: string;
  hasError: boolean;
  onChange: (value: string) => void;
  keyboardScroll: KeyboardAwareScroll;
  theme: Theme;
}) {
  const multiline = question.type === "text_long";
  // The field and its character count are brought clear of the keyboard
  // together, so the count is never the part left underneath it.
  const fieldRef = useRef<View>(null);
  const reveal = keyboardScroll.inputProps(fieldRef);

  return (
    <View ref={fieldRef} style={styles.textField}>
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          {
            color: colors.text,
            borderColor: hasError ? colors.destructive : colors.border,
            backgroundColor: isDark ? colors.surfaceSunk : colors.card,
          },
        ]}
        value={value}
        onChangeText={onChange}
        onFocus={reveal.onFocus}
        onBlur={reveal.onBlur}
        placeholder={
          question.placeholder ||
          (multiline ? "Share your thoughts..." : "Type your answer...")
        }
        placeholderTextColor={colors.textSecondary}
        maxLength={question.maxLength}
        multiline={multiline}
        // A one-line answer has nothing for Return to do but finish it.
        returnKeyType={multiline ? "default" : "done"}
        textAlignVertical={multiline ? "top" : "center"}
        accessibilityLabel={question.text}
      />
      {question.maxLength ? (
        <Text style={[styles.counter, { color: colors.textSecondary }]}>
          {value.length} / {question.maxLength}
        </Text>
      ) : null}
    </View>
  );
}

/* ── Choices ── */

function MultiChoice({
  question,
  selected,
  onChange,
  theme,
}: {
  question: Question;
  selected: string[];
  onChange: (value: string[]) => void;
  theme: Theme;
}) {
  const options = question.options ?? [];

  const toggle = (option: string) => {
    const next = selected.includes(option)
      ? selected.filter((v) => v !== option)
      : [...selected, option];
    // Kept in the survey's own order, however they were tapped.
    onChange(options.filter((o) => next.includes(o)));
  };

  return (
    <View style={styles.options}>
      <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
        Choose all that apply
      </Text>
      {options.map((option, index) => (
        <ChoiceRow
          key={`${index}-${option}`}
          label={option}
          kind="checkbox"
          selected={selected.includes(option)}
          onPress={() => toggle(option)}
          theme={theme}
        />
      ))}
    </View>
  );
}

function ChoiceRow({
  label,
  kind,
  selected,
  onPress,
  theme: { colors, isDark },
  style,
}: {
  label: string;
  kind: "radio" | "checkbox";
  selected: boolean;
  onPress: () => void;
  theme: Theme;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={kind}
      accessibilityState={
        kind === "radio" ? { selected } : { checked: selected }
      }
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.choice,
        {
          borderColor: selected ? colors.tint : colors.border,
          backgroundColor: selected
            ? colors.primaryLight
            : isDark
              ? colors.surfaceSunk
              : colors.card,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.indicator,
          kind === "radio" ? styles.indicatorRadio : styles.indicatorCheckbox,
          {
            borderColor: selected ? colors.tint : colors.icon,
            backgroundColor: selected ? colors.tint : "transparent",
          },
        ]}
      >
        {selected &&
          (kind === "radio" ? (
            <View
              style={[styles.radioDot, { backgroundColor: onTint(isDark) }]}
            />
          ) : (
            <Ionicons name="checkmark" size={15} color={onTint(isDark)} />
          ))}
      </View>
      <Text
        style={[
          styles.choiceLabel,
          {
            color: colors.text,
            fontFamily: selected ? FontFamily.semiBold : FontFamily.regular,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ── Rating ── */

function RatingScale({
  question,
  value,
  onChange,
  theme: { colors, isDark },
}: {
  question: Question;
  value: number | null;
  onChange: (value: number) => void;
  theme: Theme;
}) {
  const points = ratingPoints(question);
  const rows = ratingRows(points);
  const low = points[0];
  const high = points[points.length - 1];
  const lowLabel = question.minLabel || "Low";
  const highLabel = question.maxLabel || "High";
  // Every row has as many columns as the longest, so a short last row lines
  // up under the one above instead of stretching to fill the width.
  const columns = rows[0].length;

  return (
    <View style={styles.rating}>
      <View accessibilityRole="radiogroup" style={styles.ratingRows}>
        {rows.map((row) => (
          <View key={row[0]} style={styles.ratingRow}>
            {row.map((point) => {
              const selected = value === point;
              return (
                <Pressable
                  key={point}
                  onPress={() => onChange(point)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={
                    point === low
                      ? `${point}, ${lowLabel}`
                      : point === high
                        ? `${point}, ${highLabel}`
                        : `${point}`
                  }
                  style={({ pressed }) => [
                    styles.ratingPoint,
                    {
                      borderColor: selected ? colors.tint : colors.border,
                      backgroundColor: selected
                        ? colors.tint
                        : isDark
                          ? colors.surfaceSunk
                          : colors.card,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.ratingNumber,
                      { color: selected ? onTint(isDark) : colors.text },
                    ]}
                  >
                    {point}
                  </Text>
                </Pressable>
              );
            })}
            {Array.from({ length: columns - row.length }, (_, i) => (
              <View key={`gap-${i}`} style={styles.ratingGap} />
            ))}
          </View>
        ))}
      </View>
      {/* Each end is named with its number: on a scale that wraps onto two
          rows, "left" and "right" no longer say which end is which. */}
      <View style={styles.ratingLabels}>
        <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>
          {low} · {lowLabel}
        </Text>
        <Text
          style={[
            styles.ratingLabel,
            styles.ratingLabelEnd,
            { color: colors.textSecondary },
          ]}
        >
          {high} · {highLabel}
        </Text>
      </View>
    </View>
  );
}

/** Text and glyphs sitting on a `tint` fill. */
function onTint(isDark: boolean): string {
  return isDark ? Palette.forest800 : Palette.cream50;
}

const styles = StyleSheet.create({
  question: {
    gap: 12,
  },
  kicker: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  prompt: {
    fontFamily: FontFamily.semiBold,
    fontSize: 18,
    lineHeight: 25,
    marginTop: -4,
  },
  hint: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },

  // Text
  textField: {
    gap: 6,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 50,
    fontSize: 16,
    fontFamily: FontFamily.regular,
  },
  inputMultiline: {
    minHeight: 120,
    paddingTop: 13,
    lineHeight: 22,
  },
  counter: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },

  // Choices
  options: {
    gap: 8,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  indicator: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  indicatorRadio: {
    borderRadius: 11,
  },
  indicatorCheckbox: {
    borderRadius: 7,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  choiceLabel: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  yesNo: {
    flexDirection: "row",
    gap: 10,
  },
  yesNoOption: {
    flex: 1,
  },

  // Rating
  rating: {
    gap: 10,
  },
  ratingRows: {
    gap: 8,
  },
  ratingRow: {
    flexDirection: "row",
    gap: 8,
  },
  ratingPoint: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingGap: {
    flex: 1,
  },
  ratingNumber: {
    fontFamily: FontFamily.semiBold,
    fontSize: 17,
    fontVariant: ["tabular-nums"],
  },
  ratingLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  ratingLabel: {
    flexShrink: 1,
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  ratingLabelEnd: {
    textAlign: "right",
  },

  // Error
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  errorText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 13.5,
    lineHeight: 18,
  },
});
