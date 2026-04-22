import { Ionicons } from "@expo/vector-icons";
import {
  addDays,
  differenceInDays,
  differenceInMinutes,
  isToday,
  isTomorrow,
  isYesterday,
  startOfDay,
  subDays,
} from "date-fns";
import { formatNZT } from "@/lib/dates";
import * as Haptics from "expo-haptics";
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "expo-image";

import { ShiftMonthCalendar } from "@/components/shift-month-calendar";
import { ThemedText } from "@/components/themed-text";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useShifts, type PeriodFriend } from "@/hooks/use-shifts";
import { getShiftThemeByName, type Shift } from "@/lib/dummy-data";

/* ── Types ── */

type PeriodSubGroup = {
  periodKey: string; // "YYYY-MM-DD-DAY" or "YYYY-MM-DD-EVE"
  periodLabel: "Day" | "Evening";
  shifts: Shift[];
};

/* ── Helpers ── */

function getDuration(start: string, end: string): string {
  const mins = differenceInMinutes(new Date(end), new Date(start));
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

/** Cutoff hour (NZ time) — before this is "Day", at or after is "Evening" */
const DAY_EVENING_CUTOFF = 16;

function isShiftDay(shift: Shift): boolean {
  const hour = parseInt(formatNZT(new Date(shift.start), "H"), 10);
  return hour < DAY_EVENING_CUTOFF;
}

function formatDateKey(date: Date): string {
  return formatNZT(date, "yyyy-MM-dd");
}

function splitDayPeriods(shifts: Shift[], dateStr: string): PeriodSubGroup[] {
  const dayPeriod = shifts.filter(isShiftDay);
  const evePeriod = shifts.filter((s) => !isShiftDay(s));
  const periods: PeriodSubGroup[] = [];
  if (dayPeriod.length > 0) {
    periods.push({
      periodKey: `${dateStr}-DAY`,
      periodLabel: "Day",
      shifts: dayPeriod,
    });
  }
  if (evePeriod.length > 0) {
    periods.push({
      periodKey: `${dateStr}-EVE`,
      periodLabel: "Evening",
      shifts: evePeriod,
    });
  }
  return periods;
}

function relativeDayLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isYesterday(date)) return "Yesterday";
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diff = differenceInDays(target, today);
  if (diff > 0 && diff < 7) return `In ${diff} days`;
  if (diff < 0 && diff > -7) return `${Math.abs(diff)} days ago`;
  return formatNZT(date, "d MMMM");
}

/* ── Status Config ── */

const STATUS_CONFIG: Record<
  string,
  {
    icon: keyof typeof Ionicons.glyphMap;
    bg: string;
    bgDark: string;
    text: string;
    textDark: string;
    label: string;
  }
> = {
  CONFIRMED: {
    icon: "checkmark-circle",
    bg: "#dcfce7",
    bgDark: "rgba(34, 197, 94, 0.15)",
    text: "#166534",
    textDark: "#86efac",
    label: "Confirmed",
  },
  PENDING: {
    icon: "time",
    bg: "#fef3c7",
    bgDark: "rgba(245, 158, 11, 0.15)",
    text: "#92400e",
    textDark: "#fbbf24",
    label: "Pending",
  },
  WAITLISTED: {
    icon: "list",
    bg: "#f1f5f9",
    bgDark: "rgba(100, 116, 139, 0.2)",
    text: "#475569",
    textDark: "#94a3b8",
    label: "Waitlisted",
  },
  COMPLETED: {
    icon: "checkmark-done",
    bg: "#f1ede4",
    bgDark: "rgba(255,255,255,0.06)",
    text: "#57534e",
    textDark: "#d6d3d1",
    label: "Completed",
  },
};

/* ── Main Screen ── */

export default function ShiftsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const {
    myShifts,
    available,
    past,
    isLoading,
    error,
    refresh,
    loadMorePast,
    isLoadingMore,
    userDefaultLocation,
    periodFriends,
    shiftFriends,
  } = useShifts();

  /* Silent location default — applies the user's explicit default location without surfacing a picker */
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const hasSetDefault = useRef(false);

  useEffect(() => {
    if (hasSetDefault.current) return;
    if (userDefaultLocation) {
      setLocationFilter(userDefaultLocation);
      hasSetDefault.current = true;
    }
  }, [userDefaultLocation]);

  const filteredAvailable = useMemo(
    () =>
      locationFilter
        ? available.filter((s) => s.location === locationFilter)
        : available,
    [available, locationFilter]
  );

  /* Available locations across all shifts — used by the picker */
  const locations = useMemo(() => {
    const all = [...myShifts, ...available, ...past];
    return [...new Set(all.map((s) => s.location))].sort();
  }, [myShifts, available, past]);

  const [pickerVisible, setPickerVisible] = useState(false);

  /* Selected date (default today) */
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    startOfDay(new Date())
  );
  const selectedDateKey = formatDateKey(selectedDate);

  /* Calendar signals — merge available + signups (past + upcoming) for density dots */
  const shiftCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    const seen = new Set<string>();
    const add = (shift: Shift) => {
      if (seen.has(shift.id)) return;
      seen.add(shift.id);
      const key = formatDateKey(new Date(shift.start));
      map[key] = (map[key] ?? 0) + 1;
    };
    for (const shift of filteredAvailable) add(shift);
    for (const shift of myShifts) add(shift);
    for (const shift of past) add(shift);
    return map;
  }, [filteredAvailable, myShifts, past]);

  const friendDates = useMemo(() => {
    const set = new Set<string>();
    for (const periodKey of Object.keys(periodFriends)) {
      if (periodFriends[periodKey].length === 0) continue;
      set.add(periodKey.slice(0, 10));
    }
    return set;
  }, [periodFriends]);

  const signedUpDates = useMemo(() => {
    const set = new Set<string>();
    for (const shift of myShifts) set.add(formatDateKey(new Date(shift.start)));
    return set;
  }, [myShifts]);

  const pastAttendedDates = useMemo(() => {
    const set = new Set<string>();
    for (const shift of past) set.add(formatDateKey(new Date(shift.start)));
    return set;
  }, [past]);

  /* Selected-day shifts: merge signups (past + upcoming) + available, dedupe by id */
  const selectedDayShifts = useMemo(() => {
    const mine = [...myShifts, ...past].filter(
      (s) => formatDateKey(new Date(s.start)) === selectedDateKey
    );
    const mineIds = new Set(mine.map((s) => s.id));
    const avail = filteredAvailable.filter(
      (s) =>
        formatDateKey(new Date(s.start)) === selectedDateKey &&
        !mineIds.has(s.id)
    );
    return [...mine, ...avail];
  }, [myShifts, past, filteredAvailable, selectedDateKey]);

  const selectedDayPeriods = useMemo(
    () => splitDayPeriods(selectedDayShifts, selectedDateKey),
    [selectedDayShifts, selectedDateKey]
  );

  const totalDayShifts = selectedDayPeriods.reduce(
    (sum, p) => sum + p.shifts.length,
    0
  );

  /* Earliest upcoming signup — surfaces as a jump-to pill */
  const nextShift = useMemo(() => {
    if (myShifts.length === 0) return null;
    return [...myShifts].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    )[0];
  }, [myShifts]);

  /* Handlers */
  const selectDate = useCallback((date: Date) => {
    Haptics.selectionAsync();
    setSelectedDate(startOfDay(date));
  }, []);

  const nudgeDay = useCallback((delta: number) => {
    Haptics.selectionAsync();
    setSelectedDate((d) =>
      delta > 0 ? addDays(d, delta) : subDays(d, -delta)
    );
  }, []);

  /* Prefetch more past pages so the calendar has density signal across earlier months */
  const prefetchedRef = useRef(false);
  useEffect(() => {
    if (prefetchedRef.current || isLoading) return;
    prefetchedRef.current = true;
    (async () => {
      for (let i = 0; i < 2; i++) {
        await loadMorePast();
      }
    })();
  }, [isLoading, loadMorePast]);

  const showInitialLoading =
    isLoading &&
    myShifts.length === 0 &&
    available.length === 0 &&
    past.length === 0 &&
    !error;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        Platform.OS === "android" && { paddingTop: insets.top },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refresh}
          tintColor={colors.tint}
          colors={[colors.tint]}
          progressBackgroundColor={colors.card}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={{ flex: 1 }}>
            <ThemedText type="title">Shifts</ThemedText>
            <ThemedText type="caption" style={{ color: colors.textSecondary }}>
              Your mahi and open shifts
            </ThemedText>
          </View>
          {locations.length > 1 && (
            <LocationPill
              label={locationFilter ?? "All locations"}
              onPress={() => {
                Haptics.selectionAsync();
                setPickerVisible(true);
              }}
              isDark={isDark}
              colors={colors}
            />
          )}
        </View>
      </View>

      {/* Location picker sheet */}
      <LocationPickerSheet
        visible={pickerVisible}
        locations={locations}
        selected={locationFilter}
        onSelect={(value) => {
          Haptics.selectionAsync();
          setLocationFilter(value);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
        isDark={isDark}
        colors={colors}
      />

      {/* Error */}
      {error && !isLoading && (
        <View style={styles.emptyState}>
          <View
            style={[
              styles.emptyIconCircle,
              { backgroundColor: "rgba(239, 68, 68, 0.1)" },
            ]}
          >
            <Ionicons name="cloud-offline-outline" size={32} color="#ef4444" />
          </View>
          <ThemedText type="subtitle" style={{ textAlign: "center" }}>
            {"Couldn't load shifts"}
          </ThemedText>
          <ThemedText
            type="caption"
            style={{ color: colors.textSecondary, textAlign: "center" }}
          >
            Pull down to try again
          </ThemedText>
        </View>
      )}

      {/* Initial loading */}
      {showInitialLoading && (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText
            type="caption"
            style={{ color: colors.textSecondary, marginTop: 12 }}
          >
            Loading shifts...
          </ThemedText>
        </View>
      )}

      {!error && !showInitialLoading && (
        <>
          {/* Next shift pill */}
          {nextShift && (
            <NextShiftPill shift={nextShift} colors={colors} isDark={isDark} />
          )}

          {/* Calendar card */}
          <View
            style={[
              styles.calendarCard,
              {
                backgroundColor: isDark ? colors.card : "#ffffff",
                borderColor: isDark ? "rgba(255,255,255,0.06)" : "#e4dfd7",
                shadowColor: isDark ? "#000" : "#94a3b8",
                marginTop: nextShift ? 14 : 20,
              },
            ]}
          >
            <ShiftMonthCalendar
              selectedDate={selectedDate}
              onSelectDate={selectDate}
              shiftCountByDate={shiftCountByDate}
              friendDates={friendDates}
              signedUpDates={signedUpDates}
              pastAttendedDates={pastAttendedDates}
              isDark={isDark}
            />
          </View>

          {/* Date nav */}
          <DateNavHeader
            selectedDate={selectedDate}
            onNudge={nudgeDay}
            isDark={isDark}
          />

          {/* Day shifts */}
          {totalDayShifts === 0 ? (
            <View style={styles.dayEmpty}>
              <View
                style={[
                  styles.dayEmptyIcon,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(14, 58, 35, 0.05)",
                  },
                ]}
              >
                <Ionicons
                  name="leaf-outline"
                  size={22}
                  color={colors.textSecondary}
                />
              </View>
              <Text style={[styles.dayEmptyTitle, { color: colors.text }]}>
                No shifts on this day
              </Text>
              <Text
                style={[
                  styles.dayEmptySubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                Try another day from the calendar above
              </Text>
            </View>
          ) : (
            <View style={styles.shiftList}>
              {selectedDayPeriods.map((period) => {
                const friends = periodFriends[period.periodKey] ?? [];
                return (
                  <View key={period.periodKey} style={styles.periodGroup}>
                    <PeriodHeader
                      label={period.periodLabel}
                      count={period.shifts.length}
                      friends={friends}
                      colors={colors}
                      isDark={isDark}
                    />
                    <View style={styles.dayCards}>
                      {period.shifts.map((shift) => (
                        <ShiftCard
                          key={shift.id}
                          shift={shift}
                          friends={shiftFriends[shift.id] ?? []}
                          colors={colors}
                          isDark={isDark}
                          showStatus={!!shift.status}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

      {/* Loading more */}
      {isLoadingMore && (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text
            style={[styles.loadingMoreText, { color: colors.textSecondary }]}
          >
            Loading shifts...
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

/* ── Location Pill ── */

function LocationPill({
  label,
  onPress,
  isDark,
  colors,
}: {
  label: string;
  onPress: () => void;
  isDark: boolean;
  colors: (typeof Colors)["light"];
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.locationPill,
        {
          backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#ffffff",
          borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e4dfd7",
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Location: ${label}. Tap to change.`}
    >
      <Ionicons name="location" size={13} color={colors.textSecondary} />
      <Text
        style={[styles.locationPillText, { color: colors.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
    </Pressable>
  );
}

/* ── Location Picker Sheet ── */

function LocationPickerSheet({
  visible,
  locations,
  selected,
  onSelect,
  onClose,
  isDark,
  colors,
}: {
  visible: boolean;
  locations: string[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  onClose: () => void;
  isDark: boolean;
  colors: (typeof Colors)["light"];
}) {
  const insets = useSafeAreaInsets();
  const items: {
    key: string;
    label: string;
    value: string | null;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: "all", label: "All locations", value: null, icon: "globe-outline" },
    ...locations.map((loc) => ({
      key: loc,
      label: loc,
      value: loc,
      icon: "location" as const,
    })),
  ];

  return (
    <Modal
      visible={visible}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.sheetPage,
          {
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        {/* Handle bar */}
        <View style={styles.sheetHandleWrap}>
          <View
            style={[
              styles.sheetHandle,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(0,0,0,0.15)",
              },
            ]}
          />
        </View>

        {/* Header */}
        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              Choose location
            </Text>
            <Text
              style={[styles.sheetSubtitle, { color: colors.textSecondary }]}
            >
              Filter shifts by restaurant
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityLabel="Close"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.sheetClose,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9",
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* List */}
        <ScrollView
          contentContainerStyle={styles.sheetList}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => {
            const active = item.value === selected;
            return (
              <Pressable
                key={item.key}
                onPress={() => onSelect(item.value)}
                style={({ pressed }) => [
                  styles.sheetItem,
                  {
                    backgroundColor: active
                      ? isDark
                        ? "rgba(134, 239, 172, 0.12)"
                        : Brand.greenLight
                      : pressed
                      ? isDark
                        ? "rgba(255,255,255,0.04)"
                        : "#f8fafc"
                      : "transparent",
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={
                    active
                      ? isDark
                        ? "#86efac"
                        : Brand.green
                      : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.sheetItemText,
                    {
                      color: active
                        ? isDark
                          ? "#86efac"
                          : Brand.green
                        : colors.text,
                      fontFamily: active
                        ? FontFamily.semiBold
                        : FontFamily.regular,
                    },
                  ]}
                >
                  {item.label}
                </Text>
                {active && (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={isDark ? "#86efac" : Brand.green}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ── Next Shift Pill ── */

function NextShiftPill({
  shift,
  colors,
  isDark,
}: {
  shift: Shift;
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  const router = useRouter();
  const date = new Date(shift.start);
  const theme = getShiftThemeByName(shift.shiftType.name);
  const accentColor = isDark ? theme.colorDark : theme.color;
  const relative = relativeDayLabel(date);

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/shift/${shift.id}` as Href);
      }}
      style={({ pressed }) => [
        styles.nextShiftPill,
        {
          backgroundColor: isDark ? colors.card : "#ffffff",
          borderColor: isDark ? "rgba(255,255,255,0.06)" : "#e4dfd7",
          shadowColor: isDark ? "#000" : "#94a3b8",
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Your next shift: ${
        shift.shiftType.name
      }, ${relative} at ${formatNZT(date, "h:mm a")}`}
    >
      <View style={[styles.nextShiftIcon, { backgroundColor: accentColor }]}>
        <Text style={styles.nextShiftEmoji}>{theme.emoji}</Text>
      </View>
      <View style={styles.nextShiftText}>
        <Text style={[styles.nextShiftLabel, { color: colors.textSecondary }]}>
          Your next shift
        </Text>
        <Text
          style={[styles.nextShiftName, { color: colors.text }]}
          numberOfLines={1}
        >
          {shift.shiftType.name}
        </Text>
        <Text
          style={[styles.nextShiftMeta, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {relative} · {formatNZT(date, "h:mm a")} · {shift.location}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

/* ── Date Nav Header ── */

function DateNavHeader({
  selectedDate,
  onNudge,
  isDark,
}: {
  selectedDate: Date;
  onNudge: (delta: number) => void;
  isDark: boolean;
}) {
  const colors = Colors[isDark ? "dark" : "light"];
  const primary = formatNZT(selectedDate, "EEEE, d MMMM");
  const relative = relativeDayLabel(selectedDate);
  const isTodayLabel = relative === "Today";

  return (
    <View style={styles.dateNavRow}>
      <Pressable
        onPress={() => onNudge(-1)}
        hitSlop={10}
        style={({ pressed }) => [
          styles.dateNavButton,
          {
            backgroundColor: isDark
              ? "rgba(255,255,255,0.06)"
              : "rgba(14, 58, 35, 0.05)",
            opacity: pressed ? 0.6 : 1,
          },
        ]}
        accessibilityLabel="Previous day"
        accessibilityRole="button"
      >
        <Ionicons name="chevron-back" size={18} color={colors.text} />
      </Pressable>

      <View style={styles.dateNavLabelContainer}>
        <Text style={[styles.dateNavPrimary, { color: colors.text }]}>
          {primary}
        </Text>
        <View style={styles.dateNavRelativeRow}>
          <View
            style={[
              styles.dateNavRelativePill,
              {
                backgroundColor: isTodayLabel
                  ? isDark
                    ? "rgba(134, 239, 172, 0.15)"
                    : Brand.greenLight
                  : isDark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(14, 58, 35, 0.05)",
              },
            ]}
          >
            <Text
              style={[
                styles.dateNavRelativeText,
                {
                  color: isTodayLabel
                    ? isDark
                      ? "#86efac"
                      : Brand.green
                    : colors.textSecondary,
                },
              ]}
            >
              {relative}
            </Text>
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => onNudge(1)}
        hitSlop={10}
        style={({ pressed }) => [
          styles.dateNavButton,
          {
            backgroundColor: isDark
              ? "rgba(255,255,255,0.06)"
              : "rgba(14, 58, 35, 0.05)",
            opacity: pressed ? 0.6 : 1,
          },
        ]}
        accessibilityLabel="Next day"
        accessibilityRole="button"
      >
        <Ionicons name="chevron-forward" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

/* ── Friend Avatar Stack ── */

function FriendAvatarStack({
  friends,
  isDark,
  size = 26,
  maxShow = 4,
  borderColor,
  accentColor,
}: {
  friends: PeriodFriend[];
  isDark: boolean;
  size?: number;
  maxShow?: number;
  borderColor?: string;
  accentColor?: string;
}) {
  const shown = friends.slice(0, maxShow);
  const overflow = friends.length - maxShow;
  const ring = borderColor ?? (isDark ? "#0f1114" : Brand.warmWhite);
  const fallbackBg = isDark ? "rgba(14,58,35,0.4)" : Brand.greenLight;
  const fallbackFg = accentColor ?? (isDark ? "#86efac" : Brand.green);
  const overlap = Math.max(6, Math.round(size * 0.33));

  return (
    <View style={styles.friendAvatarRow}>
      {shown.map((friend, index) => {
        const dim = { width: size, height: size, borderRadius: size / 2 };
        return (
          <View
            key={friend.id}
            style={{
              marginLeft: index === 0 ? 0 : -overlap,
              zIndex: maxShow - index,
            }}
          >
            {friend.profilePhotoUrl ? (
              <Image
                source={{ uri: friend.profilePhotoUrl }}
                style={[styles.friendAvatar, dim, { borderColor: ring }]}
              />
            ) : (
              <View
                style={[
                  styles.friendAvatar,
                  styles.friendAvatarFallback,
                  dim,
                  { borderColor: ring, backgroundColor: fallbackBg },
                ]}
              >
                <Text
                  style={[
                    styles.friendInitial,
                    { color: fallbackFg, fontSize: Math.round(size * 0.42) },
                  ]}
                >
                  {friend.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        );
      })}
      {overflow > 0 && (
        <View style={{ marginLeft: -overlap, zIndex: 0 }}>
          <View
            style={[
              styles.friendAvatar,
              styles.friendAvatarFallback,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: ring,
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#eceae3",
              },
            ]}
          >
            <Text
              style={[
                styles.friendOverflow,
                {
                  color: isDark ? "#cbd5e1" : "#475569",
                  fontSize: Math.round(size * 0.38),
                },
              ]}
            >
              +{overflow}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

/* ── Period Header (Day / Evening) ── */

function PeriodHeader({
  label,
  count,
  friends,
  colors,
  isDark,
}: {
  label: "Day" | "Evening";
  count: number;
  friends: PeriodFriend[];
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  const isDay = label === "Day";
  const iconName: keyof typeof Ionicons.glyphMap = isDay
    ? "sunny-outline"
    : "moon-outline";
  const accent = isDay
    ? isDark
      ? "#fbbf24"
      : "#d97706"
    : isDark
    ? "#c4b5fd"
    : "#6d28d9";
  const chipBg = isDay
    ? isDark
      ? "rgba(251, 191, 36, 0.12)"
      : "rgba(217, 119, 6, 0.08)"
    : isDark
    ? "rgba(196, 181, 253, 0.14)"
    : "rgba(109, 40, 217, 0.08)";
  const ruleColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(14, 58, 35, 0.1)";

  return (
    <View style={styles.periodHeader}>
      <View style={[styles.periodChip, { backgroundColor: chipBg }]}>
        <Ionicons name={iconName} size={12} color={accent} />
        <Text style={[styles.periodChipText, { color: accent }]}>
          {isDay ? "Day shifts" : "Evening shifts"}
        </Text>
      </View>

      <View style={[styles.periodRule, { backgroundColor: ruleColor }]} />

      {friends.length > 0 ? (
        <View style={styles.periodFriendsWrap}>
          <FriendAvatarStack
            friends={friends}
            isDark={isDark}
            size={22}
            maxShow={3}
          />
          <Text
            style={[styles.periodMetaText, { color: colors.textSecondary }]}
          >
            {friends.length === 1 ? "1 friend" : `${friends.length} friends`}
          </Text>
        </View>
      ) : (
        <Text style={[styles.periodMetaText, { color: colors.textSecondary }]}>
          {count} {count === 1 ? "role" : "roles"}
        </Text>
      )}
    </View>
  );
}

/* ── Shift Card ── */

function formatTimeRange(start: Date, end: Date): { range: string } {
  const startFormat = formatNZT(start, "h:mm");
  const startSuffix = formatNZT(start, "a").toLowerCase();
  const endFormat = formatNZT(end, "h:mm");
  const endSuffix = formatNZT(end, "a").toLowerCase();
  const range =
    startSuffix === endSuffix
      ? `${startFormat} – ${endFormat} ${endSuffix}`
      : `${startFormat} ${startSuffix} – ${endFormat} ${endSuffix}`;
  return { range };
}

function friendsLine(friends: PeriodFriend[], hasStatus: boolean): string {
  if (friends.length === 0) return "";
  const firstName = friends[0].name.split(" ")[0];
  if (friends.length === 1) {
    return hasStatus ? `With ${firstName}` : `${firstName} is signed up`;
  }
  if (friends.length === 2) {
    const secondName = friends[1].name.split(" ")[0];
    return hasStatus
      ? `With ${firstName} & ${secondName}`
      : `${firstName} & ${secondName} are going`;
  }
  return hasStatus
    ? `With ${firstName} + ${friends.length - 1} more`
    : `${firstName} + ${friends.length - 1} friends going`;
}

function ShiftCard({
  shift,
  friends,
  colors,
  isDark,
  showStatus,
}: {
  shift: Shift;
  friends: PeriodFriend[];
  colors: (typeof Colors)["light"];
  isDark: boolean;
  showStatus?: boolean;
}) {
  const router = useRouter();
  const date = new Date(shift.start);
  const endDate = new Date(shift.end);
  const spotsLeft = shift.capacity - shift.signedUp;
  const isFull = spotsLeft <= 0;
  const isUrgent = !isFull && spotsLeft <= 2;
  const theme = getShiftThemeByName(shift.shiftType.name);
  const accentColor = isDark ? theme.colorDark : theme.color;
  const accentBg = isDark ? theme.bgDark : theme.bgLight;
  const duration = getDuration(shift.start, shift.end);
  const { range: timeRange } = formatTimeRange(date, endDate);
  const cardBg = isDark ? "#1a2026" : "#ffffff";
  const dividerColor = isDark ? "rgba(255,255,255,0.08)" : "#ebe5d9";
  const isUserSignedUp = !!(showStatus && shift.status);
  const isPast = endDate.getTime() < Date.now();
  const isCompleted = isUserSignedUp && shift.status === "CONFIRMED" && isPast;
  const displayStatus = isCompleted ? "COMPLETED" : shift.status;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/shift/${shift.id}` as Href);
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: isDark ? "rgba(255,255,255,0.06)" : "#ece6d8",
          shadowColor: isDark ? "#000" : "#94a3b8",
          opacity: pressed ? 0.97 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
      accessibilityLabel={`${shift.shiftType.name} at ${
        shift.location
      }, ${formatNZT(date, "EEEE d MMMM")}, ${timeRange}${
        friends.length > 0 ? `, ${friends.length} friends going` : ""
      }`}
      accessibilityRole="button"
    >
      {/* Left station rail */}
      <View
        style={[styles.cardRail, { backgroundColor: accentColor }]}
        accessibilityElementsHidden
      />

      <View style={styles.cardBody}>
        {/* Header: tile + name + status */}
        <View style={styles.typeRow}>
          <View
            style={[
              styles.typeIconTile,
              {
                backgroundColor: accentBg,
                borderColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(14,58,35,0.06)",
              },
            ]}
          >
            <Text style={styles.typeEmoji}>{theme.emoji}</Text>
          </View>
          <View style={styles.typeInfo}>
            <Text
              style={[styles.typeName, { color: colors.text }]}
              numberOfLines={1}
            >
              {shift.shiftType.name}
            </Text>
            <View style={styles.locationRow}>
              <Ionicons
                name="location-outline"
                size={11}
                color={colors.textSecondary}
              />
              <Text
                style={[styles.typeLocation, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {shift.location}
              </Text>
            </View>
          </View>
          {isUserSignedUp ? (
            <StatusBadge status={displayStatus!} isDark={isDark} />
          ) : isPast ? (
            <StatusBadge status="COMPLETED" isDark={isDark} />
          ) : (
            <SpotsBadge
              spotsLeft={spotsLeft}
              isFull={isFull}
              isUrgent={isUrgent}
              isDark={isDark}
            />
          )}
        </View>

        {/* Hero time row */}
        <View style={styles.timeHeroRow}>
          <Text
            style={[styles.timeHeroText, { color: colors.text }]}
            numberOfLines={1}
          >
            {timeRange}
          </Text>
          <View
            style={[
              styles.durationChip,
              {
                backgroundColor: isDark
                  ? "rgba(248, 251, 105, 0.14)"
                  : Brand.accentSubtle,
                borderColor: isDark
                  ? "rgba(248, 251, 105, 0.2)"
                  : "rgba(14,58,35,0.08)",
              },
            ]}
          >
            <Text
              style={[
                styles.durationChipText,
                { color: isDark ? Brand.accent : Brand.green },
              ]}
            >
              {duration}
            </Text>
          </View>
        </View>

        {/* Capacity meta line */}
        <View style={styles.capacityRow}>
          <View
            style={[
              styles.capacityDot,
              {
                backgroundColor: isPast
                  ? isDark
                    ? "rgba(255,255,255,0.25)"
                    : "#cbd5e1"
                  : isFull
                  ? isDark
                    ? "#fca5a5"
                    : "#dc2626"
                  : isUrgent
                  ? isDark
                    ? "#fbbf24"
                    : "#d97706"
                  : isDark
                  ? "#86efac"
                  : "#16a34a",
              },
            ]}
          />
          <Text style={[styles.capacityText, { color: colors.textSecondary }]}>
            {shift.signedUp}/{shift.capacity} volunteers
            {!isPast && (
              <>
                {" · "}
                <Text
                  style={{
                    color: isFull
                      ? isDark
                        ? "#fca5a5"
                        : "#dc2626"
                      : isUrgent
                      ? isDark
                        ? "#fbbf24"
                        : "#d97706"
                      : colors.textSecondary,
                    fontFamily: FontFamily.semiBold,
                  }}
                >
                  {isFull ? "shift full" : `${spotsLeft} open`}
                </Text>
              </>
            )}
          </Text>
        </View>

        {/* Notes — subtle line */}
        {shift.notes && (
          <Text style={[styles.notesText, { color: colors.textSecondary }]}>
            {shift.notes}
          </Text>
        )}

        {/* Friends bar — only when there are friends on this exact role */}
        {friends.length > 0 && (
          <>
            <View style={[styles.cardDivider, { borderColor: dividerColor }]} />
            <View style={styles.friendsBar}>
              <FriendAvatarStack
                friends={friends}
                isDark={isDark}
                size={28}
                maxShow={4}
                borderColor={cardBg}
                accentColor={accentColor}
              />
              <Text
                style={[styles.friendsBarText, { color: colors.text }]}
                numberOfLines={1}
              >
                {friendsLine(friends, isUserSignedUp)}
              </Text>
            </View>
          </>
        )}
      </View>
    </Pressable>
  );
}

/* ── Status Badge ── */

function StatusBadge({ status, isDark }: { status: string; isDark: boolean }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: isDark ? config.bgDark : config.bg },
      ]}
    >
      <Ionicons
        name={config.icon}
        size={12}
        color={isDark ? config.textDark : config.text}
      />
      <Text
        style={[
          styles.badgeText,
          { color: isDark ? config.textDark : config.text },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

/* ── Spots Badge ── */

function SpotsBadge({
  spotsLeft,
  isFull,
  isUrgent,
  isDark,
}: {
  spotsLeft: number;
  isFull: boolean;
  isUrgent: boolean;
  isDark: boolean;
}) {
  let icon: keyof typeof Ionicons.glyphMap;
  let bg: string;
  let textColor: string;
  let label: string;

  if (isFull) {
    icon = "close-circle";
    bg = isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2";
    textColor = isDark ? "#fca5a5" : "#dc2626";
    label = "Full";
  } else if (isUrgent) {
    icon = "alert-circle";
    bg = isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb";
    textColor = isDark ? "#fbbf24" : "#d97706";
    label = `${spotsLeft} left`;
  } else {
    icon = "people";
    bg = isDark ? "rgba(13, 148, 136, 0.15)" : "#f0fdfa";
    textColor = isDark ? "#5eead4" : "#0d9488";
    label = `${spotsLeft} left`;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={12} color={textColor} />
      <Text style={[styles.badgeText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 24 },

  // Header
  header: {
    paddingHorizontal: 20,
    gap: 4,
    marginBottom: 4,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  // Location pill (header)
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 180,
  },
  locationPillText: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
    maxWidth: 120,
  },

  // Location picker sheet (pageSheet)
  sheetPage: { flex: 1 },
  sheetHandleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: FontFamily.heading,
    letterSpacing: 0.2,
    lineHeight: 26,
  },
  sheetSubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginTop: 2,
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetList: {
    paddingHorizontal: 12,
    gap: 2,
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
  },
  sheetItemText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },

  // Next shift pill
  nextShiftPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 20,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  nextShiftIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  nextShiftEmoji: { fontSize: 20 },
  nextShiftText: { flex: 1, gap: 1 },
  nextShiftLabel: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  nextShiftName: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    lineHeight: 20,
  },
  nextShiftMeta: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    lineHeight: 16,
    marginTop: 1,
  },

  // Calendar card
  calendarCard: {
    marginHorizontal: 20,
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },

  // Date nav
  dateNavRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 18,
    gap: 12,
  },
  dateNavButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dateNavLabelContainer: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  dateNavPrimary: {
    fontSize: 18,
    fontFamily: FontFamily.heading,
    letterSpacing: 0.2,
  },
  dateNavRelativeRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  dateNavRelativePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  dateNavRelativeText: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.3,
  },

  // Empty states
  emptyState: {
    alignItems: "center",
    paddingVertical: 56,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },

  // Day empty
  dayEmpty: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 40,
    marginTop: 8,
    gap: 10,
  },
  dayEmptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  dayEmptyTitle: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    textAlign: "center",
  },
  dayEmptySubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    textAlign: "center",
  },

  // Shift list
  shiftList: {
    marginTop: 20,
    paddingHorizontal: 20,
    gap: 16,
  },

  // Period sub-groups
  periodGroup: { gap: 12 },
  periodHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 2,
  },
  periodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  periodChipText: {
    fontSize: 10.5,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  periodRule: {
    flex: 1,
    height: 1,
  },
  periodFriendsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  periodMetaText: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.3,
  },
  dayCards: { gap: 14 },

  // Friend avatars (shared)
  friendAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendAvatar: {
    borderWidth: 2,
  },
  friendAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  friendInitial: {
    fontFamily: FontFamily.bold,
  },
  friendOverflow: {
    fontFamily: FontFamily.bold,
    letterSpacing: 0.2,
  },

  // Card
  card: {
    flexDirection: "row",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 4,
  },
  cardRail: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 14,
  },

  // Type row
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  typeIconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  typeEmoji: { fontSize: 22 },
  typeInfo: { flex: 1, gap: 3 },
  typeName: {
    fontSize: 19,
    fontFamily: FontFamily.heading,
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  typeLocation: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    lineHeight: 16,
    letterSpacing: 0.1,
  },

  // Hero time row
  timeHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2,
  },
  timeHeroText: {
    flex: 1,
    fontSize: 20,
    fontFamily: FontFamily.heading,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  durationChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  durationChipText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  // Capacity row
  capacityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -4,
  },
  capacityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  capacityText: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    letterSpacing: 0.2,
  },

  notesText: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    fontStyle: "italic",
  },

  // Divider between card body and friends bar
  cardDivider: {
    borderTopWidth: 1,
    borderStyle: "dashed",
    marginTop: 2,
    marginHorizontal: -2,
  },

  // Friends bar at the base of each card
  friendsBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: -2,
  },
  friendsBarText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.1,
  },

  // Badge
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
  },

  // Loading more
  loadingMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },
  loadingMoreText: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
});
