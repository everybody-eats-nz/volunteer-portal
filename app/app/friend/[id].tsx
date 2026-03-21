import { Ionicons } from "@expo/vector-icons";
import { differenceInDays, format } from "date-fns";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  DUMMY_FRIEND_PROFILES,
  getShiftThemeByName,
  type FriendProfile,
} from "@/lib/dummy-data";

/* ─── Grade config ──────────────────────────────────────────── */

const GRADE_CONFIG: Record<
  string,
  { label: string; color: string; colorDark: string; emoji: string }
> = {
  GREEN: { label: "Green", color: "#22c55e", colorDark: "#86efac", emoji: "🌿" },
  YELLOW: { label: "Yellow", color: "#eab308", colorDark: "#fde047", emoji: "⭐" },
  PINK: { label: "Pink", color: "#ec4899", colorDark: "#f9a8d4", emoji: "💖" },
};

/* ─── Screen ────────────────────────────────────────────────── */

export default function FriendProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const friend = DUMMY_FRIEND_PROFILES[id];

  if (!friend) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>😕</Text>
          <ThemedText type="heading">Friend not found</ThemedText>
          <Pressable onPress={() => router.back()} style={styles.backLink}>
            <Text style={[styles.backLinkText, { color: isDark ? Brand.greenLight : Brand.green }]}>
              Go back
            </Text>
          </Pressable>
        </View>
      </>
    );
  }

  const grade = GRADE_CONFIG[friend.grade];
  const daysSinceFriends = differenceInDays(new Date(), new Date(friend.friendsSince));
  const isNewFriend = daysSinceFriends <= 30;
  const isCloseBuddy = friend.shiftsTogether > 10;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, 20) + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Nav bar ── */}
        <View style={styles.navBar}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={({ pressed }) => [
              styles.navButton,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            hitSlop={8}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={[styles.navTitle, { color: colors.text }]}>Friend Profile</Text>
          <View style={styles.navButton} />
        </View>

        {/* ── Profile Header Card ── */}
        <View style={[styles.headerCard, { backgroundColor: isDark ? Brand.greenDark : Brand.green }]}>
          {/* Decorative circles */}
          <View style={[styles.decoCircle, styles.decoCircle1]} />
          <View style={[styles.decoCircle, styles.decoCircle2]} />

          <View style={styles.headerContent}>
            {/* Avatar with ring */}
            <View style={styles.avatarWrap}>
              {friend.profilePhotoUrl ? (
                <Image source={{ uri: friend.profilePhotoUrl }} style={styles.avatarImage} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                  <Text style={styles.avatarInitial}>{friend.name.charAt(0)}</Text>
                </View>
              )}
              {/* Grade dot */}
              <View
                style={[
                  styles.gradeDotLarge,
                  { backgroundColor: grade.color, borderColor: isDark ? Brand.greenDark : Brand.green },
                ]}
              >
                <Text style={{ fontSize: 10 }}>{grade.emoji}</Text>
              </View>
            </View>

            {/* Name & meta */}
            <ThemedText type="title" style={styles.headerName}>
              {friend.name}
            </ThemedText>

            {/* Meta row */}
            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.8)" />
                <Text style={styles.metaText}>
                  Friends for {daysSinceFriends} days
                </Text>
              </View>
              <View style={styles.metaPill}>
                <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.8)" />
                <Text style={styles.metaText}>Volunteer whānau</Text>
              </View>
            </View>

            {/* Badges */}
            {(isNewFriend || isCloseBuddy) && (
              <View style={styles.badgeRow}>
                {isNewFriend && (
                  <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                    <Text style={{ fontSize: 11 }}>✨</Text>
                    <Text style={styles.badgeText}>New Friend</Text>
                  </View>
                )}
                {isCloseBuddy && (
                  <View style={[styles.badge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                    <Text style={{ fontSize: 11 }}>🤝</Text>
                    <Text style={styles.badgeText}>Close Buddy</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* ── Stats Grid ── */}
        <View style={styles.section}>
          <View style={styles.statsGrid}>
            <StatCard
              emoji="💚"
              value={daysSinceFriends.toString()}
              label="Days Connected"
              colors={colors}
              isDark={isDark}
              accentColor="#dc2626"
              accentColorDark="#f87171"
            />
            <StatCard
              emoji="🤝"
              value={friend.shiftsTogether.toString()}
              label="Shared Shifts"
              colors={colors}
              isDark={isDark}
              accentColor="#16a34a"
              accentColorDark="#86efac"
            />
            <StatCard
              emoji="🍽️"
              value={friend.totalShifts.toString()}
              label="Total Shifts"
              colors={colors}
              isDark={isDark}
              accentColor="#2563eb"
              accentColorDark="#60a5fa"
            />
            <StatCard
              emoji="⏱️"
              value={`${friend.hoursVolunteered}`}
              label="Hours"
              colors={colors}
              isDark={isDark}
              accentColor="#7c3aed"
              accentColorDark="#a78bfa"
            />
          </View>
        </View>

        {/* ── Activity Summary ── */}
        <View style={styles.section}>
          <SectionHeader
            emoji="📊"
            title={`${friend.name.split(" ")[0]}'s Activity`}
            colors={colors}
            isDark={isDark}
            iconBg={isDark ? "rgba(14,58,35,0.2)" : Brand.greenLight}
          />
          <View style={styles.activityGrid}>
            <View style={[styles.activityCard, { backgroundColor: isDark ? "rgba(14,58,35,0.15)" : Brand.greenLight }]}>
              <Text style={[styles.activityValue, { color: isDark ? "#86efac" : Brand.green }]}>
                {friend.shiftsThisMonth}
              </Text>
              <Text style={[styles.activityLabel, { color: colors.textSecondary }]}>
                This Month
              </Text>
            </View>
            <View style={[styles.activityCard, { backgroundColor: isDark ? "rgba(37,99,235,0.1)" : "#eff6ff" }]}>
              <Text style={[styles.activityValue, { color: isDark ? "#60a5fa" : "#2563eb" }]}>
                {friend.avgPerMonth}
              </Text>
              <Text style={[styles.activityLabel, { color: colors.textSecondary }]}>
                Avg / Month
              </Text>
            </View>
          </View>
          {/* Favorite role */}
          <View style={[styles.favoriteRoleCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.favoriteRoleLabel, { color: colors.textSecondary }]}>
              Favourite Role
            </Text>
            <View style={styles.favoriteRoleRow}>
              <Text style={{ fontSize: 20 }}>
                {getShiftThemeByName(friend.favoriteRole).emoji}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.favoriteRoleName, { color: colors.text }]}>
                  {friend.favoriteRole}
                </Text>
                <Text style={[styles.favoriteRoleCount, { color: colors.textSecondary }]}>
                  Completed {friend.favoriteRoleCount} times
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Shared Volunteering ── */}
        <View style={styles.section}>
          <SectionHeader
            emoji="🌿"
            title="Shared Volunteering"
            colors={colors}
            isDark={isDark}
            iconBg={isDark ? "rgba(22,163,74,0.12)" : "#f0fdf4"}
          />
          {friend.sharedShifts.length > 0 ? (
            <View style={styles.listContainer}>
              {friend.sharedShifts.slice(0, 5).map((shift) => {
                const theme = getShiftThemeByName(shift.type);
                return (
                  <View
                    key={shift.id}
                    style={[
                      styles.shiftRow,
                      { backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "#fafafa" },
                    ]}
                  >
                    <View
                      style={[
                        styles.shiftDot,
                        { backgroundColor: isDark ? theme.colorDark : theme.color },
                      ]}
                    />
                    <View style={styles.shiftRowBody}>
                      <Text style={[styles.shiftRowType, { color: colors.text }]} numberOfLines={1}>
                        {shift.type}
                      </Text>
                      <Text style={[styles.shiftRowMeta, { color: colors.textSecondary }]}>
                        {format(new Date(shift.date), "MMM d, yyyy")} · {shift.location}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        shift.isUpcoming
                          ? { backgroundColor: isDark ? "rgba(14,58,35,0.2)" : Brand.greenLight }
                          : { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          {
                            color: shift.isUpcoming
                              ? isDark ? "#86efac" : Brand.green
                              : colors.textSecondary,
                          },
                        ]}
                      >
                        {shift.isUpcoming ? "Upcoming" : "Completed"}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {friend.sharedShifts.length > 5 && (
                <Text style={[styles.moreText, { color: colors.textSecondary }]}>
                  +{friend.sharedShifts.length - 5} more shared shifts
                </Text>
              )}
            </View>
          ) : (
            <EmptyState
              emoji="🤝"
              title="No shared shifts yet"
              subtitle="Sign up for the same shifts to volunteer together!"
              colors={colors}
              isDark={isDark}
            />
          )}
        </View>

        {/* ── Upcoming Shifts ── */}
        <View style={styles.section}>
          <SectionHeader
            emoji="📅"
            title={`${friend.name.split(" ")[0]}'s Upcoming`}
            colors={colors}
            isDark={isDark}
            iconBg={isDark ? "rgba(37,99,235,0.12)" : "#eff6ff"}
          />
          {friend.upcomingShifts.length > 0 ? (
            <View style={styles.listContainer}>
              {friend.upcomingShifts.map((shift) => {
                const theme = getShiftThemeByName(shift.type);
                return (
                  <View
                    key={shift.id}
                    style={[styles.upcomingRow, { backgroundColor: colors.card }]}
                  >
                    <View
                      style={[
                        styles.upcomingIcon,
                        { backgroundColor: isDark ? theme.bgDark : theme.bgLight },
                      ]}
                    >
                      <Text style={{ fontSize: 20 }}>{theme.emoji}</Text>
                    </View>
                    <View style={styles.upcomingBody}>
                      <Text style={[styles.upcomingType, { color: colors.text }]} numberOfLines={1}>
                        {shift.type}
                      </Text>
                      <Text style={[styles.upcomingMeta, { color: colors.textSecondary }]}>
                        📍 {shift.location}
                      </Text>
                    </View>
                    <View style={styles.upcomingDateCol}>
                      <Text style={[styles.upcomingDate, { color: colors.text }]}>
                        {format(new Date(shift.date), "MMM d")}
                      </Text>
                      <Text style={[styles.upcomingTime, { color: colors.textSecondary }]}>
                        {shift.time}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyState
              emoji="📅"
              title="No upcoming shifts"
              subtitle={`Check back later to see ${friend.name.split(" ")[0]}'s schedule`}
              colors={colors}
              isDark={isDark}
            />
          )}
        </View>

        {/* ── Actions ── */}
        <View style={styles.section}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/shifts");
            }}
            style={({ pressed }) => [
              styles.ctaButton,
              {
                backgroundColor: Brand.green,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
            accessibilityLabel="Browse shifts to volunteer together"
            accessibilityRole="button"
          >
            <Ionicons name="calendar-outline" size={18} color="#ffffff" />
            <Text style={styles.ctaText}>Browse Shifts Together</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

/* ─── Sub-components ────────────────────────────────────────── */

function SectionHeader({
  emoji,
  title,
  colors,
  isDark,
  iconBg,
}: {
  emoji: string;
  title: string;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  iconBg: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionIconCircle, { backgroundColor: iconBg }]}>
        <Text style={{ fontSize: 16 }}>{emoji}</Text>
      </View>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

function StatCard({
  emoji,
  value,
  label,
  colors,
  isDark,
  accentColor,
  accentColorDark,
}: {
  emoji: string;
  value: string;
  label: string;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  accentColor: string;
  accentColorDark: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card }]}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color: isDark ? accentColorDark : accentColor }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function EmptyState({
  emoji,
  title,
  subtitle,
  colors,
  isDark,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  return (
    <View style={[styles.emptyState, { backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "#fafafa" }]}>
      <Text style={{ fontSize: 36, marginBottom: 8 }}>{emoji}</Text>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  backLink: {
    marginTop: 16,
    padding: 12,
  },
  backLinkText: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },

  /* Nav bar */
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },

  /* Header card */
  headerCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  decoCircle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  decoCircle1: {
    width: 160,
    height: 160,
    top: -40,
    right: -30,
  },
  decoCircle2: {
    width: 100,
    height: 100,
    bottom: -20,
    left: -20,
  },
  headerContent: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 10,
  },
  avatarWrap: {
    position: "relative",
    marginBottom: 4,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarInitial: {
    color: "#ffffff",
    fontSize: 36,
    fontFamily: FontFamily.bold,
  },
  gradeDotLarge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: {
    color: "#ffffff",
    textAlign: "center",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
  },

  /* Sections */
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  sectionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
  },

  /* Stats */
  statsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  statEmoji: {
    fontSize: 20,
  },
  statValue: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: FontFamily.medium,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    textAlign: "center",
  },

  /* Activity */
  activityGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  activityCard: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    gap: 4,
  },
  activityValue: {
    fontSize: 28,
    fontFamily: FontFamily.bold,
  },
  activityLabel: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  favoriteRoleCard: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  favoriteRoleLabel: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  favoriteRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  favoriteRoleName: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
  },
  favoriteRoleCount: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },

  /* Shared shifts list */
  listContainer: {
    gap: 8,
  },
  shiftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
  },
  shiftDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  shiftRowBody: {
    flex: 1,
    gap: 2,
  },
  shiftRowType: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },
  shiftRowMeta: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
  },
  moreText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    textAlign: "center",
    paddingTop: 8,
  },

  /* Upcoming shifts */
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  upcomingIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingBody: {
    flex: 1,
    gap: 3,
  },
  upcomingType: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },
  upcomingMeta: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },
  upcomingDateCol: {
    alignItems: "flex-end",
  },
  upcomingDate: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
  },
  upcomingTime: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },

  /* Empty state */
  emptyState: {
    alignItems: "center",
    padding: 32,
    borderRadius: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    textAlign: "center",
    maxWidth: 240,
  },

  /* CTA */
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 16,
  },
  ctaText: {
    color: "#ffffff",
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
});
