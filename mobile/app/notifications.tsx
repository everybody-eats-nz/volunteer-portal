import { useHeaderHeight } from "@react-navigation/elements";
import { Ionicons } from "@expo/vector-icons";
import {
  differenceInCalendarDays,
  formatDistanceToNowStrict,
  isToday,
  isYesterday,
} from "date-fns";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ErrorState } from "@/components/ui/state-view";
import {
  Brand,
  Colors,
  FontFamily,
  MaxFontScale,
  StatusColors,
  Tones,
  type Tone,
} from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  useNotifications,
  type AppNotification,
  type NotificationType,
} from "@/hooks/use-notifications";
import { loadErrorKind } from "@/lib/load-error";
import { navigateToNotificationTarget } from "@/lib/notification-routing";

/* ─── Icon language ──────────────────────────────────────────── */

type IconSpec = {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
};

type Scheme = "light" | "dark";

/** Each type picks its hue by meaning: a status where it has one, else a tone. */
function buildIconMap(scheme: Scheme): Record<NotificationType, IconSpec> {
  const status = StatusColors[scheme];
  const tones = Tones[scheme];
  const spec = (name: IconSpec["name"], tone: Tone): IconSpec => ({
    name,
    color: tone.fg,
    bg: tone.bg,
  });
  return {
    FRIEND_REQUEST_RECEIVED: spec("person-add", tones.blue),
    FRIEND_REQUEST_ACCEPTED: spec("people", tones.emerald),
    SHIFT_CONFIRMED: spec("checkmark-circle", status.confirmed),
    SHIFT_WAITLISTED: spec("time", status.pending),
    // An offer is good news with a deadline on it, so it reads as an
    // invitation rather than as another waiting-room update.
    SHIFT_WAITLIST_OFFER: spec("sparkles", status.confirmed),
    SHIFT_CANCELED: spec("close-circle", status.destructive),
    ACHIEVEMENT_UNLOCKED: spec("trophy", tones.sun),
    SHIFT_CANCELLATION_MANAGER: spec("warning", status.destructive),
    FLEXIBLE_PLACEMENT: spec("swap-horizontal", tones.sky),
    UNDERAGE_USER_REGISTERED: spec("alert-circle", tones.violet),
    SURVEY_ASSIGNED: spec("document-text", tones.teal),
    FEED_ITEM_LIKED: spec("heart", tones.pink),
    FEED_ITEM_COMMENTED: spec("chatbubble", tones.blue),
    FEED_ITEM_COMMENT_REPLY: spec("chatbubbles", tones.violet),
  };
}

const ICON_MAP: Record<Scheme, Record<NotificationType, IconSpec>> = {
  light: buildIconMap("light"),
  dark: buildIconMap("dark"),
};

function iconFor(type: NotificationType, scheme: Scheme): IconSpec {
  return ICON_MAP[scheme][type] ?? ICON_MAP[scheme].FRIEND_REQUEST_RECEIVED;
}

/* ─── Grouping ───────────────────────────────────────────────── */

type Section = {
  title: string;
  data: AppNotification[];
};

function bucketLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  const diff = differenceInCalendarDays(new Date(), date);
  if (diff <= 7) return "This week";
  if (diff <= 30) return "Earlier this month";
  return "Earlier";
}

function groupByDate(notifications: AppNotification[]): Section[] {
  const byLabel = new Map<string, AppNotification[]>();
  for (const n of notifications) {
    const date = new Date(n.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const label = bucketLabel(date);
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label)!.push(n);
  }
  const order = [
    "Today",
    "Yesterday",
    "This week",
    "Earlier this month",
    "Earlier",
  ];
  const out: Section[] = [];
  for (const label of order) {
    const data = byLabel.get(label);
    if (data && data.length > 0) out.push({ title: label, data });
  }
  return out;
}

/* ─── Screen ────────────────────────────────────────────────── */

export default function NotificationsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const sections = useMemo(() => groupByDate(notifications), [notifications]);

  const handleOpen = useCallback(
    (n: AppNotification) => {
      Haptics.selectionAsync();
      if (!n.isRead) markAsRead(n.id);
      if (n.actionUrl) navigateToNotificationTarget(n.actionUrl);
    },
    [markAsRead]
  );

  const handleMarkAll = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    markAllAsRead();
  }, [markAllAsRead]);

  const renderItem = useCallback(
    ({
      item,
      index,
      section,
    }: {
      item: AppNotification;
      index: number;
      section: Section;
    }) => (
      <NotificationRow
        notification={item}
        colors={colors}
        scheme={colorScheme}
        isDark={isDark}
        isLast={index === section.data.length - 1}
        onPress={() => handleOpen(item)}
      />
    ),
    [colors, colorScheme, isDark, handleOpen]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <View
        style={[styles.sectionHeader, { backgroundColor: colors.background }]}
      >
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          {section.title.toUpperCase()}
        </Text>
        <View
          style={[styles.sectionLine, { backgroundColor: colors.border }]}
        />
      </View>
    ),
    [colors.background, colors.border, colors.textSecondary]
  );

  const showHero = !isLoading && !error;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "Notifications",
          headerTransparent: true,
          headerTitleStyle: {
            fontFamily: FontFamily.heading,
            fontSize: 18,
          },
          headerRight:
            unreadCount > 0
              ? () => (
                  <Pressable
                    onPress={handleMarkAll}
                    hitSlop={12}
                    android_ripple={{ color: colors.border, borderless: true }}
                    accessibilityRole="button"
                    accessibilityLabel={`Mark all ${unreadCount} notifications as read`}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.6 : 1,
                      padding: 4,
                    })}
                  >
                    <Text
                      style={[
                        styles.headerActionText,
                        { color: colors.text },
                      ]}
                    >
                      Mark all read
                    </Text>
                  </Pressable>
                )
              : undefined,
        }}
      />

      {isLoading && notifications.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.tint} />
        </View>
      ) : error ? (
        <ErrorState
          kind={loadErrorKind(error) === "offline" ? "offline" : "error"}
          title={
            loadErrorKind(error) === "offline"
              ? undefined
              : "Couldn't load your notifications"
          }
          onRetry={refresh}
          retrying={isLoading}
          style={{ paddingTop: headerHeight }}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingTop: headerHeight,
              paddingBottom: insets.bottom + 40,
            },
            sections.length === 0 && styles.listContentEmpty,
          ]}
          ListHeaderComponent={
            showHero ? (
              <HeroHeader
                unreadCount={unreadCount}
                total={notifications.length}
                colors={colors}
                isDark={isDark}
              />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refresh}
              tintColor={colors.tint}
              colors={[colors.tint]}
              progressBackgroundColor={colors.card}
            />
          }
          ListEmptyComponent={<EmptyState colors={colors} isDark={isDark} />}
        />
      )}
    </View>
  );
}

/* ─── Hero header (warm intro block) ─────────────────────────── */

type HeroProps = {
  unreadCount: number;
  total: number;
  colors: (typeof Colors)["light"];
  isDark: boolean;
};

function HeroHeader({ unreadCount, total, colors, isDark }: HeroProps) {
  const hasUnread = unreadCount > 0;
  const subtitle = hasUnread
    ? `Kia ora, ${unreadCount} new ${
        unreadCount === 1 ? "update" : "updates"
      } for you`
    : total > 0
    ? "You\u2019re all caught up, ka pai 🌿"
    : "Nothing new yet";

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.hero}>
      <ThemedText type="display" style={styles.heroTitle}>
        {hasUnread ? (
          <>
            Something <ThemedText type="accent">new</ThemedText>
          </>
        ) : (
          "All quiet"
        )}
      </ThemedText>

      <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
        {subtitle}
      </Text>

      {hasUnread && (
        <Animated.View
          entering={FadeInDown.duration(260).delay(80)}
          style={[
            styles.heroPill,
            {
              // Dark: a soft sun glow well so the sun-yellow label stays legible.
              // Light: solid sun with near-black ink on top.
              backgroundColor: isDark ? colors.accentGlow : Brand.accent,
            },
          ]}
        >
          <View
            style={[
              styles.heroPillDot,
              { backgroundColor: isDark ? Brand.accent : Brand.green },
            ]}
          />
          <Text
            style={[
              styles.heroPillText,
              {
                color: isDark ? Brand.accent : Brand.nearBlack,
              },
            ]}
            maxFontSizeMultiplier={MaxFontScale.compact}
          >
            {unreadCount} unread
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/* ─── Row ────────────────────────────────────────────────────── */

type RowProps = {
  notification: AppNotification;
  colors: (typeof Colors)["light"];
  scheme: Scheme;
  isDark: boolean;
  isLast: boolean;
  onPress: () => void;
};

function NotificationRow({
  notification,
  colors,
  scheme,
  isDark,
  isLast,
  onPress,
}: RowProps) {
  const icon = iconFor(notification.type, scheme);
  const unread = !notification.isRead;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? "Unread, " : ""}${notification.title}. ${
        notification.message
      }`}
      accessibilityHint={
        notification.actionUrl ? "Opens the related screen" : undefined
      }
      android_ripple={{ color: colors.border }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: unread
            ? isDark
              ? "rgba(248, 251, 105, 0.05)"
              : "rgba(248, 251, 105, 0.22)"
            : "transparent",
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      {/* Brand-accent bar marks unread: color + spatial position together */}
      <View
        style={[
          styles.accentBar,
          {
            backgroundColor: unread ? colors.tint : "transparent",
          },
        ]}
      />

      <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
        <Ionicons name={icon.name} size={20} color={icon.color} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              {
                color: colors.text,
                fontFamily: unread ? FontFamily.bold : FontFamily.semiBold,
              },
            ]}
            numberOfLines={2}
          >
            {notification.title}
          </Text>
          <Text style={[styles.time, { color: colors.textSecondary }]}>
            {formatRelative(notification.createdAt)}
          </Text>
        </View>
        <Text
          style={[styles.message, { color: colors.textSecondary }]}
          numberOfLines={3}
        >
          {notification.message}
        </Text>
      </View>

      {!isLast && (
        <View
          pointerEvents="none"
          style={[styles.rowSeparator, { backgroundColor: colors.border }]}
        />
      )}
    </Pressable>
  );
}

/* ─── Empty ──────────────────────────────────────────────────── */

function EmptyState({
  colors,
  isDark,
}: {
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.emptyWrap}>
      <View
        style={[
          styles.emptyRingOuter,
          {
            backgroundColor: isDark
              ? "rgba(248, 251, 105, 0.06)"
              : "rgba(248, 251, 105, 0.35)",
          },
        ]}
      >
        <View
          style={[
            styles.emptyRingInner,
            {
              backgroundColor: isDark ? "rgba(29, 83, 55, 0.55)" : Brand.green,
            },
          ]}
        >
          <Ionicons name="leaf" size={28} color={Brand.accent} />
        </View>
      </View>
      <ThemedText type="heading" style={styles.emptyHeading}>
        All caught up
      </ThemedText>
      <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
        When a shift is confirmed, a friend reaches out or an announcement
        lands, it&apos;ll show up here.
      </Text>
    </Animated.View>
  );
}

/* ─── Helpers ────────────────────────────────────────────────── */

function formatRelative(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return formatDistanceToNowStrict(date)
      .replace(" seconds", "s")
      .replace(" second", "s")
      .replace(" minutes", "m")
      .replace(" minute", "m")
      .replace(" hours", "h")
      .replace(" hour", "h")
      .replace(" days", "d")
      .replace(" day", "d")
      .replace(" weeks", "w")
      .replace(" week", "w")
      .replace(" months", "mo")
      .replace(" month", "mo")
      .replace(" years", "y")
      .replace(" year", "y");
  } catch {
    return "";
  }
}

/* ─── Styles ─────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  listContent: {
    paddingTop: 0,
  },
  listContentEmpty: {
    flexGrow: 1,
  },

  /* Hero */
  hero: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 8,
  },
  heroTitle: {
    fontFamily: FontFamily.display,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.6,
  },
  heroSub: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 2,
  },
  heroPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 12,
  },
  heroPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroPillText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    letterSpacing: 0.2,
  },

  /* Section header */
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  sectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },

  /* Row */
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    position: "relative",
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  body: {
    flex: 1,
    gap: 4,
    paddingTop: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  time: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  message: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  rowSeparator: {
    position: "absolute",
    left: 72,
    right: 16,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },

  /* Header action */
  headerActionText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    letterSpacing: 0.2,
  },

  /* Empty */
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 48,
    gap: 14,
  },
  emptyRingOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyRingInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyHeading: {
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
});
