import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Colors, FontFamily, Radius, Tones } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { api, ApiError } from "@/lib/api";

/**
 * "Keep your waitlist place?"
 *
 * The team put this volunteer on the waitlist; they never chose to wait, so
 * no place is offered to them until they say they want one. Replaces the
 * status panel while it's unanswered, the same way an offer does.
 */
export function WaitlistConfirmCard({
  shiftId,
  onLeave,
  onAnswered,
}: {
  shiftId: string;
  /** The screen's own "leave the waitlist" flow, with its confirm prompt. */
  onLeave: () => void;
  /** Refresh the screen once they've kept the place. */
  onAnswered: () => void | Promise<void>;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const tone = Tones[colorScheme].forest;

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function keep() {
    setPending(true);
    setError(null);
    try {
      await api(`/api/mobile/shifts/${shiftId}/waitlist-confirm`, {
        method: "POST",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await onAnswered();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.headRow}>
        <View style={[styles.badge, { backgroundColor: tone.bg }]}>
          <Ionicons name="hourglass-outline" size={15} color={tone.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>
            Keep your waitlist place?
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            The team has put you on the waitlist for this shift. Keep your
            place and we&apos;ll offer it to you if a spot opens up.
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
          label="Leave"
          variant="ghost"
          onPress={onLeave}
          disabled={pending}
          accessibilityLabel="Leave the waitlist"
          style={styles.button}
        />
        <Button
          label="Keep my place"
          onPress={keep}
          loading={pending}
          disabled={pending}
          accessibilityLabel="Keep my place on the waitlist"
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: 1,
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
  button: { flex: 1, alignSelf: "stretch", paddingHorizontal: 14 },
});
