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
import {
  getShiftThemeByName,
  type Shift,
} from "@/lib/dummy-data";

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
    periods.push({ periodKey: `${dateStr}-DAY`, periodLabel: "Day", shifts: dayPeriod });
  }
  if (evePeriod.length > 0) {
    periods.push({ periodKey: `${dateStr}-EVE`, periodLabel: "Evening", shifts: evePeriod });
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
    userPreferredLocations,
    periodFriends,
  } = useShifts();

  /* Silent location default — applies user's preferred location without surfacing a picker */
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const hasSetDefault = useRef(false);

  useEffect(() => {
    if (hasSetDefault.current || userPreferredLocations.length === 0) return;
    if (userPreferredLocations.length === 1) {
      setLocationFilter(userPreferredLocations[0]);
    }
    hasSetDefault.current = true;
  }, [userPreferredLocations]);

  const filteredAvailable = useMemo(
    () =>
      locationFilter ? available.filter((s) => s.location === locationFilter) : available,
    [available, locationFilter]
  );

  /* Available locations across all shifts — used by the picker */
  const locations = useMemo(() => {
    const all = [...myShifts, ...available, ...past];
    return [...new Set(all.map((s) => s.location))].sort();
  }, [myShifts, available, past]);

  const [pickerVisible, setPickerVisible] = useState(false);

  /* Selected date (default today) */
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
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
      (s) => formatDateKey(new Date(s.start)) === selectedDateKey && !mineIds.has(s.id)
    );
    return [...mine, ...avail];
  }, [myShifts, past, filteredAvailable, selectedDateKey]);

  const selectedDayPeriods = useMemo(
    () => splitDayPeriods(selectedDayShifts, selectedDateKey),
    [selectedDayShifts, selectedDateKey]
  );

  const totalDayShifts = selectedDayPeriods.reduce((sum, p) => sum + p.shifts.length, 0);

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
    setSelectedDate((d) => (delta > 0 ? addDays(d, delta) : subDays(d, -delta)));
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
    isLoading && myShifts.length === 0 && available.length === 0 && past.length === 0 && !error;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        Platform.OS === "android" && { paddingTop: insets.top },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.primary} />
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
          <View style={[styles.emptyIconCircle, { backgroundColor: "rgba(239, 68, 68, 0.1)" }]}>
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
          <DateNavHeader selectedDate={selectedDate} onNudge={nudgeDay} isDark={isDark} />

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
                <Ionicons name="leaf-outline" size={22} color={colors.textSecondary} />
              </View>
              <Text style={[styles.dayEmptyTitle, { color: colors.text }]}>
                No shifts on this day
              </Text>
              <Text style={[styles.dayEmptySubtitle, { color: colors.textSecondary }]}>
                Try another day from the calendar above
              </Text>
            </View>
          ) : (
            <View style={styles.shiftList}>
              {selectedDayPeriods.map((period) => {
                const friends = periodFriends[period.periodKey] ?? [];
                return (
                  <View key={period.periodKey} style={styles.periodGroup}>
                    <View style={styles.periodHeader}>
                      <Ionicons
                        name={period.periodLabel === "Day" ? "sunny-outline" : "moon-outline"}
                        size={14}
                        color={colors.textSecondary}
                      />
                      <Text style={[styles.periodLabel, { color: colors.textSecondary }]}>
                        {period.periodLabel}
                      </Text>
                      <Text style={[styles.periodCount, { color: colors.textSecondary }]}>
                        · {period.shifts.length}{" "}
                        {period.shifts.length === 1 ? "shift" : "shifts"}
                      </Text>
                      {friends.length > 0 && (
                        <FriendAvatarRow friends={friends} isDark={isDark} />
                      )}
                    </View>
                    <View style={styles.dayCards}>
                      {period.shifts.map((shift) => (
                        <ShiftCard
                          key={shift.id}
                          shift={shift}
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
          <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>
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
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "#f1f5f9",
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
      accessibilityLabel={`Your next shift: ${shift.shiftType.name}, ${relative} at ${formatNZT(
        date,
        "h:mm a"
      )}`}
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
        <Text style={[styles.dateNavPrimary, { color: colors.text }]}>{primary}</Text>
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

/* ── Friend Avatar Row ── */

function FriendAvatarRow({
  friends,
  isDark,
}: {
  friends: PeriodFriend[];
  isDark: boolean;
}) {
  const maxShow = 4;
  const shown = friends.slice(0, maxShow);
  const overflow = friends.length - maxShow;

  return (
    <View style={styles.friendAvatarRow}>
      {shown.map((friend, index) => (
        <View
          key={friend.id}
          style={[
            styles.friendAvatarWrap,
            { marginLeft: index === 0 ? 0 : -8, zIndex: maxShow - index },
          ]}
        >
          {friend.profilePhotoUrl ? (
            <Image
              source={{ uri: friend.profilePhotoUrl }}
              style={[
                styles.friendAvatar,
                { borderColor: isDark ? "#0f1114" : Brand.warmWhite },
              ]}
            />
          ) : (
            <View
              style={[
                styles.friendAvatar,
                styles.friendAvatarFallback,
                {
                  borderColor: isDark ? "#0f1114" : Brand.warmWhite,
                  backgroundColor: isDark ? "rgba(14,58,35,0.4)" : Brand.greenLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.friendInitial,
                  { color: isDark ? "#86efac" : Brand.green },
                ]}
              >
                {friend.name.charAt(0)}
              </Text>
            </View>
          )}
        </View>
      ))}
      {overflow > 0 && (
        <View style={[styles.friendAvatarWrap, { marginLeft: -8, zIndex: 0 }]}>
          <View
            style={[
              styles.friendAvatar,
              styles.friendAvatarFallback,
              {
                borderColor: isDark ? "#0f1114" : Brand.warmWhite,
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0",
              },
            ]}
          >
            <Text
              style={[
                styles.friendOverflow,
                { color: isDark ? "#94a3b8" : "#64748b" },
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

/* ── Shift Card ── */

function ShiftCard({
  shift,
  colors,
  isDark,
  showStatus,
}: {
  shift: Shift;
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

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/shift/${shift.id}` as Href);
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: isDark ? "#1e2328" : "#ffffff",
          borderColor: isDark ? "rgba(255,255,255,0.06)" : "#e4dfd7",
          shadowColor: isDark ? "#000" : "#94a3b8",
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
      accessibilityLabel={`${shift.shiftType.name} at ${shift.location}, ${formatNZT(
        date,
        "EEEE d MMMM"
      )}`}
      accessibilityRole="button"
    >
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      <View style={styles.cardBody}>
        <View style={styles.typeRow}>
          <View style={[styles.typeIconCircle, { backgroundColor: accentColor }]}>
            <Text style={styles.typeEmoji}>{theme.emoji}</Text>
          </View>
          <View style={styles.typeInfo}>
            <Text style={[styles.typeName, { color: colors.text }]} numberOfLines={1}>
              {shift.shiftType.name}
            </Text>
            <Text style={[styles.typeLocation, { color: colors.textSecondary }]}>
              {shift.location}
            </Text>
          </View>
          {showStatus && shift.status ? (
            <StatusBadge status={shift.status} isDark={isDark} />
          ) : (
            <SpotsBadge
              spotsLeft={spotsLeft}
              isFull={isFull}
              isUrgent={isUrgent}
              isDark={isDark}
            />
          )}
        </View>

        <View style={styles.infoBoxRow}>
          <View style={[styles.infoBox, { backgroundColor: accentBg }]}>
            <Ionicons name="time-outline" size={15} color={accentColor} />
            <View>
              <Text style={[styles.infoBoxPrimary, { color: colors.text }]}>
                {formatNZT(date, "h:mm a")}
              </Text>
              <Text style={[styles.infoBoxSecondary, { color: colors.textSecondary }]}>
                to {formatNZT(endDate, "h:mm a")} · {duration}
              </Text>
            </View>
          </View>
          <View style={[styles.infoBox, { backgroundColor: accentBg }]}>
            <Ionicons name="people-outline" size={15} color={accentColor} />
            <View>
              <Text style={[styles.infoBoxPrimary, { color: colors.text }]}>
                {shift.signedUp}/{shift.capacity}
              </Text>
              <Text
                style={[
                  styles.infoBoxSecondary,
                  {
                    color: isFull
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
                    fontFamily: FontFamily.semiBold,
                  },
                ]}
              >
                {isFull ? "Full" : `${spotsLeft} spots left`}
              </Text>
            </View>
          </View>
        </View>

        {shift.notes && (
          <Text
            style={[styles.notesText, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {shift.notes}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/* ── Status Badge ── */

function StatusBadge({ status, isDark }: { status: string; isDark: boolean }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  return (
    <View style={[styles.badge, { backgroundColor: isDark ? config.bgDark : config.bg }]}>
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
  periodGroup: { gap: 10 },
  periodHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  periodLabel: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },
  periodCount: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },
  dayCards: { gap: 12 },

  // Friend avatar row
  friendAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
  },
  friendAvatarWrap: {},
  friendAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
  },
  friendAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  friendInitial: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
  },
  friendOverflow: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
  },

  // Card
  card: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  accentBar: { height: 4 },
  cardBody: { padding: 18, gap: 16 },

  // Type row
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  typeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  typeEmoji: { fontSize: 20 },
  typeInfo: { flex: 1, gap: 3 },
  typeName: {
    fontSize: 17,
    fontFamily: FontFamily.semiBold,
    lineHeight: 22,
  },
  typeLocation: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },

  // Info box row
  infoBoxRow: {
    flexDirection: "row",
    gap: 10,
  },
  infoBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  infoBoxPrimary: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    lineHeight: 20,
  },
  infoBoxSecondary: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    lineHeight: 16,
    marginTop: 1,
  },

  notesText: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
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
