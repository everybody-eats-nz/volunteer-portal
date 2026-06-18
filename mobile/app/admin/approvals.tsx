import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAdminPending } from "@/hooks/use-admin";
import { formatLongDate, formatTimeRange, GRADE_COLORS, initialOf } from "@/lib/admin-format";
import { actOnSignup, type PendingSignup } from "@/lib/admin";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

export default function ApprovalsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data, isPending, isError, refetch, isRefetching } = useAdminPending();
  const [busyId, setBusyId] = useState<string | null>(null);

  const rule = isDark ? "rgba(253,248,239,0.12)" : "rgba(29,83,55,0.14)";
  const eyebrow = isDark ? Brand.greenLight : Brand.green;

  const runAction = useCallback(
    async (signup: PendingSignup, action: "approve" | "reject") => {
      setBusyId(signup.id);
      Haptics.impactAsync(
        action === "approve"
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light
      );
      try {
        const res = await actOnSignup(signup.id, action);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Drop the handled signup from the cached list immediately.
        queryClient.setQueryData<PendingSignup[]>(queryKeys.admin.pending(), (prev) =>
          (prev ?? []).filter((s) => s.id !== signup.id)
        );
        // Counts elsewhere (hub, tonight's shifts) may have shifted.
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
        if (res.message?.includes("waitlist")) {
          Alert.alert("Moved to waitlist", "The shift was full, so they were waitlisted.");
        }
      } catch (err) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          "Couldn't update",
          err instanceof Error ? err.message : "Please try again."
        );
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const confirmDecline = useCallback(
    (signup: PendingSignup) => {
      Alert.alert(
        "Decline signup?",
        `${signup.volunteer.name} won't be added to this shift.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Decline", style: "destructive", onPress: () => runAction(signup, "reject") },
        ]
      );
    },
    [runAction]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: rule }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerSide} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={eyebrow} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Approvals</Text>
        <View style={styles.headerSide} />
      </View>

      {isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={eyebrow} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Couldn&apos;t load approvals</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={[styles.retryText, { color: eyebrow }]}>Try again</Text>
          </Pressable>
        </View>
      ) : (data?.length ?? 0) === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>✅</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Queue&apos;s clear</Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            No signups waiting on approval. Ka pai!
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <PendingCard
              signup={item}
              colors={colors}
              rule={rule}
              busy={busyId === item.id}
              onApprove={() => runAction(item, "approve")}
              onDecline={() => confirmDecline(item)}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 14 }}
          onRefresh={refetch}
          refreshing={isRefetching}
        />
      )}
    </View>
  );
}

/* ─── Pending card ──────────────────────────────────────────── */

function PendingCard({
  signup,
  colors,
  rule,
  busy,
  onApprove,
  onDecline,
}: {
  signup: PendingSignup;
  colors: (typeof Colors)["light"];
  rule: string;
  busy: boolean;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const grade = GRADE_COLORS[signup.volunteer.volunteerGrade];
  const full = signup.shift.confirmedCount >= signup.shift.capacity;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: rule }]}>
      {/* Volunteer */}
      <View style={styles.cardHead}>
        {signup.volunteer.profilePhotoUrl ? (
          <Image source={{ uri: signup.volunteer.profilePhotoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.avatarInitial, { color: Brand.green }]}>
              {initialOf(signup.volunteer.name)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {signup.volunteer.name}
          </Text>
          <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>
            {signup.volunteer.email}
          </Text>
        </View>
        <View style={[styles.gradePill, { backgroundColor: grade.bg }]}>
          <Text style={[styles.gradePillText, { color: grade.fg }]}>{grade.label}</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: rule }]} />

      {/* Shift */}
      <View style={styles.shiftBlock}>
        <Text style={[styles.shiftName, { color: colors.text }]}>{signup.shift.shiftTypeName}</Text>
        <View style={styles.shiftMetaRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.shiftMeta, { color: colors.textSecondary }]}>
            {formatLongDate(signup.shift.start)} · {formatTimeRange(signup.shift.start, signup.shift.end)}
          </Text>
        </View>
        {signup.shift.location && (
          <View style={styles.shiftMetaRow}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.shiftMeta, { color: colors.textSecondary }]}>{signup.shift.location}</Text>
          </View>
        )}
        <View style={styles.shiftMetaRow}>
          <Ionicons name="people-outline" size={14} color={full ? colors.destructive : colors.textSecondary} />
          <Text style={[styles.shiftMeta, { color: full ? colors.destructive : colors.textSecondary }]}>
            {signup.shift.confirmedCount}/{signup.shift.capacity} confirmed
            {full ? " · full, will waitlist" : ""}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={onDecline}
          disabled={busy}
          style={({ pressed }) => [
            styles.declineBtn,
            { borderColor: rule, opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Decline signup"
        >
          <Ionicons name="close" size={18} color={colors.destructive} />
          <Text style={[styles.declineText, { color: colors.destructive }]}>Decline</Text>
        </Pressable>
        <Pressable
          onPress={onApprove}
          disabled={busy}
          style={({ pressed }) => [
            styles.approveBtn,
            { backgroundColor: Brand.green, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Approve signup"
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.approveText}>{full ? "Waitlist" : "Approve"}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: { width: 40, alignItems: "flex-start", justifyContent: "center" },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 42, marginBottom: 12 },
  emptyTitle: { fontFamily: FontFamily.headingBold, fontSize: 21, marginBottom: 8, textAlign: "center" },
  emptyBody: { fontFamily: FontFamily.regular, fontSize: 14.5, lineHeight: 21, textAlign: "center", maxWidth: 280 },
  retryBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { fontFamily: FontFamily.semiBold, fontSize: 15 },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 14 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: FontFamily.bold, fontSize: 17 },
  name: { fontFamily: FontFamily.semiBold, fontSize: 16 },
  email: { fontFamily: FontFamily.regular, fontSize: 12.5, marginTop: 1 },
  gradePill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  gradePillText: { fontFamily: FontFamily.semiBold, fontSize: 11 },
  divider: { height: StyleSheet.hairlineWidth },
  shiftBlock: { gap: 6 },
  shiftName: { fontFamily: FontFamily.semiBold, fontSize: 15.5 },
  shiftMetaRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  shiftMeta: { fontFamily: FontFamily.regular, fontSize: 13, flex: 1 },
  actions: { flexDirection: "row", gap: 10, marginTop: 2 },
  declineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
  },
  declineText: { fontFamily: FontFamily.semiBold, fontSize: 15 },
  approveBtn: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 46,
    borderRadius: 14,
  },
  approveText: { fontFamily: FontFamily.semiBold, fontSize: 15, color: "#fff" },
});
