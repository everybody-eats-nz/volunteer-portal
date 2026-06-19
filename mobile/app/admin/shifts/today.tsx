import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdminLocationFilter } from "@/components/admin/location-filter";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAdminToday } from "@/hooks/use-admin";
import { useAdminLocationFilter } from "@/lib/admin-location-filter";
import { formatTimeRange, initialOf } from "@/lib/admin-format";
import type { TodayShift } from "@/lib/admin";

/** YYYY-MM-DD for the device-local day at the given offset from today. */
function dateParamForOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabel(offset: number, dateParam: string): string {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  if (offset === -1) return "Yesterday";
  const [y, m, d] = dateParam.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export default function TonightShiftsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [offset, setOffset] = useState(0);
  const dateParam = useMemo(() => dateParamForOffset(offset), [offset]);
  const selectedLocation = useAdminLocationFilter((s) => s.selected);
  const { data, isPending, isError, refetch, isRefetching } = useAdminToday(
    dateParam,
    selectedLocation
  );

  const rule = isDark ? "rgba(253,248,239,0.12)" : "rgba(29,83,55,0.14)";
  const eyebrow = isDark ? Brand.greenLight : Brand.green;

  const step = (delta: number) => {
    Haptics.selectionAsync();
    setOffset((o) => o + delta);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: rule }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerSide} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={eyebrow} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Shifts</Text>
        <View style={styles.headerSide} />
      </View>

      {/* Day stepper */}
      <View style={styles.stepper}>
        <Pressable onPress={() => step(-1)} hitSlop={10} style={[styles.stepBtn, { borderColor: rule }]} accessibilityLabel="Previous day">
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={[styles.stepLabel, { color: colors.text }]}>{dayLabel(offset, dateParam)}</Text>
        <Pressable onPress={() => step(1)} hitSlop={10} style={[styles.stepBtn, { borderColor: rule }]} accessibilityLabel="Next day">
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        <AdminLocationFilter />
      </View>

      {isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={eyebrow} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Couldn&apos;t load shifts</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={[styles.retryText, { color: eyebrow }]}>Try again</Text>
          </Pressable>
        </View>
      ) : (data?.length ?? 0) === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🌙</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No shifts scheduled</Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            {selectedLocation
              ? `Nothing on the roster at ${selectedLocation} for this day.`
              : "Nothing on the roster for this day."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <ShiftCard shift={item} colors={colors} rule={rule} />}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 14 }}
          onRefresh={refetch}
          refreshing={isRefetching}
        />
      )}
    </View>
  );
}

/* ─── Shift card ────────────────────────────────────────────── */

function ShiftCard({
  shift,
  colors,
  rule,
}: {
  shift: TodayShift;
  colors: (typeof Colors)["light"];
  rule: string;
}) {
  const short = shift.fillGap > 0;
  const fillRatio = shift.capacity > 0 ? Math.min(shift.confirmedCount / shift.capacity, 1) : 1;
  const barColor = short ? colors.destructive : Brand.green;
  const shown = shift.signups.slice(0, 6);
  const extra = shift.signups.length - shown.length;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: rule }]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{shift.shiftTypeName}</Text>
          <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
            {formatTimeRange(shift.start, shift.end)}
            {shift.location ? ` · ${shift.location}` : ""}
          </Text>
        </View>
        <View
          style={[
            styles.fillBadge,
            { backgroundColor: short ? "rgba(194,65,12,0.12)" : colors.primaryLight },
          ]}
        >
          <Text style={[styles.fillBadgeText, { color: short ? colors.destructive : Brand.green }]}>
            {shift.confirmedCount}/{shift.capacity}
          </Text>
        </View>
      </View>

      {/* Fill bar */}
      <View style={[styles.barTrack, { backgroundColor: colors.surfaceSunk }]}>
        <View style={[styles.barFill, { width: `${fillRatio * 100}%`, backgroundColor: barColor }]} />
      </View>

      {/* Status line */}
      <View style={styles.statusRow}>
        {short ? (
          <Text style={[styles.statusShort, { color: colors.destructive }]}>
            {shift.fillGap} more {shift.fillGap === 1 ? "volunteer" : "volunteers"} needed
          </Text>
        ) : (
          <Text style={[styles.statusOk, { color: Brand.green }]}>Fully staffed · ka pai</Text>
        )}
        {shift.pendingCount > 0 && (
          <View style={[styles.pendingChip, { borderColor: rule }]}>
            <Text style={[styles.pendingChipText, { color: colors.textSecondary }]}>
              {shift.pendingCount} pending
            </Text>
          </View>
        )}
      </View>

      {/* Volunteer roster */}
      {shift.signups.length > 0 && (
        <View style={styles.roster}>
          {shown.map((s) => (
            <View key={s.id} style={styles.rosterItem}>
              {s.volunteer.profilePhotoUrl ? (
                <Image source={{ uri: s.volunteer.profilePhotoUrl }} style={styles.rosterAvatar} />
              ) : (
                <View style={[styles.rosterAvatar, styles.rosterAvatarFallback, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.rosterInitial, { color: Brand.green }]}>
                    {initialOf(s.volunteer.name)}
                  </Text>
                </View>
              )}
              <Text style={[styles.rosterName, { color: colors.textSecondary }]} numberOfLines={1}>
                {s.volunteer.name.split(" ")[0]}
                {s.status !== "CONFIRMED" ? " ·" : ""}
              </Text>
            </View>
          ))}
          {extra > 0 && (
            <View style={styles.rosterItem}>
              <View style={[styles.rosterAvatar, styles.rosterAvatarFallback, { backgroundColor: colors.surfaceSunk }]}>
                <Text style={[styles.rosterInitial, { color: colors.textSecondary }]}>+{extra}</Text>
              </View>
            </View>
          )}
        </View>
      )}
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
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: { fontFamily: FontFamily.heading, fontSize: 17 },
  filterRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 42, marginBottom: 12 },
  emptyTitle: { fontFamily: FontFamily.headingBold, fontSize: 21, marginBottom: 8, textAlign: "center" },
  emptyBody: { fontFamily: FontFamily.regular, fontSize: 14.5, lineHeight: 21, textAlign: "center", maxWidth: 280 },
  retryBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { fontFamily: FontFamily.semiBold, fontSize: 15 },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardTitle: { fontFamily: FontFamily.semiBold, fontSize: 16.5, lineHeight: 21 },
  cardMeta: { fontFamily: FontFamily.regular, fontSize: 13, marginTop: 3 },
  fillBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  fillBadgeText: { fontFamily: FontFamily.bold, fontSize: 13 },
  barTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusShort: { flex: 1, fontFamily: FontFamily.semiBold, fontSize: 13 },
  statusOk: { flex: 1, fontFamily: FontFamily.medium, fontSize: 13 },
  pendingChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  pendingChipText: { fontFamily: FontFamily.semiBold, fontSize: 11 },
  roster: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 2 },
  rosterItem: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: 120 },
  rosterAvatar: { width: 26, height: 26, borderRadius: 13 },
  rosterAvatarFallback: { alignItems: "center", justifyContent: "center" },
  rosterInitial: { fontFamily: FontFamily.semiBold, fontSize: 11 },
  rosterName: { fontFamily: FontFamily.medium, fontSize: 12.5 },
});
