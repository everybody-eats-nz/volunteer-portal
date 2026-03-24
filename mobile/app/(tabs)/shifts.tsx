import { Ionicons } from "@expo/vector-icons";
import {
  formatDistanceToNowStrict,
  differenceInMinutes,
  isToday,
  isTomorrow,
  isYesterday,
  startOfDay,
} from "date-fns";
import { formatNZT } from "@/lib/dates";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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

import { ThemedText } from "@/components/themed-text";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useShifts, type PeriodFriend } from "@/hooks/use-shifts";
import {
  getShiftThemeByName,
  type Shift,
} from "@/lib/dummy-data";

type Tab = "upcoming" | "browse" | "past";

type PeriodSubGroup = {
  periodKey: string; // "YYYY-MM-DD-DAY" or "YYYY-MM-DD-EVE"
  periodLabel: string; // "Day" or "Evening"
  shifts: Shift[];
};

type ShiftGroup = {
  key: string;
  label: string;
  relativeLabel: string;
  shifts: Shift[];
  periods: PeriodSubGroup[];
};

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

/** Group shifts by calendar day, then split each day into Day/Evening sub-groups */
function groupShiftsByDay(
  shifts: Shift[],
  order: "asc" | "desc" = "asc"
): ShiftGroup[] {
  const map = new Map<string, Shift[]>();

  for (const shift of shifts) {
    const day = startOfDay(new Date(shift.start));
    const key = day.toISOString();
    const existing = map.get(key);
    if (existing) {
      existing.push(shift);
    } else {
      map.set(key, [shift]);
    }
  }

  const sorted = Array.from(map.entries()).sort(([a], [b]) =>
    order === "asc" ? a.localeCompare(b) : b.localeCompare(a)
  );

  return sorted.map(([key, dayShifts]) => {
    const date = new Date(key);
    const label = formatNZT(date, "EEEE, d MMMM");
    const dateStr = formatNZT(date, "yyyy-MM-dd");
    let relativeLabel: string;
    if (isToday(date)) {
      relativeLabel = "Today";
    } else if (isTomorrow(date)) {
      relativeLabel = "Tomorrow";
    } else if (isYesterday(date)) {
      relativeLabel = "Yesterday";
    } else {
      relativeLabel = formatDistanceToNowStrict(date, { addSuffix: true });
    }

    // Split into Day / Evening sub-groups
    const dayPeriod = dayShifts.filter(isShiftDay);
    const evePeriod = dayShifts.filter((s) => !isShiftDay(s));
    const periods: PeriodSubGroup[] = [];
    if (dayPeriod.length > 0) {
      periods.push({ periodKey: `${dateStr}-DAY`, periodLabel: "Day", shifts: dayPeriod });
    }
    if (evePeriod.length > 0) {
      periods.push({ periodKey: `${dateStr}-EVE`, periodLabel: "Evening", shifts: evePeriod });
    }

    return { key, label, relativeLabel, shifts: dayShifts, periods };
  });
}

/* ── Tab Config (count is dynamic, see component) ── */

type TabDef = { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; iconOutline: keyof typeof Ionicons.glyphMap };

const TAB_DEFS: TabDef[] = [
  { key: "upcoming", label: "My Shifts", icon: "calendar", iconOutline: "calendar-outline" },
  { key: "browse", label: "Browse", icon: "compass", iconOutline: "compass-outline" },
  { key: "past", label: "Past", icon: "time", iconOutline: "time-outline" },
];

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

/* ── Empty State Config ── */

const EMPTY_CONFIG: Record<Tab, { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }> = {
  upcoming: {
    icon: "leaf-outline",
    title: "No upcoming shifts yet",
    subtitle: "Browse available shifts to sign up",
  },
  browse: {
    icon: "compass-outline",
    title: "No open shifts right now",
    subtitle: "Check back soon — new shifts are added regularly",
  },
  past: {
    icon: "time-outline",
    title: "No past shifts yet",
    subtitle: "Your completed shifts will appear here",
  },
};

const FOOTER_HINTS: Record<Tab, string> = {
  upcoming: "Tap a shift for details and check-in",
  browse: "Tap to sign up and join the wh\u0101nau",
  past: "Tap to view your past shift details",
};

/* ── Main Screen ── */

export default function ShiftsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: Tab }>();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab === "browse" || initialTab === "past" ? initialTab : "upcoming");
  const {
    myShifts,
    available,
    past,
    isLoading,
    error,
    refresh,
    loadMoreAvailable,
    loadMorePast,
    hasMoreAvailable,
    hasMorePast,
    isLoadingMore,
    userPreferredLocations,
    periodFriends,
  } = useShifts();

  /* ── Location Filter ── */
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const hasSetDefault = useRef(false);

  // Default to user's preferred location (matching web app behaviour)
  // Only auto-filter when they have exactly 1 preferred location
  useEffect(() => {
    if (hasSetDefault.current || userPreferredLocations.length === 0) return;
    if (userPreferredLocations.length === 1) {
      setLocationFilter(userPreferredLocations[0]);
    }
    hasSetDefault.current = true;
  }, [userPreferredLocations]);

  // Extract unique locations from all shifts for the menu
  const locations = useMemo(() => {
    const allShifts = [...myShifts, ...available, ...past];
    return [...new Set(allShifts.map((s) => s.location))].sort();
  }, [myShifts, available, past]);

  // Filter browse & past by location (My Shifts always shows all)
  const filteredAvailable = useMemo(
    () => locationFilter ? available.filter((s) => s.location === locationFilter) : available,
    [available, locationFilter]
  );
  const filteredPast = useMemo(
    () => locationFilter ? past.filter((s) => s.location === locationFilter) : past,
    [past, locationFilter]
  );

  const showLocationMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "ios") {
      const options = ["All Locations", ...locations, "Cancel"];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          title: "Filter by location",
        },
        (buttonIndex) => {
          if (buttonIndex === 0) setLocationFilter(null);
          else if (buttonIndex < options.length - 1) {
            setLocationFilter(locations[buttonIndex - 1]);
          }
        }
      );
    } else {
      setShowLocationPicker(true);
    }
  }, [locations]);

  /* ── Scroll & Data ── */

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;
      if (distanceFromBottom < 300) {
        if (activeTab === "browse" && hasMoreAvailable) {
          loadMoreAvailable();
        } else if (activeTab === "past" && hasMorePast) {
          loadMorePast();
        }
      }
    },
    [activeTab, hasMoreAvailable, hasMorePast, loadMoreAvailable, loadMorePast]
  );

  const flatShifts =
    activeTab === "upcoming"
      ? myShifts
      : activeTab === "browse"
        ? filteredAvailable
        : filteredPast;

  const tabCounts: Record<Tab, number> = {
    upcoming: myShifts.length,
    browse: filteredAvailable.length,
    past: filteredPast.length,
  };

  const groupedShifts = useMemo(() => {
    if (activeTab === "upcoming") return null;
    return groupShiftsByDay(
      activeTab === "browse" ? filteredAvailable : filteredPast,
      activeTab === "past" ? "desc" : "asc"
    );
  }, [activeTab, filteredAvailable, filteredPast]);

  const handleTabChange = (tab: Tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  const emptyConfig = EMPTY_CONFIG[activeTab];
  const isEmpty = !isLoading && flatShifts.length === 0;

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={400}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <ThemedText type="title">Shifts</ThemedText>
          <Pressable
            onPress={showLocationMenu}
            style={[
              styles.locationFilter,
              {
                backgroundColor: locationFilter
                  ? (isDark ? 'rgba(29, 83, 55, 0.3)' : Brand.greenLight)
                  : (isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
                borderColor: locationFilter
                  ? (isDark ? 'rgba(29, 83, 55, 0.5)' : '#b8dbb8')
                  : (isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'),
              },
            ]}
            accessibilityLabel={`Filter by location. Currently: ${locationFilter ?? 'All locations'}`}
            accessibilityRole="button"
          >
            <Ionicons
              name="location"
              size={13}
              color={locationFilter ? (isDark ? '#86efac' : Brand.green) : colors.textSecondary}
            />
            <Text
              style={[
                styles.locationFilterText,
                { color: locationFilter ? (isDark ? '#86efac' : Brand.green) : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {locationFilter ?? 'All'}
            </Text>
            <Ionicons
              name="chevron-down"
              size={11}
              color={locationFilter ? (isDark ? '#86efac' : Brand.green) : colors.textSecondary}
            />
          </Pressable>
        </View>
        <ThemedText type="caption" style={{ color: colors.textSecondary }}>
          Your shifts and open opportunities
        </ThemedText>
      </View>

      {/* ── Segmented Tabs ── */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: isDark ? colors.card : "#f1f5f9" },
        ]}
      >
        {TAB_DEFS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = tabCounts[tab.key];
          return (
            <Pressable
              key={tab.key}
              onPress={() => handleTabChange(tab.key)}
              style={[styles.tab, isActive && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Ionicons
                name={isActive ? tab.icon : tab.iconOutline}
                size={16}
                color={isActive ? "#ffffff" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? "#ffffff" : colors.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
              <View
                style={[
                  styles.tabCountBadge,
                  {
                    backgroundColor: isActive
                      ? "rgba(255,255,255,0.25)"
                      : isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.06)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabCountText,
                    { color: isActive ? "#ffffff" : colors.textSecondary },
                  ]}
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* ── Error State ── */}
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
            Couldn't load shifts
          </ThemedText>
          <ThemedText
            type="caption"
            style={{ color: colors.textSecondary, textAlign: "center" }}
          >
            Pull down to try again
          </ThemedText>
        </View>
      )}

      {/* ── Initial Loading State ── */}
      {isLoading && flatShifts.length === 0 && !error && (
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

      {/* ── Empty State ── */}
      {isEmpty && !error && (
        <View style={styles.emptyState}>
          <View
            style={[
              styles.emptyIconCircle,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <Ionicons
              name={emptyConfig.icon}
              size={32}
              color={colors.primary}
            />
          </View>
          <ThemedText type="subtitle" style={{ textAlign: "center" }}>
            {emptyConfig.title}
          </ThemedText>
          <ThemedText
            type="caption"
            style={{ color: colors.textSecondary, textAlign: "center" }}
          >
            {emptyConfig.subtitle}
          </ThemedText>
        </View>
      )}

      {/* ── Shift Cards ── */}
      {activeTab === "upcoming" ? (
        /* Upcoming: flat list (no day grouping needed — small list) */
        <View style={styles.shiftList}>
          {flatShifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              colors={colors}
              isDark={isDark}
              showStatus
            />
          ))}
        </View>
      ) : (
        /* Browse & Past: grouped by day → Day/Evening sub-groups */
        <View style={styles.shiftList}>
          {groupedShifts?.map((group) => (
            <View key={group.key} style={styles.dayGroup}>
              {/* Day header */}
              <View style={styles.dayHeader}>
                <Text style={[styles.dayHeaderLabel, { color: colors.text }]}>
                  {group.label}
                </Text>
                <View
                  style={[
                    styles.dayHeaderPill,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "#f1f5f9",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayHeaderRelative,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {group.relativeLabel}
                  </Text>
                </View>
              </View>

              {/* Period sub-groups (Day / Evening) */}
              {group.periods.map((period) => {
                const friends = periodFriends[period.periodKey] ?? [];
                return (
                  <View key={period.periodKey} style={styles.periodGroup}>
                    {/* Period header with friend avatars */}
                    {group.periods.length > 1 && (
                      <View style={styles.periodHeader}>
                        <Ionicons
                          name={period.periodLabel === "Day" ? "sunny-outline" : "moon-outline"}
                          size={14}
                          color={colors.textSecondary}
                        />
                        <Text style={[styles.periodLabel, { color: colors.textSecondary }]}>
                          {period.periodLabel}
                        </Text>
                        {friends.length > 0 && (
                          <FriendAvatarRow friends={friends} isDark={isDark} />
                        )}
                      </View>
                    )}
                    {/* Show friends row even when only 1 period, just without the label */}
                    {group.periods.length === 1 && friends.length > 0 && (
                      <FriendAvatarRow friends={friends} isDark={isDark} />
                    )}

                    {/* Shift cards */}
                    <View style={styles.dayCards}>
                      {period.shifts.map((shift) => (
                        <ShiftCard
                          key={shift.id}
                          shift={shift}
                          colors={colors}
                          isDark={isDark}
                          showStatus={activeTab === "past"}
                          compact={activeTab === "past"}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {/* ── Loading More Indicator ── */}
      {isLoadingMore && (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>
            Loading more shifts...
          </Text>
        </View>
      )}

      {/* ── Footer Hint ── */}
      {!isEmpty && !isLoadingMore && (
        <View style={styles.footer}>
          <Ionicons
            name="hand-right-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {FOOTER_HINTS[activeTab]}
          </Text>
        </View>
      )}
    </ScrollView>

    {/* ── Android Location Picker Modal ── */}
    {Platform.OS !== "ios" && (
      <Modal
        visible={showLocationPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLocationPicker(false)}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? '#1e2328' : '#ffffff' },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Filter by location
            </Text>
            {[null, ...locations].map((loc) => {
              const isSelected = locationFilter === loc;
              return (
                <Pressable
                  key={loc ?? "all"}
                  style={[
                    styles.modalOption,
                    isSelected && {
                      backgroundColor: isDark
                        ? "rgba(29, 83, 55, 0.2)"
                        : Brand.greenLight,
                    },
                  ]}
                  onPress={() => {
                    setLocationFilter(loc);
                    setShowLocationPicker(false);
                  }}
                >
                  <Ionicons
                    name={loc ? "location" : "globe-outline"}
                    size={18}
                    color={isSelected ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.modalOptionText,
                      { color: isSelected ? colors.primary : colors.text },
                    ]}
                  >
                    {loc ?? "All Locations"}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    )}
    </>
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
              style={[styles.friendAvatar, { borderColor: isDark ? "#0f1114" : Brand.warmWhite }]}
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
              <Text style={[styles.friendInitial, { color: isDark ? "#86efac" : Brand.green }]}>
                {friend.name.charAt(0)}
              </Text>
            </View>
          )}
        </View>
      ))}
      {overflow > 0 && (
        <View
          style={[
            styles.friendAvatarWrap,
            { marginLeft: -8, zIndex: 0 },
          ]}
        >
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
            <Text style={[styles.friendOverflow, { color: isDark ? "#94a3b8" : "#64748b" }]}>
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
  compact,
}: {
  shift: Shift;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  showStatus?: boolean;
  compact?: boolean;
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

  const timeUntil = formatDistanceToNowStrict(date, { addSuffix: true });

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/shift/${shift.id}` as Href);
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: isDark ? '#1e2328' : '#ffffff',
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e4dfd7',
          shadowColor: isDark ? '#000' : '#94a3b8',
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
      accessibilityLabel={`${shift.shiftType.name} at ${shift.location}, ${formatNZT(date, "EEEE d MMMM")}`}
      accessibilityRole="button"
    >
      {/* Top accent bar — matches web card gradient treatment */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      {/* Card body */}
      <View style={styles.cardBody}>
        {/* Row 1: Emoji badge + Name + Status */}
        <View style={styles.typeRow}>
          <View style={[styles.typeIconCircle, { backgroundColor: accentColor }]}>
            <Text style={styles.typeEmoji}>{theme.emoji}</Text>
          </View>
          <View style={styles.typeInfo}>
            <Text
              style={[styles.typeName, { color: compact ? colors.textSecondary : colors.text }]}
              numberOfLines={1}
            >
              {shift.shiftType.name}
            </Text>
            {/* Date line (inline with title for non-compact) */}
            {!compact && (
              <Text style={[styles.typeDate, { color: colors.textSecondary }]}>
                {formatNZT(date, "EEE, d MMM")} · {timeUntil}
              </Text>
            )}
          </View>
          {showStatus && shift.status ? (
            <StatusBadge status={shift.status} isDark={isDark} />
          ) : !compact ? (
            <SpotsBadge
              spotsLeft={spotsLeft}
              isFull={isFull}
              isUrgent={isUrgent}
              isDark={isDark}
            />
          ) : null}
        </View>

        {/* Info boxes — time and capacity in subtle pill containers */}
        {!compact ? (
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
                <Text style={[
                  styles.infoBoxSecondary,
                  {
                    color: isFull
                      ? (isDark ? '#fca5a5' : '#dc2626')
                      : isUrgent
                        ? (isDark ? '#fbbf24' : '#d97706')
                        : (isDark ? '#86efac' : '#16a34a'),
                    fontFamily: FontFamily.semiBold,
                  },
                ]}>
                  {isFull ? 'Full' : `${spotsLeft} spots left`}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          /* Compact: inline time + location + duration */
          <View style={styles.compactDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                {formatNZT(date, "h:mm a")} – {formatNZT(endDate, "h:mm a")}
              </Text>
            </View>
            <View style={[styles.detailDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1' }]} />
            <View style={[styles.durationChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}>
              <Text style={[styles.durationChipText, { color: colors.textSecondary }]}>{duration}</Text>
            </View>
            <View style={[styles.detailDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1' }]} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {shift.signedUp}/{shift.capacity}
            </Text>
          </View>
        )}

        {/* Location row */}
        {!compact && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>
              {shift.location}
            </Text>
          </View>
        )}

        {/* Notes / description */}
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

function StatusBadge({
  status,
  isDark,
}: {
  status: string;
  isDark: boolean;
}) {
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
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    gap: 4,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationFilter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  locationFilterText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    maxWidth: 100,
  },

  // Segmented Tabs
  tabBar: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 3,
    marginHorizontal: 20,
    gap: 3,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 11,
    gap: 5,
  },
  tabActive: {
    backgroundColor: Brand.green,
  },
  tabText: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },
  tabCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  tabCountText: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
  },

  // Empty State
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

  // Shift List
  shiftList: {
    marginTop: 20,
    paddingHorizontal: 20,
    gap: 16,
  },

  // Day group (browse & past)
  dayGroup: {
    gap: 12,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
dayHeaderLabel: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    flex: 1,
  },
  dayHeaderPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dayHeaderRelative: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
  },
  dayCards: {
    gap: 12,
  },

  // Period sub-groups (Day / Evening)
  periodGroup: {
    gap: 10,
  },
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
  accentBar: {
    height: 4,
  },
  cardBody: {
    padding: 18,
    gap: 16,
  },

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
  typeEmoji: {
    fontSize: 20,
  },
  typeInfo: {
    flex: 1,
    gap: 3,
  },
  typeName: {
    fontSize: 17,
    fontFamily: FontFamily.semiBold,
    lineHeight: 22,
  },
  typeDate: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },

  // Info box row (time + capacity side by side)
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

  // Location row
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    flex: 1,
  },

  // Compact details (past shifts)
  compactDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 58,
  },

  // Shared detail elements
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
  detailDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 2,
  },
  durationChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  durationChipText: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
  },

  // Notes text
  notesText: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },

  // Badge (shared)
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

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 24,
    paddingHorizontal: 32,
  },
  footerText: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    textAlign: "center",
  },

  // Android location picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    marginBottom: 12,
    textAlign: "center",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  modalOptionText: {
    fontSize: 16,
    fontFamily: FontFamily.regular,
    flex: 1,
  },
});
