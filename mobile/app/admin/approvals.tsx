import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdminLocationFilter } from "@/components/admin/location-filter";
import { Button } from "@/components/ui/button";
import { ScreenHeader } from "@/components/ui/screen-header";
import { EmptyState, ErrorState } from "@/components/ui/state-view";
import { Colors, FontFamily, MaxFontScale, Radius } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAdminPending } from "@/hooks/use-admin";
import { useAdminLocationFilter } from "@/lib/admin-location-filter";
import { formatLongDate, formatTimeRange, GRADE_COLORS, initialOf } from "@/lib/admin-format";
import { actOnSignup, type PendingSignup } from "@/lib/admin";
import { loadErrorKind } from "@/lib/load-error";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

export default function ApprovalsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const selectedLocation = useAdminLocationFilter((s) => s.selected);
  const { data, isPending, isError, error, refetch, isRefetching } =
    useAdminPending(selectedLocation);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rule = isDark ? "rgba(253,248,239,0.12)" : "rgba(29,83,55,0.14)";
  const offline = isError && loadErrorKind(error) === "offline";

  const runAction = useCallback(
    async (signup: PendingSignup, action: "approve" | "reject" | "waitlist") => {
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
        queryClient.setQueryData<PendingSignup[]>(
          queryKeys.admin.pending(selectedLocation),
          (prev) => (prev ?? []).filter((s) => s.id !== signup.id)
        );
        // Counts elsewhere (hub, tonight's shifts) may have shifted.
        queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
        // Only worth interrupting for when the outcome was a surprise. Asking
        // to waitlist someone and being told they were waitlisted is noise.
        if (action === "approve" && res.message?.includes("waitlist")) {
          Alert.alert("Moved to waitlist", "The shift was full, so they were waitlisted.");
        } else if (action === "approve" && res.message?.includes("released")) {
          Alert.alert(
            "Signup released",
            "The shift was full and they'd asked not to wait, so we've let them know it filled up."
          );
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
    [selectedLocation]
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

  const confirmWaitlist = useCallback(
    (signup: PendingSignup) => {
      Alert.alert(
        "Move to waitlist?",
        `${signup.volunteer.name} will be told they're on the waitlist. You can confirm them later if you need them.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Move to waitlist", onPress: () => runAction(signup, "waitlist") },
        ]
      );
    },
    [runAction]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Approvals" borderColor={rule} />

      <View style={styles.filterRow}>
        <AdminLocationFilter />
      </View>

      {isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.tint} />
        </View>
      ) : isError ? (
        <ErrorState
          kind={offline ? "offline" : "error"}
          title={offline ? undefined : "Couldn't load approvals"}
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          emoji="✅"
          title="Queue's clear"
          body={
            selectedLocation
              ? `No signups waiting at ${selectedLocation}. Ka pai!`
              : "No signups waiting on approval. Ka pai!"
          }
        />
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
              onWaitlist={() => confirmWaitlist(item)}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 14 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.tint}
              colors={[colors.tint]}
            />
          }
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
  onWaitlist,
}: {
  signup: PendingSignup;
  colors: (typeof Colors)["light"];
  rule: string;
  busy: boolean;
  onApprove: () => void;
  onDecline: () => void;
  onWaitlist: () => void;
}) {
  const grade = GRADE_COLORS[useColorScheme()][signup.volunteer.volunteerGrade];
  const full = signup.shift.confirmedCount >= signup.shift.capacity;
  // Approving into a full shift waitlists them, unless they asked at signup
  // not to wait - then it releases them. Older servers don't send the field.
  const releaseIfFull = full && signup.waitlistIfFull === false;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: rule }]}>
      {/* Volunteer */}
      <View style={styles.cardHead}>
        {signup.volunteer.profilePhotoUrl ? (
          <Image source={{ uri: signup.volunteer.profilePhotoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.avatarInitial, { color: colors.tint }]}>
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
          <Text
            style={[styles.gradePillText, { color: grade.fg }]}
            maxFontSizeMultiplier={MaxFontScale.compact}
          >
            {grade.label}
          </Text>
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
            {releaseIfFull
              ? " · full, won't wait"
              : full
              ? " · full, will waitlist"
              : ""}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          label="Decline"
          variant="destructive"
          icon="close"
          iconLeading
          onPress={onDecline}
          disabled={busy}
          haptic={false}
          style={styles.declineBtn}
          accessibilityLabel="Decline signup"
        />
        <Button
          label={releaseIfFull ? "Release" : full ? "Waitlist" : "Approve"}
          icon="checkmark"
          iconLeading
          onPress={onApprove}
          loading={busy}
          haptic={false}
          style={styles.approveBtn}
          accessibilityLabel={
            releaseIfFull
              ? "Release signup, the shift is full"
              : full
              ? "Waitlist signup, the shift is full"
              : "Approve signup"
          }
        />
      </View>

      {!full && (
        <Pressable
          onPress={onWaitlist}
          disabled={busy}
          android_ripple={{ color: rule }}
          style={({ pressed }) => [
            styles.waitlistBtn,
            { borderTopColor: rule, opacity: busy ? 0.4 : pressed ? 0.6 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Move to waitlist"
          accessibilityHint="Holds this volunteer without confirming or declining them"
          accessibilityState={{ disabled: busy }}
        >
          <Ionicons name="list-outline" size={17} color={colors.textSecondary} />
          <Text style={[styles.waitlistText, { color: colors.textSecondary }]}>
            Move to waitlist
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  card: { borderRadius: Radius.card, borderWidth: 1, padding: 16, gap: 14 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: FontFamily.bold, fontSize: 17 },
  name: { fontFamily: FontFamily.semiBold, fontSize: 16 },
  email: { fontFamily: FontFamily.regular, fontSize: 13, marginTop: 1 },
  gradePill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  gradePillText: { fontFamily: FontFamily.semiBold, fontSize: 11 },
  divider: { height: StyleSheet.hairlineWidth },
  shiftBlock: { gap: 6 },
  shiftName: { fontFamily: FontFamily.semiBold, fontSize: 16 },
  shiftMetaRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  shiftMeta: { fontFamily: FontFamily.regular, fontSize: 13, flex: 1 },
  actions: { flexDirection: "row", gap: 10, marginTop: 2 },
  // Approve carries the weight, so it gets the wider share of the row.
  declineBtn: { flex: 1, alignSelf: "auto" },
  approveBtn: { flex: 1.4, alignSelf: "auto" },
  waitlistBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 44,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  waitlistText: { fontFamily: FontFamily.semiBold, fontSize: 15 },
});
