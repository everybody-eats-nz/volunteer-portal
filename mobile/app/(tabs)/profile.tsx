import { Ionicons } from "@expo/vector-icons";
import { formatNZT } from "@/lib/dates";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
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

import { ThemedText } from "@/components/themed-text";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useFriends } from "@/hooks/use-friends";
import { useProfile } from "@/hooks/use-profile";
import { type Achievement, type Friend } from "@/lib/dummy-data";
import { api, apiUpload } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const GRADE_CONFIG: Record<
  string,
  { label: string; color: string; colorDark: string; emoji: string }
> = {
  GREEN: {
    label: "Green",
    color: "#22c55e",
    colorDark: "#86efac",
    emoji: "🌿",
  },
  YELLOW: {
    label: "Yellow",
    color: "#eab308",
    colorDark: "#fde047",
    emoji: "⭐",
  },
  PINK: { label: "Pink", color: "#ec4899", colorDark: "#f9a8d4", emoji: "💖" },
};

const CATEGORY_CONFIG: Record<
  string,
  { color: string; colorDark: string; bg: string; bgDark: string }
> = {
  MILESTONE: {
    color: "#2563eb",
    colorDark: "#60a5fa",
    bg: "#eff6ff",
    bgDark: "rgba(37,99,235,0.12)",
  },
  DEDICATION: {
    color: "#dc2626",
    colorDark: "#f87171",
    bg: "#fef2f2",
    bgDark: "rgba(220,38,38,0.12)",
  },
  SPECIALIZATION: {
    color: "#7c3aed",
    colorDark: "#a78bfa",
    bg: "#f5f3ff",
    bgDark: "rgba(124,58,237,0.12)",
  },
  IMPACT: {
    color: "#16a34a",
    colorDark: "#86efac",
    bg: "#f0fdf4",
    bgDark: "rgba(22,163,74,0.12)",
  },
  COMMUNITY: {
    color: "#ea580c",
    colorDark: "#fb923c",
    bg: "#fff7ed",
    bgDark: "rgba(234,88,12,0.12)",
  },
};

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    profile: user,
    stats,
    achievements,
    totalPoints,
    totalVolunteers,
    isLoading,
    error,
    refresh,
  } = useProfile();
  const { friends } = useFriends();
  const logout = useAuth((s) => s.logout);
  const [selectedAchievement, setSelectedAchievement] =
    useState<Achievement | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const grade = user ? GRADE_CONFIG[user.volunteerGrade] : GRADE_CONFIG.GREEN;

  const pickImage = async (source: "camera" | "library") => {
    const common: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1] as [number, number],
      quality: 0.7,
    };

    let result: ImagePicker.ImagePickerResult;

    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Camera access needed",
          "Please enable camera access in Settings to take a profile photo.",
        );
        return;
      }
      result = await ImagePicker.launchCameraAsync(common);
    } else {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Photos access needed",
          "Please enable photo library access in Settings to choose a profile photo.",
        );
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync(common);
    }

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const mimeType = asset.mimeType ?? "image/jpeg";
    const fileName = asset.fileName ?? `profile-photo.${mimeType.split("/")[1] ?? "jpg"}`;

    const formData = new FormData();
    formData.append("photo", {
      uri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);

    setIsUploadingPhoto(true);
    try {
      await apiUpload("/api/mobile/profile/photo", formData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh();
    } catch {
      Alert.alert("Upload failed", "Couldn't update your photo. Please try again.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const removePhoto = async () => {
    setIsUploadingPhoto(true);
    try {
      await api("/api/mobile/profile/photo", { method: "DELETE" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh();
    } catch {
      Alert.alert("Failed", "Couldn't remove your photo. Please try again.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const showPhotoOptions = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const options = user?.image
      ? ["Take Photo", "Choose from Library", "Remove Photo", "Cancel"]
      : ["Take Photo", "Choose from Library", "Cancel"];
    const cancelIndex = options.length - 1;
    const destructiveIndex = user?.image ? 2 : undefined;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          destructiveButtonIndex: destructiveIndex,
          title: "Profile Photo",
        },
        (index) => {
          if (index === 0) pickImage("camera");
          else if (index === 1) pickImage("library");
          else if (index === 2 && user?.image) removePhoto();
        },
      );
    } else {
      Alert.alert("Profile Photo", undefined, [
        { text: "Take Photo", onPress: () => pickImage("camera") },
        { text: "Choose from Library", onPress: () => pickImage("library") },
        ...(user?.image
          ? [
              {
                text: "Remove Photo",
                style: "destructive" as const,
                onPress: removePhoto,
              },
            ]
          : []),
        { text: "Cancel", style: "cancel" as const },
      ]);
    }
  };

  const unlocked = achievements.filter((a) => a.unlockedAt);
  const inProgress = achievements.filter(
    (a) => !a.unlockedAt && a.progress != null
  );

  if (isLoading && !user) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
            paddingTop: insets.top,
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user || !stats) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
            paddingTop: insets.top,
          },
        ]}
      >
        <ThemedText type="subtitle" style={{ textAlign: "center" }}>
          {error ?? "Couldn't load profile"}
        </ThemedText>
      </View>
    );
  }

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 60,
          paddingBottom: Math.max(insets.bottom, 20) + 20,
        },
      ]}
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
        <Pressable
          onPress={showPhotoOptions}
          disabled={isUploadingPhoto}
          style={({ pressed }) => [
            styles.avatarContainer,
            { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
          ]}
          accessibilityLabel="Change profile photo"
          accessibilityHint="Opens options to take a photo or choose from library"
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
          {isUploadingPhoto ? (
            <View
              style={[
                styles.avatarEditBadge,
                { backgroundColor: Brand.green },
              ]}
            >
              <ActivityIndicator size={14} color="#ffffff" />
            </View>
          ) : (
            <View
              style={[
                styles.avatarEditBadge,
                { backgroundColor: Brand.green },
              ]}
            >
              <Ionicons name="camera" size={14} color="#ffffff" />
            </View>
          )}
        </Pressable>
        <ThemedText type="title">
          {user.firstName} {user.lastName}
        </ThemedText>
        <View
          style={[
            styles.joinedBadge,
            { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9" },
          ]}
        >
          <Text style={[styles.joinedText, { color: colors.textSecondary }]}>
            Volunteer since {formatNZT(new Date(user.memberSince), "MMM yyyy")}
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
          <View
            style={[
              styles.sectionIconCircle,
              { backgroundColor: isDark ? "rgba(37,99,235,0.12)" : "#eff6ff" },
            ]}
          >
            <Text style={{ fontSize: 16 }}>👥</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Whānau
            </Text>
            <Text
              style={[styles.sectionCaption, { color: colors.textSecondary }]}
            >
              {friends.length} friends
            </Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.friendsScroll}
        >
          {friends.map((friend) => (
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
          <View
            style={[
              styles.sectionIconCircle,
              { backgroundColor: isDark ? "rgba(245,158,11,0.12)" : "#fef3c7" },
            ]}
          >
            <Text style={{ fontSize: 16 }}>🏆</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Achievements
            </Text>
            <Text
              style={[styles.sectionCaption, { color: colors.textSecondary }]}
            >
              {unlocked.length} unlocked · {totalPoints} points
            </Text>
          </View>
        </View>

        {/* Recent unlocks */}
        {unlocked
          .slice(0, 3)
          .map((achievement) => (
            <AchievementRow
              key={achievement.id}
              achievement={achievement}
              colors={colors}
              isDark={isDark}
              type="unlocked"
              onPress={() => setSelectedAchievement(achievement)}
            />
          ))}

        {/* Next goals */}
        {inProgress.length > 0 && (
          <>
            <Text
              style={[styles.subsectionLabel, { color: colors.textSecondary }]}
            >
              NEXT GOALS
            </Text>
            {inProgress.map((achievement) => (
              <AchievementRow
                key={achievement.id}
                achievement={achievement}
                colors={colors}
                isDark={isDark}
                type="progress"
                onPress={() => setSelectedAchievement(achievement)}
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
            router.push("/profile/edit");
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
            {
              text: "Sign Out",
              style: "destructive",
              onPress: () => {
                logout();
              },
            },
          ]);
        }}
        style={({ pressed }) => [
          styles.signOutButton,
          {
            borderColor: isDark ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.2)",
            backgroundColor: isDark
              ? "rgba(239,68,68,0.06)"
              : "rgba(239,68,68,0.04)",
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

    {selectedAchievement && (
      <AchievementSheet
        achievement={selectedAchievement}
        totalVolunteers={totalVolunteers}
        onClose={() => setSelectedAchievement(null)}
        colors={colors}
        isDark={isDark}
      />
    )}
  </>
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
  onPress,
}: {
  achievement: Achievement;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  type: "unlocked" | "progress";
  onPress?: () => void;
}) {
  const cat =
    CATEGORY_CONFIG[achievement.category] ?? CATEGORY_CONFIG.MILESTONE;
  const catColor = isDark ? cat.colorDark : cat.color;
  const catBg = isDark ? cat.bgDark : cat.bg;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.achievementRow,
        {
          backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "#fafafa",
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      accessibilityLabel={`${achievement.name} — ${achievement.description}`}
      accessibilityRole="button"
    >
      <View style={[styles.achievementIcon, { backgroundColor: catBg }]}>
        <Text style={{ fontSize: 20 }}>{achievement.icon}</Text>
      </View>
      <View style={styles.achievementBody}>
        <View style={styles.achievementNameRow}>
          <Text
            style={[styles.achievementName, { color: colors.text }]}
            numberOfLines={1}
          >
            {achievement.name}
          </Text>
          <View style={[styles.categoryBadge, { backgroundColor: catBg }]}>
            <Text style={[styles.categoryText, { color: catColor }]}>
              {achievement.points}pt
            </Text>
          </View>
        </View>
        <Text
          style={[styles.achievementDesc, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {achievement.description}
        </Text>

        {type === "progress" && achievement.progress != null && (
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressTrack,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "#e2e8f0",
                },
              ]}
            >
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
            <Text
              style={[styles.progressLabel, { color: colors.textSecondary }]}
            >
              {achievement.target}
            </Text>
          </View>
        )}

        {type === "unlocked" && achievement.unlockedAt && (
          <Text style={[styles.unlockedDate, { color: colors.textSecondary }]}>
            {formatNZT(new Date(achievement.unlockedAt), "d MMM yyyy")}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/* ── Achievement Detail Sheet ── */

function AchievementSheet({
  achievement,
  totalVolunteers,
  onClose,
  colors,
  isDark,
}: {
  achievement: Achievement;
  totalVolunteers: number;
  onClose: () => void;
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cat =
    CATEGORY_CONFIG[achievement.category] ?? CATEGORY_CONFIG.MILESTONE;
  const catColor = isDark ? cat.colorDark : cat.color;
  const catBg = isDark ? cat.bgDark : cat.bg;
  const isUnlocked = !!achievement.unlockedAt;
  const unlockedByCount = achievement.unlockedByCount ?? 0;
  const unlockPct =
    totalVolunteers > 0
      ? Math.round((unlockedByCount / totalVolunteers) * 100)
      : 0;

  const CATEGORY_LABELS: Record<string, string> = {
    MILESTONE: "Milestone",
    DEDICATION: "Dedication",
    SPECIALIZATION: "Specialization",
    IMPACT: "Impact",
    COMMUNITY: "Community",
  };

  return (
    <Modal
      visible
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={[achieveSheet.page, { backgroundColor: colors.background }]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: Math.max(insets.bottom, 20) + 12,
          }}
        >
          {/* ── Hero ── */}
          <View
            style={[
              achieveSheet.hero,
              { backgroundColor: isDark ? cat.bgDark : cat.bg },
            ]}
          >
            {/* Handle bar */}
            <View
              style={[
                achieveSheet.handleBar,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.2)"
                    : "rgba(0,0,0,0.15)",
                },
              ]}
            />
            {/* Decorative rings */}
            <View
              style={[
                achieveSheet.ring,
                achieveSheet.ringOuter,
                {
                  borderColor: isDark
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(0,0,0,0.03)",
                },
              ]}
            />
            <View
              style={[
                achieveSheet.ring,
                achieveSheet.ringInner,
                {
                  borderColor: isDark
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(0,0,0,0.04)",
                },
              ]}
            />

            {/* Close pill */}
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="Close"
              accessibilityRole="button"
              style={({ pressed }) => [
                achieveSheet.closePill,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.05)",
                  opacity: pressed ? 0.5 : 1,
                },
              ]}
            >
              <Ionicons
                name="close"
                size={16}
                color={isDark ? colors.textSecondary : "#6b7280"}
              />
            </Pressable>

            {/* Icon */}
            <View
              style={[
                achieveSheet.iconCircle,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(255,255,255,0.65)",
                },
              ]}
            >
              <Text style={achieveSheet.iconEmoji}>{achievement.icon}</Text>
            </View>

            {/* Category label */}
            <View
              style={[
                achieveSheet.typeLabel,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.04)",
                },
              ]}
            >
              <Text style={[achieveSheet.typeLabelText, { color: catColor }]}>
                {CATEGORY_LABELS[achievement.category] ?? achievement.category}
              </Text>
            </View>
          </View>

          {/* ── Content card ── */}
          <View
            style={[
              achieveSheet.card,
              {
                backgroundColor: colors.card,
                shadowColor: isDark ? "#000" : "#64748b",
              },
            ]}
          >
            <Text style={[achieveSheet.title, { color: colors.text }]}>
              {achievement.name}
            </Text>
            <Text
              style={[achieveSheet.description, { color: colors.textSecondary }]}
            >
              {achievement.description}
            </Text>

            {/* Points + status pills */}
            <View style={achieveSheet.pillRow}>
              <View
                style={[achieveSheet.pill, { backgroundColor: catBg }]}
              >
                <Text style={{ fontSize: 12 }}>✨</Text>
                <Text style={[achieveSheet.pillText, { color: catColor }]}>
                  {achievement.points} points
                </Text>
              </View>
              <View
                style={[
                  achieveSheet.pill,
                  {
                    backgroundColor: isUnlocked
                      ? isDark
                        ? "rgba(34,197,94,0.12)"
                        : "#f0fdf4"
                      : isDark
                        ? "rgba(255,255,255,0.05)"
                        : "#f8fafc",
                  },
                ]}
              >
                <Text style={{ fontSize: 12 }}>
                  {isUnlocked ? "✅" : "🔒"}
                </Text>
                <Text
                  style={[
                    achieveSheet.pillText,
                    {
                      color: isUnlocked
                        ? isDark
                          ? "#86efac"
                          : "#16a34a"
                        : colors.textSecondary,
                    },
                  ]}
                >
                  {isUnlocked ? "Unlocked" : "In Progress"}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Progress / Unlock date section ── */}
          <View style={achieveSheet.section}>
            {isUnlocked && achievement.unlockedAt ? (
              <View
                style={[
                  achieveSheet.infoCard,
                  { backgroundColor: colors.card },
                ]}
              >
                <View style={achieveSheet.infoRow}>
                  <Text style={{ fontSize: 16 }}>📅</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        achieveSheet.infoLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Unlocked on
                    </Text>
                    <Text
                      style={[achieveSheet.infoValue, { color: colors.text }]}
                    >
                      {formatNZT(new Date(achievement.unlockedAt), "d MMMM yyyy")}
                    </Text>
                  </View>
                </View>
              </View>
            ) : achievement.progress != null ? (
              <View
                style={[
                  achieveSheet.infoCard,
                  { backgroundColor: colors.card },
                ]}
              >
                <Text
                  style={[
                    achieveSheet.infoLabel,
                    { color: colors.textSecondary, marginBottom: 8 },
                  ]}
                >
                  Your Progress
                </Text>
                <View style={achieveSheet.progressContainer}>
                  <View
                    style={[
                      achieveSheet.progressTrack,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.06)"
                          : "#e2e8f0",
                      },
                    ]}
                  >
                    <View
                      style={[
                        achieveSheet.progressFill,
                        {
                          width: `${Math.round(achievement.progress * 100)}%`,
                          backgroundColor: catColor,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      achieveSheet.progressText,
                      { color: colors.text },
                    ]}
                  >
                    {Math.round(achievement.progress * 100)}%
                  </Text>
                </View>
                {achievement.target && (
                  <Text
                    style={[
                      achieveSheet.progressTarget,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Goal: {achievement.target}
                  </Text>
                )}
              </View>
            ) : null}

            {/* ── Community stats ── */}
            <View
              style={[achieveSheet.infoCard, { backgroundColor: colors.card }]}
            >
              <Text
                style={[
                  achieveSheet.infoLabel,
                  { color: colors.textSecondary, marginBottom: 10 },
                ]}
              >
                Community
              </Text>
              <View style={achieveSheet.communityRow}>
                <View style={achieveSheet.communityItem}>
                  <Text style={{ fontSize: 22 }}>👥</Text>
                  <Text
                    style={[
                      achieveSheet.communityValue,
                      { color: colors.text },
                    ]}
                  >
                    {unlockedByCount}
                  </Text>
                  <Text
                    style={[
                      achieveSheet.communityLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {unlockedByCount === 1 ? "Volunteer" : "Volunteers"}
                  </Text>
                </View>
                <View
                  style={[
                    achieveSheet.communityDivider,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "#e2e8f0",
                    },
                  ]}
                />
                <View style={achieveSheet.communityItem}>
                  <Text style={{ fontSize: 22 }}>📊</Text>
                  <Text
                    style={[
                      achieveSheet.communityValue,
                      { color: colors.text },
                    ]}
                  >
                    {unlockPct}%
                  </Text>
                  <Text
                    style={[
                      achieveSheet.communityLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    of whānau
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Friends who earned this ── */}
            {achievement.friendsWhoEarned &&
              achievement.friendsWhoEarned.length > 0 && (
                <View
                  style={[
                    achieveSheet.infoCard,
                    { backgroundColor: colors.card },
                  ]}
                >
                  <Text
                    style={[
                      achieveSheet.infoLabel,
                      { color: colors.textSecondary, marginBottom: 10 },
                    ]}
                  >
                    Friends who earned this
                  </Text>
                  <View style={achieveSheet.friendsList}>
                    {achievement.friendsWhoEarned.slice(0, 6).map((f) => (
                      <Pressable
                        key={f.id}
                        onPress={() => {
                          onClose();
                          router.push(`/friend/${f.id}` as never);
                        }}
                        style={({ pressed }) => [
                          achieveSheet.friendItem,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                        accessibilityLabel={`View ${f.name}'s profile`}
                        accessibilityRole="button"
                      >
                        {f.profilePhotoUrl ? (
                          <Image
                            source={{ uri: f.profilePhotoUrl }}
                            style={achieveSheet.friendAvatar}
                          />
                        ) : (
                          <View
                            style={[
                              achieveSheet.friendAvatarFallback,
                              {
                                backgroundColor: isDark
                                  ? Brand.greenDark
                                  : Brand.green,
                              },
                            ]}
                          >
                            <Text style={achieveSheet.friendInitial}>
                              {f.name.charAt(0)}
                            </Text>
                          </View>
                        )}
                        <Text
                          style={[
                            achieveSheet.friendName,
                            { color: colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {f.name.split(" ")[0]}
                        </Text>
                      </Pressable>
                    ))}
                    {achievement.friendsWhoEarned.length > 6 && (
                      <View style={achieveSheet.friendItem}>
                        <View
                          style={[
                            achieveSheet.friendAvatarFallback,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.06)"
                                : "#f1f5f9",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              achieveSheet.friendMoreText,
                              { color: colors.textSecondary },
                            ]}
                          >
                            +{achievement.friendsWhoEarned.length - 6}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              )}
          </View>
        </ScrollView>
      </View>
    </Modal>
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
          <Image
            source={{ uri: friend.profilePhotoUrl }}
            style={styles.friendAvatar}
          />
        ) : (
          <View
            style={[
              styles.friendAvatarFallback,
              { backgroundColor: Brand.green },
            ]}
          >
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
      <View
        style={[
          styles.actionIconCircle,
          { backgroundColor: isDark ? "rgba(14,58,35,0.2)" : Brand.greenLight },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={isDark ? "#86efac" : Brand.green}
        />
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
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "#ffffff",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
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

/* ── Achievement Sheet Styles ── */

const achieveSheet = StyleSheet.create({
  page: {
    flex: 1,
  },
  hero: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 24,
    gap: 16,
    overflow: "hidden",
  },
  handleBar: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    alignSelf: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 999,
  },
  ringOuter: {
    width: 280,
    height: 280,
    top: -60,
  },
  ringInner: {
    width: 200,
    height: 200,
    top: -20,
  },
  closePill: {
    position: "absolute",
    top: 14,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: {
    fontSize: 32,
  },
  typeLabel: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  typeLabelText: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  card: {
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    gap: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontFamily: FontFamily.headingBold,
    lineHeight: 28,
    textAlign: "center",
  },
  description: {
    fontSize: 15,
    fontFamily: FontFamily.regular,
    lineHeight: 23,
    textAlign: "center",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  pillText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  infoCard: {
    borderRadius: 16,
    padding: 18,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 15,
    fontFamily: FontFamily.bold,
    minWidth: 40,
    textAlign: "right",
  },
  progressTarget: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    marginTop: 6,
  },
  communityRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  communityItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  communityValue: {
    fontSize: 22,
    fontFamily: FontFamily.bold,
  },
  communityLabel: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
  },
  communityDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 8,
  },
  friendsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  friendItem: {
    alignItems: "center",
    gap: 4,
    width: 56,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  friendAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  friendInitial: {
    color: "#ffffff",
    fontSize: 18,
    fontFamily: FontFamily.bold,
  },
  friendName: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    textAlign: "center",
  },
  friendMoreText: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },
});
