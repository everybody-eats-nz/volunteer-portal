import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Brand, Colors, FontFamily, Radius, Tones } from "@/constants/theme";
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
  const forestTone = Tones[colorScheme].forest;

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
        <View style={[styles.badge, { backgroundColor: forestTone.bg }]}>
          <Ionicons name="sparkles" size={15} color={forestTone.fg} />
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
        <Button
          label="No thanks"
          variant="ghost"
          onPress={() => respond("decline")}
          loading={pending === "decline"}
          disabled={pending !== null}
          accessibilityLabel="Decline this spot"
          style={styles.button}
        />
        <Button
          label="Yes, I'll take it"
          onPress={() => respond("accept")}
          loading={pending === "accept"}
          disabled={pending !== null}
          accessibilityLabel="Accept this spot"
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
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
    fontSize: 14,
    lineHeight: 20,
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
  // md draws at 48pt, comfortably past the 44pt minimum: this is a decision
  // with a deadline, not somewhere to make people aim. Both stretch to the
  // taller one when a label wraps at large text sizes.
  button: { flex: 1, alignSelf: "stretch", paddingHorizontal: 14 },
});
