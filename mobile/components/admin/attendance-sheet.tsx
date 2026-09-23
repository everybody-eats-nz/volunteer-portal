import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMarkAttendance } from "@/hooks/use-admin";
import { formatTimeRange, initialOf } from "@/lib/admin-format";
import type { TodayShift, TodayShiftSignup } from "@/lib/admin";

/**
 * Taking attendance on the floor during service.
 *
 * Admins told us they were marking no-shows from memory the next day, because
 * the portal only let them record attendance once a shift had finished. This
 * sheet is the mid-service surface: the confirmed roster, one row each, with
 * a single tap to flip someone between here and no-show. Rows are full-width
 * and 56pt tall because the person using this is standing in a busy kitchen.
 */
export function AttendanceSheet({
  visible,
  onClose,
  shift,
  date,
  location,
}: {
  visible: boolean;
  onClose: () => void;
  shift: TodayShift;
  /** Query scope, so the mutation can refresh the right day's roster. */
  date: string;
  location: string | null;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const { mark, pendingSignupId } = useMarkAttendance(date, location);
  const [error, setError] = useState<string | null>(null);

  // Attendance only means something for people who were actually expected.
  // Pending and waitlisted volunteers have no place to not turn up to.
  const roster = shift.signups.filter(
    (s) => s.status === "CONFIRMED" || s.status === "NO_SHOW"
  );
  const noShowCount = roster.filter((s) => s.status === "NO_SHOW").length;

  const handleToggle = useCallback(
    (signup: TodayShiftSignup) => {
      const nowAbsent = signup.status === "CONFIRMED";
      Haptics.impactAsync(
        nowAbsent
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light
      );
      setError(null);
      mark(
        { signupId: signup.id, action: nowAbsent ? "mark_absent" : "mark_present" },
        {
          onError: (e: unknown) =>
            setError(
              e instanceof Error
                ? e.message
                : "Couldn't save that. Please try again."
            ),
        }
      );
    },
    [mark]
  );

  const rule = isDark ? "rgba(253,248,239,0.12)" : "rgba(29,83,55,0.14)";

  return (
    <Modal
      visible={visible}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={styles.handleWrap}>
          <View
            style={[
              styles.handleBar,
              {
                backgroundColor: isDark
                  ? "rgba(253,248,239,0.22)"
                  : "rgba(29,83,55,0.18)",
              },
            ]}
          />
        </View>

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>
              Attendance
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {shift.shiftTypeName} · {formatTimeRange(shift.start, shift.end)}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close attendance"
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: isDark
                  ? "rgba(253,248,239,0.08)"
                  : colors.surfaceSunk,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.surfaceSunk }]}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={colors.destructive}
            />
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {error}
            </Text>
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {roster.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🍽️</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Nobody confirmed yet
              </Text>
              <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                Attendance opens up once volunteers are confirmed for this
                shift.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                Tap a name to mark them as a no-show. Tap again if they turn up
                late.
              </Text>

              <View style={[styles.list, { borderColor: rule }]}>
                {roster.map((s, i) => {
                  const absent = s.status === "NO_SHOW";
                  const saving = pendingSignupId === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => handleToggle(s)}
                      disabled={saving}
                      accessibilityRole="button"
                      accessibilityState={{ selected: absent, disabled: saving }}
                      accessibilityLabel={
                        absent
                          ? `${s.volunteer.name}, marked as no show. Tap to mark present.`
                          : `${s.volunteer.name}, present. Tap to mark as no show.`
                      }
                      style={({ pressed }) => [
                        styles.row,
                        i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: rule },
                        pressed && { backgroundColor: colors.surfaceSunk },
                      ]}
                    >
                      {s.volunteer.profilePhotoUrl ? (
                        <Image
                          source={{ uri: s.volunteer.profilePhotoUrl }}
                          style={[styles.avatar, absent && styles.avatarAbsent]}
                        />
                      ) : (
                        <View
                          style={[
                            styles.avatar,
                            styles.avatarFallback,
                            { backgroundColor: colors.primaryLight },
                            absent && styles.avatarAbsent,
                          ]}
                        >
                          <Text style={[styles.initial, { color: Brand.green }]}>
                            {initialOf(s.volunteer.name)}
                          </Text>
                        </View>
                      )}

                      <Text
                        style={[
                          styles.name,
                          { color: absent ? colors.textSecondary : colors.text },
                          absent && styles.nameAbsent,
                        ]}
                        numberOfLines={1}
                      >
                        {s.volunteer.name}
                      </Text>

                      {saving ? (
                        <ActivityIndicator size="small" color={Brand.green} />
                      ) : (
                        // Status is spelled out as well as coloured - a red dot
                        // alone doesn't survive colour blindness or a glance.
                        <View
                          style={[
                            styles.statusChip,
                            {
                              backgroundColor: absent
                                ? isDark
                                  ? "rgba(248,113,113,0.16)"
                                  : "rgba(194,65,12,0.12)"
                                : colors.primaryLight,
                            },
                          ]}
                        >
                          <Ionicons
                            name={absent ? "close-circle" : "checkmark-circle"}
                            size={14}
                            color={absent ? colors.destructive : Brand.green}
                          />
                          <Text
                            style={[
                              styles.statusChipText,
                              {
                                color: absent
                                  ? colors.destructive
                                  : Brand.green,
                              },
                            ]}
                          >
                            {absent ? "No show" : "Here"}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.summary, { color: colors.textSecondary }]}>
                {noShowCount === 0
                  ? `All ${roster.length} here · ka pai`
                  : `${noShowCount} of ${roster.length} marked as no show`}
              </Text>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  handleWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 4 },
  handleBar: { width: 36, height: 4, borderRadius: 2 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: FontFamily.display,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    marginTop: 4,
    lineHeight: 20,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  errorText: { flex: 1, fontFamily: FontFamily.medium, fontSize: 13, lineHeight: 18 },
  body: { paddingHorizontal: 20, gap: 14 },
  hint: { fontFamily: FontFamily.regular, fontSize: 13.5, lineHeight: 19 },
  list: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    // 56pt rows: comfortably past the 44pt minimum, for a tap taken in a
    // busy kitchen rather than at a desk.
    minHeight: 56,
  },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarAbsent: { opacity: 0.45 },
  initial: { fontFamily: FontFamily.semiBold, fontSize: 13 },
  name: { flex: 1, fontFamily: FontFamily.medium, fontSize: 15.5 },
  nameAbsent: { textDecorationLine: "line-through" },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusChipText: { fontFamily: FontFamily.semiBold, fontSize: 12 },
  summary: { fontFamily: FontFamily.medium, fontSize: 13, textAlign: "center" },
  empty: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontFamily: FontFamily.headingBold, fontSize: 19, textAlign: "center" },
  emptyBody: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 280,
  },
});
