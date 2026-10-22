import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Colors, MaxFontScale } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { LoadErrorKind } from "@/lib/load-error";

type IconName = keyof typeof Ionicons.glyphMap;

type Action = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  loading?: boolean;
};

type StateViewProps = {
  title: string;
  body?: ReactNode;
  /** An Ionicon in a soft round well. Ignored when `emoji` is set. */
  icon?: IconName;
  /** A warm emoji instead of an icon (empty lists, quiet days). */
  emoji?: string;
  action?: Action;
  /** A quieter second action, shown as a ghost button. */
  secondaryAction?: Action;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The centred message a screen shows instead of content: nothing here yet,
 * or something went wrong. Prefer `EmptyState` / `ErrorState` below.
 */
export function StateView({
  title,
  body,
  icon,
  emoji,
  action,
  secondaryAction,
  style,
  testID,
}: StateViewProps) {
  const colors = Colors[useColorScheme()];

  return (
    <View style={[styles.container, style]} testID={testID}>
      {emoji ? (
        <Text
          style={styles.emoji}
          maxFontSizeMultiplier={MaxFontScale.compact}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {emoji}
        </Text>
      ) : icon ? (
        <View
          style={[styles.iconWell, { backgroundColor: colors.surfaceSoft }]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          <Ionicons name={icon} size={30} color={colors.textSecondary} />
        </View>
      ) : null}
      <ThemedText type="subtitle" style={styles.title} accessibilityRole="header">
        {title}
      </ThemedText>
      {body ? (
        <ThemedText type="caption" style={[styles.body, { color: colors.textSecondary }]}>
          {body}
        </ThemedText>
      ) : null}
      {action || secondaryAction ? (
        <View style={styles.actions}>
          {action ? (
            <Button
              label={action.label}
              icon={action.icon}
              iconLeading
              loading={action.loading}
              onPress={action.onPress}
            />
          ) : null}
          {secondaryAction ? (
            <Button
              label={secondaryAction.label}
              icon={secondaryAction.icon}
              iconLeading
              variant="ghost"
              loading={secondaryAction.loading}
              onPress={secondaryAction.onPress}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Nothing to show yet. Say what would appear here, and offer the next step. */
export function EmptyState(props: StateViewProps) {
  return <StateView {...props} />;
}

const ERROR_COPY: Record<Exclude<LoadErrorKind, "not-found">, { title: string; body: string; icon: IconName }> = {
  offline: {
    title: "You're offline",
    body: "Check your connection, then try again.",
    icon: "cloud-offline-outline",
  },
  error: {
    title: "Couldn't load this",
    body: "Something went wrong on our side. Try again in a moment.",
    icon: "alert-circle-outline",
  },
};

/**
 * Loading failed. Always offers "Try again"; pass `kind` from `loadErrorKind`
 * so an offline phone is told to check its connection rather than blamed on
 * the server. Not-found is not an error state: use `EmptyState` with a way back.
 */
export function ErrorState({
  kind = "error",
  title,
  body,
  onRetry,
  retrying,
  secondaryAction,
  style,
  testID,
}: {
  kind?: Exclude<LoadErrorKind, "not-found">;
  title?: string;
  body?: ReactNode;
  onRetry: () => void;
  retrying?: boolean;
  secondaryAction?: Action;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const copy = ERROR_COPY[kind];
  return (
    <StateView
      icon={copy.icon}
      title={title ?? copy.title}
      body={body ?? copy.body}
      action={{ label: "Try again", icon: "refresh", onPress: onRetry, loading: retrying }}
      secondaryAction={secondaryAction}
      style={style}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  iconWell: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emoji: {
    fontSize: 40,
    lineHeight: 48,
    marginBottom: 10,
  },
  title: {
    textAlign: "center",
  },
  body: {
    textAlign: "center",
    marginTop: 6,
    maxWidth: 320,
  },
  actions: {
    marginTop: 20,
    alignItems: "center",
    gap: 10,
  },
});
