import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  Alert,
  Image,
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
  DUMMY_PROFILE,
  DUMMY_STATS,
  DUMMY_ACHIEVEMENTS,
  DUMMY_FRIENDS,
  type Achievement,
  type Friend,
} from "@/lib/dummy-data";

const GRADE_CONFIG: Record<
  string,
  { label: string; color: string; colorDark: string; emoji: string }
> = {
  GREEN: { label: "Green", color: "#22c55e", colorDark: "#86efac", emoji: "🌿" },
  YELLOW: { label: "Yellow", color: "#eab308", colorDark: "#fde047", emoji: "⭐" },
  PINK: { label: "Pink", color: "#ec4899", colorDark: "#f9a8d4", emoji: "💖" },
};

const CATEGORY_CONFIG: Record<
  string,
  { color: string; colorDark: string; bg: string; bgDark: string }
> = {
  MILESTONE: { color: "#2563eb", colorDark: "#60a5fa", bg: "#eff6ff", bgDark: "rgba(37,99,235,0.12)" },
  DEDICATION: { color: "#dc2626", colorDark: "#f87171", bg: "#fef2f2", bgDark: "rgba(220,38,38,0.12)" },
  SPECIALIZATION: { color: "#7c3aed", colorDark: "#a78bfa", bg: "#f5f3ff", bgDark: "rgba(124,58,237,0.12)" },
  IMPACT: { color: "#16a34a", colorDark: "#86efac", bg: "#f0fdf4", bgDark: "rgba(22,163,74,0.12)" },
  COMMUNITY: { color: "#ea580c", colorDark: "#fb923c", bg: "#fff7ed", bgDark: "rgba(234,88,12,0.12)" },
};

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = DUMMY_PROFILE;
  const stats = DUMMY_STATS;
  const grade = GRADE_CONFIG[user.volunteerGrade];

  const unlocked = DUMMY_ACHIEVEMENTS.filter((a) => a.unlockedAt);
  const inProgress = DUMMY_ACHIEVEMENTS.filter((a) => !a.unlockedAt && a.progress != null);
  const totalPoints = unlocked.reduce((sum, a) => sum + a.points, 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) + 20 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // Navigate to edit profile
          }}
          style={({ pressed }) => [
            styles.avatarContainer,
            { opacity: pressed ? 0.9 : 1 },
          ]}
          accessibilityLabel="Edit profile photo"
        >
          {user.image ? (
            <Image source={{ uri: user.image }} style={styles.avatarImage} />
          ) : (
            <View
              style={[styles.avatarFallback, { backgroundColor: Brand.green }]}
            >
              <Text style={styles.avatarText}>{user.firstName.charAt(0)}</Text>
            </View>
          )}
          {/* Edit indicator */}
          <View style={[styles.avatarEditBadge, { backgroundColor: colors.card, borderColor: colors.background }]}>
            <Ionicons name="pencil" size={11} color={colors.textSecondary} />
          </View>
        </Pressable>
        <ThemedText type="title">
          {user.firstName} {user.lastName}
        </ThemedText>
        <View style={[styles.joinedBadge, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9" }]}>
          <Text style={[styles.joinedText, { color: colors.textSecondary }]}>
            Volunteer since {format(new Date(user.memberSince), "MMM yyyy")}
          </Text>
        </View>
      </View>

      {/* ── Stats Grid (matches web dashboard) ── */}
      <View style={styles.statsGrid}>
        <StatCard
          emoji="🍽️"
          value={stats.shiftsCompleted.toString()}
          label="Shifts"
          colors={colors}
          isDark={isDark}
          accentColor="#16a34a"
          accentColorDark="#86efac"
        />
        <StatCard
          emoji="⏱️"
          value={`${stats.hoursContributed}`}
          label="Hours"
          colors={colors}
          isDark={isDark}
          accentColor="#d97706"
          accentColorDark="#fbbf24"
        />
        <StatCard
          emoji="🫶"
          value={stats.peopleServed.toLocaleString()}
          label="Served"
          colors={colors}
          isDark={isDark}
          accentColor="#2563eb"
          accentColorDark="#60a5fa"
        />
        <StatCard
          emoji="🔥"
          value={`${stats.currentStreak}mo`}
          label="Streak"
          colors={colors}
          isDark={isDark}
          accentColor="#dc2626"
          accentColorDark="#f87171"
        />
      </View>

      {/* ── Whānau (Friends) ── */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.sectionIconCircle, { backgroundColor: isDark ? "rgba(37,99,235,0.12)" : "#eff6ff" }]}>
            <Text style={{ fontSize: 16 }}>👥</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Whānau</Text>
            <Text style={[styles.sectionCaption, { color: colors.textSecondary }]}>
              {DUMMY_FRIENDS.length} friends
            </Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.friendsScroll}
        >
          {DUMMY_FRIENDS.map((friend) => (
            <FriendCard
              key={friend.id}
              friend={friend}
              colors={colors}
              isDark={isDark}
              router={router}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Achievements ── */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeaderRow}>
          <View style={[styles.sectionIconCircle, { backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "#fef3c7" }]}>
            <Text style={{ fontSize: 16 }}>🏆</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Achievements</Text>
            <Text style={[styles.sectionCaption, { color: colors.textSecondary }]}>
              {unlocked.length} unlocked · {totalPoints} points
            </Text>
          </View>
        </View>

        {/* Recent unlocks */}
        {unlocked.slice(-3).reverse().map((achievement) => (
          <AchievementRow
            key={achievement.id}
            achievement={achievement}
            colors={colors}
            isDark={isDark}
            type="unlocked"
          />
        ))}

        {/* Next goals */}
        {inProgress.length > 0 && (
          <>
            <Text style={[styles.subsectionLabel, { color: colors.textSecondary }]}>
              NEXT GOALS
            </Text>
            {inProgress.map((achievement) => (
              <AchievementRow
                key={achievement.id}
                achievement={achievement}
                colors={colors}
                isDark={isDark}
                type="progress"
              />
            ))}
          </>
        )}
      </View>

      {/* ── Quick Actions ── */}
      <View style={styles.actionsGrid}>
        <ActionButton
          icon="create-outline"
          label="Edit Profile"
          colors={colors}
          isDark={isDark}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        />
        <ActionButton
          icon="calendar-outline"
          label="My Schedule"
          colors={colors}
          isDark={isDark}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/(tabs)/shifts");
          }}
        />
      </View>

      {/* ── Sign out ── */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Alert.alert("Sign Out", "Are you sure you want to sign out?", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign Out", style: "destructive", onPress: () => {} },
          ]);
        }}
        style={({ pressed }) => [
          styles.signOutButton,
          {
            borderColor: isDark ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.2)",
            backgroundColor: isDark ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.04)",
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
        <Text style={[styles.signOutText, { color: colors.destructive }]}>
          Sign Out
        </Text>
      </Pressable>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Ngā mihi nui for being part of the whānau 💚
        </Text>
      </View>
    </ScrollView>
  );
}

/* ── Stat Card ── */

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
  const accent = isDark ? accentColorDark : accentColor;
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card }]}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

/* ── Achievement Row ── */

function AchievementRow({
  achievement,
  colors,
  isDark,
  type,
}: {
  achievement: Achievement;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  type: "unlocked" | "progress";
}) {
  const cat = CATEGORY_CONFIG[achievement.category] ?? CATEGORY_CONFIG.MILESTONE;
  const catColor = isDark ? cat.colorDark : cat.color;
  const catBg = isDark ? cat.bgDark : cat.bg;

  return (
    <View
      style={[
        styles.achievementRow,
        { backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "#fafafa" },
      ]}
    >
      <View style={[styles.achievementIcon, { backgroundColor: catBg }]}>
        <Text style={{ fontSize: 20 }}>{achievement.icon}</Text>
      </View>
      <View style={styles.achievementBody}>
        <View style={styles.achievementNameRow}>
          <Text style={[styles.achievementName, { color: colors.text }]} numberOfLines={1}>
            {achievement.name}
          </Text>
          <View style={[styles.categoryBadge, { backgroundColor: catBg }]}>
            <Text style={[styles.categoryText, { color: catColor }]}>
              {achievement.points}pt
            </Text>
          </View>
        </View>
        <Text style={[styles.achievementDesc, { color: colors.textSecondary }]} numberOfLines={1}>
          {achievement.description}
        </Text>

        {type === "progress" && achievement.progress != null && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressTrack, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0" }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.round(achievement.progress * 100)}%`,
                    backgroundColor: catColor,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
              {achievement.target}
            </Text>
          </View>
        )}

        {type === "unlocked" && achievement.unlockedAt && (
          <Text style={[styles.unlockedDate, { color: colors.textSecondary }]}>
            {format(new Date(achievement.unlockedAt), "d MMM yyyy")}
          </Text>
        )}
      </View>
    </View>
  );
}

/* ── Friend Card ── */

const FRIEND_GRADE_DOT: Record<string, string> = {
  GREEN: "#22c55e",
  YELLOW: "#eab308",
  PINK: "#ec4899",
};

function FriendCard({
  friend,
  colors,
  isDark,
  router,
}: {
  friend: Friend;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const dotColor = FRIEND_GRADE_DOT[friend.grade] ?? "#94a3b8";
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/friend/${friend.id}`);
      }}
      style={({ pressed }) => [
        styles.friendCard,
        {
          backgroundColor: colors.card,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
      accessibilityLabel={`${friend.name}, ${friend.shiftsTogether} shifts together`}
      accessibilityRole="button"
    >
      {/* Avatar with grade dot */}
      <View style={styles.friendAvatarWrap}>
        {friend.profilePhotoUrl ? (
          <Image source={{ uri: friend.profilePhotoUrl }} style={styles.friendAvatar} />
        ) : (
          <View style={[styles.friendAvatarFallback, { backgroundColor: Brand.green }]}>
            <Text style={styles.friendAvatarInitial}>
              {friend.name.charAt(0)}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.friendGradeDot,
            {
              backgroundColor: dotColor,
              borderColor: colors.card,
            },
          ]}
        />
      </View>

      {/* Info */}
      <Text
        style={[styles.friendName, { color: colors.text }]}
        numberOfLines={1}
      >
        {friend.name.split(" ")[0]}
      </Text>
      <Text style={[styles.friendMeta, { color: colors.textSecondary }]}>
        {friend.shiftsTogether} shifts together
      </Text>
    </Pressable>
  );
}

/* ── Action Button ── */

function ActionButton({
  icon,
  label,
  colors,
  isDark,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: colors.card,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
      accessibilityRole="button"
    >
      <View style={[styles.actionIconCircle, { backgroundColor: isDark ? "rgba(14,58,35,0.2)" : Brand.greenLight }]}>
        <Ionicons name={icon} size={20} color={isDark ? "#86efac" : Brand.green} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },

  // Header
  header: {
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  avatarContainer: {
    marginBottom: 4,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 36,
    fontFamily: FontFamily.bold,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  gradeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  gradeEmoji: {
    fontSize: 12,
  },
  gradeText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
  },
  joinedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  joinedText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
  },

  // Stats grid
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
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
    fontSize: 11,
    fontFamily: FontFamily.medium,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  // Section
  sectionContainer: {
    marginBottom: 24,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
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
  sectionCaption: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    marginTop: 1,
  },
  subsectionLabel: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: -2,
    paddingHorizontal: 4,
  },

  // Achievement row
  achievementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
  },
  achievementIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  achievementBody: {
    flex: 1,
    gap: 3,
  },
  achievementNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  achievementName: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    flex: 1,
  },
  achievementDesc: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
  },
  unlockedDate: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    marginTop: 1,
  },

  // Progress bar
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    minWidth: 60,
  },

  // Friends
  friendsScroll: {
    gap: 10,
    paddingRight: 4,
  },
  friendCard: {
    width: 110,
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    gap: 6,
  },
  friendAvatarWrap: {
    position: "relative",
    marginBottom: 2,
  },
  friendAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  friendAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  friendAvatarInitial: {
    color: "#ffffff",
    fontSize: 20,
    fontFamily: FontFamily.bold,
  },
  friendGradeDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
  },
  friendName: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
    textAlign: "center",
  },
  friendMeta: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    textAlign: "center",
    lineHeight: 14,
  },
  // Quick actions
  actionsGrid: {
    gap: 10,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },

  // Sign out
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  signOutText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 32,
  },
  footerText: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    textAlign: "center",
  },
});
