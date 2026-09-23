import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { api, ApiError } from "@/lib/api";

/**
 * "A spot just opened up."
 *
 * A place is being held for this volunteer off the waitlist, and it has a
 * deadline. It sits at the top of the shift screen because the push
 * notification that brought them here deep-links straight to it, and because
 * an offer buried below the fold is an offer that quietly expires.
 */
export function WaitlistOfferCard({
  shiftId,
  deadlineLabel,
  onAnswered,
}: {
  shiftId: string;
  /**
   * How the deadline reads, e.g. "3:34PM today". Formatted server-side in NZ
   * time: working it out from the phone's own clock puts a volunteer who is
   * travelling on the wrong day.
   */
  deadlineLabel: string | null;
  /** Refresh the screen once the answer lands. */
  onAnswered: () => void | Promise<void>;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";

  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(action: "accept" | "decline") {
    setPending(action);
    setError(null);
    try {
      await api(`/api/mobile/shifts/${shiftId}/waitlist-offer`, {
        method: "POST",
        body: { action },
      });
      Haptics.notificationAsync(
        action === "accept"
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );
      await onAnswered();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Something went wrong."
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? "rgba(248,251,105,0.35)" : Brand.green,
        },
      ]}
    >
      <View style={styles.headRow}>
        <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="sparkles" size={15} color={Brand.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>
            A spot just opened up
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {deadlineLabel
              ? `It's yours if you want it - say yes by ${deadlineLabel} and you're confirmed. After that it goes to the next person.`
              : "It's yours if you want it. Say yes and you're confirmed."}
          </Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons
            name="alert-circle-outline"
            size={15}
            color={colors.destructive}
          />
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {error}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={() => respond("decline")}
          disabled={pending !== null}
          accessibilityRole="button"
          accessibilityLabel="Decline this spot"
          accessibilityState={{ disabled: pending !== null }}
          style={({ pressed }) => [
            styles.button,
            styles.secondary,
            { borderColor: isDark ? "rgba(253,248,239,0.22)" : "rgba(29,83,55,0.22)" },
            pressed && { opacity: 0.6 },
            pending !== null && styles.disabled,
          ]}
        >
          {pending === "decline" ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.textSecondary }]}>
              No thanks
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => respond("accept")}
          disabled={pending !== null}
          accessibilityRole="button"
          accessibilityLabel="Accept this spot"
          accessibilityState={{ disabled: pending !== null }}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: Brand.green },
            pressed && { opacity: 0.85 },
            pending !== null && styles.disabled,
          ]}
        >
          {pending === "accept" ? (
            <ActivityIndicator size="small" color={Brand.accent} />
          ) : (
            <Text style={[styles.buttonText, { color: Brand.accent }]}>
              Yes, I&apos;ll take it
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    gap: 14,
  },
  headRow: { flexDirection: "row", gap: 12 },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  title: { fontFamily: FontFamily.headingBold, fontSize: 17, lineHeight: 22 },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 4,
  },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  errorText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: { flexDirection: "row", gap: 10 },
  button: {
    flex: 1,
    // Comfortably past the 44pt minimum: this is a decision with a deadline,
    // not somewhere to make people aim.
    minHeight: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondary: { borderWidth: StyleSheet.hairlineWidth },
  buttonText: { fontFamily: FontFamily.semiBold, fontSize: 15 },
  disabled: { opacity: 0.5 },
});
