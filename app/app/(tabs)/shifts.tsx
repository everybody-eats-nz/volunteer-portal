import { Ionicons } from "@expo/vector-icons";
import {
  format,
  formatDistanceToNowStrict,
  differenceInMinutes,
  isToday,
  isTomorrow,
  isYesterday,
  startOfDay,
} from "date-fns";
import * as Haptics from "expo-haptics";
import { useRouter, type Href } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useShifts } from "@/hooks/use-shifts";
import {
  getShiftThemeByName,
  type Shift,
} from "@/lib/dummy-data";

type Tab = "upcoming" | "browse" | "past";

type ShiftGroup = {
  key: string;
  label: string;
  relativeLabel: string;
  shifts: Shift[];
};

function getDuration(start: string, end: string): string {
  const mins = differenceInMinutes(new Date(end), new Date(start));
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

/** Group shifts by calendar day */
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
    const label = format(date, "EEEE, d MMMM");
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
    return { key, label, relativeLabel, shifts: dayShifts };
  });
}

/* ── Tab Config (count is dynamic, see component) ── */

type TabDef = { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; iconOutline: keyof typeof Ionicons.glyphMap };

const TAB_DEFS: TabDef[] = [
  { key: "upcoming", label: "My Mahi", icon: "calendar", iconOutline: "calendar-outline" },
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
    title: "No upcoming mahi yet",
    subtitle: "Browse available shifts to sign up",
  },
  browse: {
    icon: "compass-outline",
    title: "No open shifts right now",
    subtitle: "Check back soon \u2014 new mahi is added regularly",
  },
  past: {
    icon: "time-outline",
    title: "No past mahi yet",
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
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");
  const { myShifts, available, past, isLoading, error, refresh } = useShifts();

  const flatShifts =
    activeTab === "upcoming"
      ? myShifts
      : activeTab === "browse"
        ? available
        : past;

  const tabCounts: Record<Tab, number> = {
    upcoming: myShifts.length,
    browse: available.length,
    past: past.length,
  };

  const groupedShifts = useMemo(() => {
    if (activeTab === "upcoming") return null;
    return groupShiftsByDay(
      activeTab === "browse" ? available : past,
      activeTab === "past" ? "desc" : "asc"
    );
  }, [activeTab, available, past]);

  const handleTabChange = (tab: Tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  const emptyConfig = EMPTY_CONFIG[activeTab];
  const isEmpty = !isLoading && flatShifts.length === 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
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
        <ThemedText type="title">Mahi</ThemedText>
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
        /* Browse & Past: grouped by day */
        <View style={styles.shiftList}>
          {groupedShifts?.map((group) => (
            <View key={group.key} style={styles.dayGroup}>
              {/* Day header */}
              <View style={styles.dayHeader}>
                <View
                  style={[
                    styles.dayHeaderDot,
                    { backgroundColor: isDark ? colors.primary : Brand.green },
                  ]}
                />
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

              {/* Shift cards for this day */}
              <View style={styles.dayCards}>
                {group.shifts.map((shift) => (
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
          ))}
        </View>
      )}

      {/* ── Footer Hint ── */}
      {!isEmpty && (
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
          backgroundColor: colors.card,
          shadowColor: isDark ? "#000" : "#64748b",
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
      accessibilityLabel={`${shift.shiftType.name} at ${shift.location}, ${format(date, "EEEE d MMMM")}`}
      accessibilityRole="button"
    >
      {/* Left accent strip */}
      <View
        style={[
          styles.accentStrip,
          { backgroundColor: compact ? (isDark ? "rgba(255,255,255,0.1)" : "#cbd5e1") : accentColor },
        ]}
      />

      {/* Card body */}
      <View style={styles.cardBody}>
        {/* Row 1: Emoji + Name + Badge */}
        <View style={styles.typeRow}>
          <View style={[styles.typeIconCircle, { backgroundColor: accentBg }]}>
            <Text style={styles.typeEmoji}>{theme.emoji}</Text>
          </View>
          <Text
            style={[styles.typeName, { color: compact ? colors.textSecondary : colors.text }]}
            numberOfLines={1}
          >
            {shift.shiftType.name}
          </Text>
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

        {/* Row 2: Time + Location (compact cards skip the full date since the day header has it) */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons
              name="time-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.detailText, { color: colors.textSecondary }]}
            >
              {format(date, "h:mm a")} – {format(endDate, "h:mm a")}
            </Text>
          </View>
          <View
            style={[
              styles.detailDivider,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.15)"
                  : "#cbd5e1",
              },
            ]}
          />
          <View style={styles.detailItem}>
            <Ionicons
              name="location-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.detailText, { color: colors.textSecondary }]}
            >
              {shift.location}
            </Text>
          </View>
        </View>

        {/* Row 3: Duration chip + relative time (skip for compact/past) */}
        {!compact && (
          <View style={styles.dateRow}>
            <Text style={[styles.dateText, { color: colors.text }]}>
              {format(date, "EEEE, d MMMM")}
            </Text>
            <View style={styles.dateRowRight}>
              <View
                style={[styles.durationChip, { backgroundColor: accentBg }]}
              >
                <Text
                  style={[styles.durationChipText, { color: accentColor }]}
                >
                  {duration}
                </Text>
              </View>
              <Text
                style={[styles.relativeTime, { color: colors.textSecondary }]}
              >
                {timeUntil}
              </Text>
            </View>
          </View>
        )}

        {/* Duration chip inline for compact cards */}
        {compact && (
          <View style={[styles.compactMeta, { paddingLeft: 42 }]}>
            <View
              style={[styles.durationChip, { backgroundColor: accentBg }]}
            >
              <Text style={[styles.durationChipText, { color: accentColor }]}>
                {duration}
              </Text>
            </View>
            <Text
              style={[styles.capacityText, { color: colors.textSecondary }]}
            >
              {shift.signedUp}/{shift.capacity} volunteers
            </Text>
          </View>
        )}

        {/* Row 4: Capacity bar (skip for compact/past) */}
        {!compact && (
          <View style={styles.capacityRow}>
            <View
              style={[
                styles.capacityBar,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "#f1f5f9",
                },
              ]}
            >
              <View
                style={[
                  styles.capacityFill,
                  {
                    width: `${Math.min((shift.signedUp / shift.capacity) * 100, 100)}%`,
                    backgroundColor: isFull
                      ? colors.destructive
                      : isUrgent
                        ? "#d97706"
                        : accentColor,
                  },
                ]}
              />
            </View>
            <Text
              style={[styles.capacityText, { color: colors.textSecondary }]}
            >
              {shift.signedUp}/{shift.capacity}
            </Text>
          </View>
        )}

        {/* Optional: Notes callout */}
        {shift.notes && (
          <View
            style={[
              styles.notesCallout,
              {
                backgroundColor: isDark
                  ? "rgba(217, 119, 6, 0.1)"
                  : "#fffbeb",
              },
            ]}
          >
            <Ionicons
              name="information-circle-outline"
              size={14}
              color={isDark ? "#fbbf24" : "#b45309"}
            />
            <Text
              style={[
                styles.notesText,
                { color: isDark ? "#fbbf24" : "#92400e" },
              ]}
            >
              {shift.notes}
            </Text>
          </View>
        )}
      </View>

      {/* Chevron */}
      <View style={styles.chevronContainer}>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.textSecondary}
        />
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
    gap: 12,
  },

  // Day group (browse & past)
  dayGroup: {
    gap: 10,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  dayHeaderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
    gap: 10,
  },

  // Card
  card: {
    flexDirection: "row",
    borderRadius: 16,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  accentStrip: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: 16,
    gap: 10,
  },

  // Type row
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  typeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  typeEmoji: {
    fontSize: 16,
  },
  typeName: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    flex: 1,
  },

  // Date row
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: 42,
  },
  dateRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  dateText: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
  },
  relativeTime: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },

  // Compact meta row (past shifts)
  compactMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  // Details row
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 42,
    gap: 6,
  },
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

  // Capacity
  capacityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 42,
    gap: 10,
  },
  capacityBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  capacityFill: {
    height: "100%",
    borderRadius: 3,
  },
  capacityText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    minWidth: 28,
    textAlign: "right",
  },

  // Notes callout
  notesCallout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 42,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  notesText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    flex: 1,
  },

  // Chevron
  chevronContainer: {
    justifyContent: "center",
    paddingRight: 14,
    paddingLeft: 4,
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
});
