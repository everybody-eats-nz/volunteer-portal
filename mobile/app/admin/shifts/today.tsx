import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { AttendanceSheet } from "@/components/admin/attendance-sheet";
import { ScreenHeader } from "@/components/ui/screen-header";
import { EmptyState, ErrorState } from "@/components/ui/state-view";
import { Colors, FontFamily, MaxFontScale, Radius, StatusColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAdminToday } from "@/hooks/use-admin";
import { useAdminLocationFilter } from "@/lib/admin-location-filter";
import { formatTimeRange, initialOf } from "@/lib/admin-format";
import type { TodayShift } from "@/lib/admin";
import { loadErrorKind } from "@/lib/load-error";
import { isShiftStarted } from "@/lib/shift-time";

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

  const [offset, setOffset] = useState(0);
  const dateParam = useMemo(() => dateParamForOffset(offset), [offset]);
  const selectedLocation = useAdminLocationFilter((s) => s.selected);
  const { data, isPending, isError, error, refetch, isRefetching } = useAdminToday(
    dateParam,
    selectedLocation
  );

  const rule = isDark ? "rgba(253,248,239,0.12)" : "rgba(29,83,55,0.14)";
  const offline = isError && loadErrorKind(error) === "offline";

  const step = (delta: number) => {
    Haptics.selectionAsync();
    setOffset((o) => o + delta);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Shifts" borderColor={rule} />

      {/* Day stepper */}
      <View style={styles.stepper}>
        <Pressable
          onPress={() => step(-1)}
          android_ripple={{ color: rule }}
          style={({ pressed }) => [styles.stepBtn, { borderColor: rule, opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text
          style={[styles.stepLabel, { color: colors.text }]}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          {dayLabel(offset, dateParam)}
        </Text>
        <Pressable
          onPress={() => step(1)}
          android_ripple={{ color: rule }}
          style={({ pressed }) => [styles.stepBtn, { borderColor: rule, opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Next day"
        >
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </Pressable>
      </View>

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
          title={offline ? undefined : "Couldn't load shifts"}
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          emoji="🌙"
          title="No shifts scheduled"
          body={
            selectedLocation
              ? `Nothing on the roster at ${selectedLocation} for this day.`
              : "Nothing on the roster for this day."
          }
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <ShiftCard
              shift={item}
              colors={colors}
              rule={rule}
              date={dateParam}
              location={selectedLocation}
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

/* ─── Shift card ────────────────────────────────────────────── */

function ShiftCard({
  shift,
  colors,
  rule,
  date,
  location,
}: {
  shift: TodayShift;
  colors: (typeof Colors)["light"];
  rule: string;
  date: string;
  location: string | null;
}) {
  const status = StatusColors[useColorScheme()];
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  // Attendance is only meaningful once people were due to arrive. Before that
  // the button would be inviting a guess.
  const started = isShiftStarted(shift.start);
  const confirmedRoster = shift.signups.filter(
    (s) => s.status === "CONFIRMED" || s.status === "NO_SHOW"
  ).length;
  const short = shift.fillGap > 0;
  const fillRatio = shift.capacity > 0 ? Math.min(shift.confirmedCount / shift.capacity, 1) : 1;
  const barColor = short ? colors.destructive : colors.tint;
  const fillTone = short ? status.destructive : status.confirmed;
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
            { backgroundColor: fillTone.bg },
          ]}
        >
          <Text
            style={[styles.fillBadgeText, { color: fillTone.fg }]}
            maxFontSizeMultiplier={MaxFontScale.compact}
          >
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
          <Text style={[styles.statusOk, { color: colors.tint }]}>Fully staffed · ka pai</Text>
        )}
        {shift.pendingCount > 0 && (
          <View style={[styles.pendingChip, { borderColor: rule }]}>
            <Text
              style={[styles.pendingChipText, { color: colors.textSecondary }]}
              maxFontSizeMultiplier={MaxFontScale.compact}
            >
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
                  <Text
                    style={[styles.rosterInitial, { color: colors.tint }]}
                    maxFontSizeMultiplier={MaxFontScale.compact}
                  >
                    {initialOf(s.volunteer.name)}
                  </Text>
                </View>
              )}
              <Text
                style={[
                  styles.rosterName,
                  {
                    color:
                      s.status === "NO_SHOW"
                        ? colors.destructive
                        : colors.textSecondary,
                  },
                  s.status === "NO_SHOW" && styles.rosterNameAbsent,
                ]}
                numberOfLines={1}
              >
                {s.volunteer.name.split(" ")[0]}
                {s.status !== "CONFIRMED" && s.status !== "NO_SHOW" ? " ·" : ""}
              </Text>
            </View>
          ))}
          {extra > 0 && (
            <View style={styles.rosterItem}>
              <View style={[styles.rosterAvatar, styles.rosterAvatarFallback, { backgroundColor: colors.surfaceSunk }]}>
                <Text
                  style={[styles.rosterInitial, { color: colors.textSecondary }]}
                  maxFontSizeMultiplier={MaxFontScale.compact}
                >
                  +{extra}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Attendance. Appears the moment service starts - this is the whole
          point of the screen being on a phone rather than a desk. */}
      {started && confirmedRoster > 0 && (
        <Pressable
          onPress={() => setAttendanceOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Take attendance for ${shift.shiftTypeName}`}
          android_ripple={{ color: rule }}
          style={({ pressed }) => [
            styles.attendanceBtn,
            { borderColor: rule, backgroundColor: pressed ? colors.surfaceSunk : "transparent" },
          ]}
        >
          <Ionicons name="clipboard-outline" size={16} color={colors.tint} />
          <Text style={[styles.attendanceBtnText, { color: colors.tint }]}>
            Take attendance
          </Text>
          {shift.noShowCount > 0 && (
            <View style={[styles.noShowChip, { backgroundColor: status.destructive.bg }]}>
              <Text
                style={[styles.noShowChipText, { color: status.destructive.fg }]}
                maxFontSizeMultiplier={MaxFontScale.compact}
              >
                {shift.noShowCount} no {shift.noShowCount === 1 ? "show" : "shows"}
              </Text>
            </View>
          )}
        </Pressable>
      )}

      <AttendanceSheet
        visible={attendanceOpen}
        onClose={() => setAttendanceOpen(false)}
        shift={shift}
        date={date}
        location={location}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
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
  card: { borderRadius: Radius.card, borderWidth: 1, padding: 16, gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardTitle: { fontFamily: FontFamily.semiBold, fontSize: 16, lineHeight: 21 },
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
  rosterName: { fontFamily: FontFamily.medium, fontSize: 13 },
  rosterNameAbsent: { textDecorationLine: "line-through" },
  attendanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  attendanceBtnText: { fontFamily: FontFamily.semiBold, fontSize: 14 },
  noShowChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  noShowChipText: { fontFamily: FontFamily.semiBold, fontSize: 11 },
});
