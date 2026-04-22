import { Ionicons } from "@expo/vector-icons";
import { formatNZT } from "@/lib/dates";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
  Switch,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useFriends } from "@/hooks/use-friends";
import { useProfile } from "@/hooks/use-profile";
import {
  isCalendarSyncEnabled,
  setCalendarSyncEnabled,
} from "@/lib/calendar-sync";
import { useOnboarding } from "@/lib/onboarding";
import { type Achievement, type Friend, type Shift } from "@/lib/dummy-data";
import { api, apiUpload } from "@/lib/api";
import { useAuth } from "@/lib/auth";

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
  const { friends, refresh: refreshFriends } = useFriends();

  useFocusEffect(
    useCallback(() => {
      refreshFriends();
    }, [refreshFriends])
  );
  const logout = useAuth((s) => s.logout);
  const showOnboarding = useOnboarding((s) => s.show);
  const [selectedAchievement, setSelectedAchievement] =
    useState<Achievement | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [calSyncEnabled, setCalSyncEnabled] = useState(false);
  const [calSyncBusy, setCalSyncBusy] = useState(false);

  useEffect(() => {
    isCalendarSyncEnabled().then(setCalSyncEnabled);
  }, []);

  const handleToggleCalendarSync = useCallback(async (next: boolean) => {
    setCalSyncBusy(true);
    try {
      let shifts: Shift[] | undefined;
      if (next) {
        try {
          const result = await api<{ myShifts: Shift[] }>("/api/mobile/shifts");
          shifts = result.myShifts;
        } catch {
          // Skip initial sync if fetch fails; useShifts will reconcile later.
        }
      }
      const ok = await setCalendarSyncEnabled(next, shifts);
      if (!ok && next) {
        setCalSyncEnabled(false);
        Alert.alert(
          "Calendar access needed",
          "To sync your shifts, enable Calendar access for Everybody Eats in Settings."
        );
        return;
      }
      setCalSyncEnabled(next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setCalSyncBusy(false);
    }
  }, []);

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
    (a) => !a.unlockedAt && a.progress != null,
  );
  const latestUnlock = unlocked[0] ?? null;
  const otherUnlocks = unlocked.slice(1, 3);

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
            paddingHorizontal: 32,
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
            paddingTop: insets.top + 48,
            paddingBottom: Math.max(insets.bottom, 20) + 28,
          },
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
        {/* ── Editorial Hero ── */}
        <Animated.View
          entering={FadeInDown.duration(520)}
          style={styles.hero}
        >
          <Pressable
            onPress={showPhotoOptions}
            disabled={isUploadingPhoto}
            style={({ pressed }) => [
              styles.avatarWrap,
              { opacity: pressed ? 0.92 : 1 },
            ]}
            accessibilityLabel="Change profile photo"
            accessibilityHint="Opens options to take a photo or choose from library"
            accessibilityRole="button"
          >
            {/* Soft green halo */}
            <View
              style={[
                styles.avatarHalo,
                {
                  backgroundColor: isDark
                    ? "rgba(134,239,172,0.10)"
                    : "rgba(14,58,35,0.07)",
                },
              ]}
            />
            <View
              style={[
                styles.avatarRing,
                { borderColor: isDark ? colors.background : Brand.warmWhite },
              ]}
            >
              {user.image ? (
                <Image source={{ uri: user.image }} style={styles.avatarImage} />
              ) : (
                <View
                  style={[
                    styles.avatarFallback,
                    { backgroundColor: Brand.green },
                  ]}
                >
                  <Text style={styles.avatarInitial}>
                    {user.firstName.charAt(0)}
                  </Text>
                </View>
              )}
            </View>
            <View
              style={[
                styles.avatarBadge,
                {
                  backgroundColor: Brand.green,
                  borderColor: isDark ? colors.background : Brand.warmWhite,
                },
              ]}
            >
              {isUploadingPhoto ? (
                <ActivityIndicator size={12} color="#ffffff" />
              ) : (
                <Ionicons name="camera" size={13} color="#ffffff" />
              )}
            </View>
          </Pressable>

          <Text
            style={[
              styles.heroGreeting,
              { color: isDark ? "#86efac" : Brand.greenDark },
            ]}
          >
            Kia ora,
          </Text>
          <Text style={[styles.heroName, { color: colors.text }]}>
            {user.firstName} {user.lastName}
          </Text>

          <Text style={[styles.heroMeta, { color: colors.textSecondary }]}>
            Volunteer since {formatNZT(new Date(user.memberSince), "MMMM yyyy")}
          </Text>
        </Animated.View>

        {/* ── Your Mahi (Impact Panel) ── */}
        <Animated.View
          entering={FadeInDown.delay(80).duration(520)}
          style={styles.mahiContainer}
        >
          <LinearGradient
            colors={
              isDark
                ? ["#0d2a1b", "#14422a"]
                : [Brand.green, Brand.greenDark]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mahiCard}
          >
            {/* Decorative bloom */}
            <View style={styles.mahiBloomOuter} pointerEvents="none" />
            <View style={styles.mahiBloomInner} pointerEvents="none" />

            <View style={styles.mahiLabelRow}>
              <View
                style={[
                  styles.mahiLabelLine,
                  { backgroundColor: Brand.accent },
                ]}
              />
              <Text style={styles.mahiLabel}>Your mahi</Text>
            </View>

            <View style={styles.mahiHero}>
              <Text style={styles.mahiHeroNumber}>
                {stats.shiftsCompleted.toLocaleString()}
              </Text>
              <Text style={styles.mahiHeroCaption}>
                shifts served with aroha
              </Text>
            </View>

            <View style={styles.mahiDivider} />

            <View style={styles.mahiStatsRow}>
              <MahiStat
                value={stats.peopleServed.toLocaleString()}
                label="Meals"
              />
              <View style={styles.mahiStatDivider} />
              <MahiStat value={`${stats.hoursContributed}`} label="Hours" />
              <View style={styles.mahiStatDivider} />
              <MahiStat value={`${stats.currentStreak}mo`} label="Streak" />
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Whānau ── */}
        <Animated.View
          entering={FadeInDown.delay(140).duration(520)}
          style={styles.section}
        >
          <SectionHeader
            title="Whānau"
            subtitle={`${friends.length} ${friends.length === 1 ? "friend" : "friends"}`}
            colors={colors}
          />
          {friends.length === 0 ? (
            <View
              style={[
                styles.emptyFriendsCard,
                { backgroundColor: colors.card },
              ]}
            >
              <Text style={{ fontSize: 22 }}>🤝</Text>
              <Text style={[styles.emptyFriendsText, { color: colors.text }]}>
                Your whānau grows with every shift
              </Text>
              <Text
                style={[
                  styles.emptyFriendsMeta,
                  { color: colors.textSecondary },
                ]}
              >
                Connect with volunteers you’ve served alongside.
              </Text>
            </View>
          ) : (
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
          )}
        </Animated.View>

        {/* ── Achievements ── */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(520)}
          style={styles.section}
        >
          <SectionHeader
            title="Achievements"
            subtitle={`${unlocked.length} unlocked · ${totalPoints} points`}
            colors={colors}
          />

          {latestUnlock && (
            <FeaturedUnlock
              achievement={latestUnlock}
              colors={colors}
              isDark={isDark}
              onPress={() => setSelectedAchievement(latestUnlock)}
            />
          )}

          {otherUnlocks.map((achievement) => (
            <AchievementRow
              key={achievement.id}
              achievement={achievement}
              colors={colors}
              isDark={isDark}
              type="unlocked"
              onPress={() => setSelectedAchievement(achievement)}
            />
          ))}

          {inProgress.length > 0 && (
            <>
              <View style={styles.subsectionHeader}>
                <View
                  style={[
                    styles.subsectionLine,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(14,58,35,0.14)",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.subsectionLabel,
                    { color: isDark ? "#86efac" : Brand.greenDark },
                  ]}
                >
                  NEXT GOALS
                </Text>
                <View
                  style={[
                    styles.subsectionLine,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(14,58,35,0.14)",
                    },
                  ]}
                />
              </View>
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
        </Animated.View>

        {/* ── Account actions ── */}
        <Animated.View
          entering={FadeInDown.delay(260).duration(520)}
          style={styles.settingsGroup}
        >
          <SettingsRow
            icon="person-outline"
            label="Edit profile"
            hint="Details, pronouns, emergency contact"
            colors={colors}
            isDark={isDark}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/profile/edit");
            }}
          />
          <View
            style={[
              styles.settingsDivider,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(14,58,35,0.06)",
              },
            ]}
          />
          <SettingsToggleRow
            icon="calendar-number-outline"
            label="Sync shifts to calendar"
            hint="Add upcoming shifts to your device calendar"
            value={calSyncEnabled}
            loading={calSyncBusy}
            colors={colors}
            isDark={isDark}
            onToggle={handleToggleCalendarSync}
          />
          <View
            style={[
              styles.settingsDivider,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(14,58,35,0.06)",
              },
            ]}
          />
          <SettingsRow
            icon="sparkles-outline"
            label="See the intro again"
            hint="Replay the welcome tour"
            colors={colors}
            isDark={isDark}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              showOnboarding();
            }}
          />
        </Animated.View>

        {/* ── Sign out ── */}
        <Animated.View entering={FadeInDown.delay(320).duration(520)}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert("Sign out", "Are you sure you want to sign out?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Sign out",
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
                opacity: pressed ? 0.6 : 1,
              },
            ]}
            accessibilityRole="button"
          >
            <Ionicons
              name="log-out-outline"
              size={16}
              color={colors.destructive}
            />
            <Text style={[styles.signOutText, { color: colors.destructive }]}>
              Sign out
            </Text>
          </Pressable>
        </Animated.View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <View
            style={[
              styles.footerOrnament,
              {
                backgroundColor: isDark
                  ? "rgba(134,239,172,0.25)"
                  : "rgba(14,58,35,0.2)",
              },
            ]}
          />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Ngā mihi nui for being part of the whānau
          </Text>
          <Text
            style={[styles.footerSubtext, { color: colors.textSecondary }]}
          >
            Everybody Eats · Aotearoa
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

/* ── Mahi stat (on the dark green panel) ── */

function MahiStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.mahiStatItem}>
      <Text style={styles.mahiStatValue}>{value}</Text>
      <Text style={styles.mahiStatLabel}>{label}</Text>
    </View>
  );
}

/* ── Section header ── */

function SectionHeader({
  title,
  subtitle,
  colors,
}: {
  title: string;
  subtitle: string;
  colors: (typeof Colors)["light"];
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
        {subtitle}
      </Text>
    </View>
  );
}

/* ── Featured latest unlock ── */

function FeaturedUnlock({
  achievement,
  colors,
  isDark,
  onPress,
}: {
  achievement: Achievement;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  onPress: () => void;
}) {
  const cat =
    CATEGORY_CONFIG[achievement.category] ?? CATEGORY_CONFIG.MILESTONE;
  const catColor = isDark ? cat.colorDark : cat.color;
  const catBg = isDark ? cat.bgDark : cat.bg;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.featuredCard,
        {
          backgroundColor: colors.card,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.995 : 1 }],
          borderColor: isDark
            ? "rgba(255,255,255,0.04)"
            : "rgba(14,58,35,0.04)",
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${achievement.name} — latest achievement`}
    >
      <View style={styles.featuredMeta}>
        <View style={[styles.featuredChip, { backgroundColor: catBg }]}>
          <Text style={[styles.featuredChipText, { color: catColor }]}>
            LATEST UNLOCK
          </Text>
        </View>
        {achievement.unlockedAt && (
          <Text
            style={[styles.featuredDate, { color: colors.textSecondary }]}
          >
            {formatNZT(new Date(achievement.unlockedAt), "d MMM")}
          </Text>
        )}
      </View>
      <View style={styles.featuredBody}>
        <View style={[styles.featuredIcon, { backgroundColor: catBg }]}>
          <Text style={{ fontSize: 30 }}>{achievement.icon}</Text>
        </View>
        <View style={styles.featuredText}>
          <Text style={[styles.featuredName, { color: colors.text }]}>
            {achievement.name}
          </Text>
          <Text
            style={[styles.featuredDesc, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {achievement.description}
          </Text>
          <View style={styles.featuredFooter}>
            <Text style={[styles.featuredPoints, { color: catColor }]}>
              ✨ {achievement.points} points earned
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={colors.textSecondary}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/* ── Achievement row ── */

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
          backgroundColor: colors.card,
          opacity: pressed ? 0.85 : 1,
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
          <Text style={[styles.achievementPoints, { color: catColor }]}>
            +{achievement.points}
          </Text>
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
                    : "#eef2e8",
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
  const unlockPctDisplay = (() => {
    if (totalVolunteers === 0 || unlockedByCount === 0) return "0";
    const raw = (unlockedByCount / totalVolunteers) * 100;
    if (raw < 1) return "<1";
    return String(Math.round(raw));
  })();

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

          <View style={achieveSheet.body}>
            {/* ── Title card (overlaps hero) ── */}
            <View
              style={[
                achieveSheet.titleCard,
                {
                  backgroundColor: colors.card,
                  shadowColor: isDark ? "#000" : "#0f172a",
                  borderColor: isDark ? colors.border : "#eef0ec",
                },
              ]}
            >
              <Text style={[achieveSheet.title, { color: colors.text }]}>
                {achievement.name}
              </Text>
              <View
                style={[
                  achieveSheet.titleRule,
                  { backgroundColor: catColor },
                ]}
              />
              <Text
                style={[
                  achieveSheet.description,
                  { color: colors.textSecondary },
                ]}
              >
                {achievement.description}
              </Text>

              <View
                style={[
                  achieveSheet.metaStrip,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "#fafaf6",
                    borderColor: isDark ? colors.border : "#eef0ec",
                  },
                ]}
              >
                <View style={achieveSheet.metaCell}>
                  <Text style={[achieveSheet.metaNum, { color: catColor }]}>
                    +{achievement.points}
                  </Text>
                  <Text
                    style={[
                      achieveSheet.metaLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Points
                  </Text>
                </View>
                <View
                  style={[
                    achieveSheet.metaDivider,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "#e8eae4",
                    },
                  ]}
                />
                <View style={achieveSheet.metaCell}>
                  <View style={achieveSheet.metaStatusRow}>
                    <Ionicons
                      name={
                        isUnlocked ? "checkmark-circle" : "time-outline"
                      }
                      size={16}
                      color={
                        isUnlocked
                          ? isDark
                            ? "#86efac"
                            : "#16a34a"
                          : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        achieveSheet.metaStatusText,
                        {
                          color: isUnlocked
                            ? isDark
                              ? "#86efac"
                              : "#16a34a"
                            : colors.text,
                        },
                      ]}
                    >
                      {isUnlocked ? "Unlocked" : "In progress"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      achieveSheet.metaLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Status
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Milestone / Progress ── */}
            {isUnlocked && achievement.unlockedAt ? (
              <View style={achieveSheet.section}>
                <View style={achieveSheet.sectionHeader}>
                  <View
                    style={[
                      achieveSheet.sectionAccent,
                      { backgroundColor: catColor },
                    ]}
                  />
                  <Text
                    style={[achieveSheet.sectionLabel, { color: catColor }]}
                  >
                    Milestone
                  </Text>
                </View>
                <View
                  style={[
                    achieveSheet.dataCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: isDark ? colors.border : "#eef0ec",
                    },
                  ]}
                >
                  <Text
                    style={[
                      achieveSheet.dateDay,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {formatNZT(new Date(achievement.unlockedAt), "EEEE")}
                  </Text>
                  <Text
                    style={[achieveSheet.dateMain, { color: colors.text }]}
                  >
                    {formatNZT(
                      new Date(achievement.unlockedAt),
                      "d MMMM yyyy",
                    )}
                  </Text>
                  <Text
                    style={[
                      achieveSheet.dateMeta,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Earned this badge — Ka pai!
                  </Text>
                </View>
              </View>
            ) : achievement.progress != null ? (
              <View style={achieveSheet.section}>
                <View style={achieveSheet.sectionHeader}>
                  <View
                    style={[
                      achieveSheet.sectionAccent,
                      { backgroundColor: catColor },
                    ]}
                  />
                  <Text
                    style={[achieveSheet.sectionLabel, { color: catColor }]}
                  >
                    Progress
                  </Text>
                </View>
                <View
                  style={[
                    achieveSheet.dataCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: isDark ? colors.border : "#eef0ec",
                    },
                  ]}
                >
                  <View style={achieveSheet.progressTopRow}>
                    <Text
                      style={[
                        achieveSheet.progressBigNum,
                        { color: colors.text },
                      ]}
                    >
                      {Math.round(achievement.progress * 100)}
                      <Text
                        style={[
                          achieveSheet.progressPct,
                          { color: colors.textSecondary },
                        ]}
                      >
                        %
                      </Text>
                    </Text>
                    {achievement.target && (
                      <View style={achieveSheet.progressGoal}>
                        <Text
                          style={[
                            achieveSheet.progressGoalLabel,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Toward
                        </Text>
                        <Text
                          style={[
                            achieveSheet.progressGoalText,
                            { color: colors.text },
                          ]}
                          numberOfLines={2}
                        >
                          {achievement.target}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View
                    style={[
                      achieveSheet.progressTrack,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.06)"
                          : "#f1f3ee",
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
                </View>
              </View>
            ) : null}

            {/* ── Rarity (with friends inline) ── */}
            <View style={achieveSheet.section}>
              <View style={achieveSheet.sectionHeader}>
                <View
                  style={[
                    achieveSheet.sectionAccent,
                    { backgroundColor: catColor },
                  ]}
                />
                <Text
                  style={[achieveSheet.sectionLabel, { color: catColor }]}
                >
                  Rarity
                </Text>
              </View>
              <View
                style={[
                  achieveSheet.dataCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isDark ? colors.border : "#eef0ec",
                  },
                ]}
              >
                <View style={achieveSheet.rarityRow}>
                  <View style={achieveSheet.rarityCell}>
                    <Text
                      style={[
                        achieveSheet.rarityNum,
                        { color: colors.text },
                      ]}
                    >
                      {unlockedByCount}
                    </Text>
                    <Text
                      style={[
                        achieveSheet.rarityLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {unlockedByCount === 1
                        ? "volunteer\nhas earned this"
                        : "volunteers\nhave earned this"}
                    </Text>
                  </View>
                  <View
                    style={[
                      achieveSheet.rarityDivider,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.08)"
                          : "#e8eae4",
                      },
                    ]}
                  />
                  <View style={achieveSheet.rarityCell}>
                    <Text
                      style={[
                        achieveSheet.rarityNum,
                        { color: colors.text },
                      ]}
                    >
                      {unlockPctDisplay}
                      <Text
                        style={[
                          achieveSheet.rarityPct,
                          { color: colors.textSecondary },
                        ]}
                      >
                        %
                      </Text>
                    </Text>
                    <Text
                      style={[
                        achieveSheet.rarityLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      of the{"\n"}whānau
                    </Text>
                  </View>
                </View>

                {achievement.friendsWhoEarned &&
                  achievement.friendsWhoEarned.length > 0 && (
                    <>
                      <View
                        style={[
                          achieveSheet.rarityHRule,
                          {
                            backgroundColor: isDark
                              ? "rgba(255,255,255,0.08)"
                              : "#e8eae4",
                          },
                        ]}
                      />
                      <Text
                        style={[
                          achieveSheet.friendsCaption,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Including {achievement.friendsWhoEarned.length} of your{" "}
                        {achievement.friendsWhoEarned.length === 1
                          ? "friend"
                          : "friends"}
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
                            <View
                              style={[
                                achieveSheet.friendAvatarRing,
                                { borderColor: catBg },
                              ]}
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
                            </View>
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
                                achieveSheet.friendAvatarRing,
                                { borderColor: catBg },
                              ]}
                            >
                              <View
                                style={[
                                  achieveSheet.friendAvatarFallback,
                                  {
                                    backgroundColor: isDark
                                      ? "rgba(255,255,255,0.06)"
                                      : "#f1f3ee",
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
                            <Text
                              style={[
                                achieveSheet.friendName,
                                { color: colors.textSecondary },
                              ]}
                              numberOfLines={1}
                            >
                              more
                            </Text>
                          </View>
                        )}
                      </View>
                    </>
                  )}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/* ── Friend Card ── */

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
          opacity: pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
          borderColor: isDark
            ? "rgba(255,255,255,0.03)"
            : "rgba(14,58,35,0.04)",
        },
      ]}
      accessibilityLabel={`${friend.name}, ${friend.shiftsTogether} shifts together`}
      accessibilityRole="button"
    >
      <View style={styles.friendAvatarWrap}>
        <View
          style={[
            styles.friendAvatarRing,
            {
              borderColor: isDark
                ? "rgba(134,239,172,0.15)"
                : "rgba(14,58,35,0.08)",
            },
          ]}
        >
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
        </View>
      </View>

      <Text
        style={[styles.friendName, { color: colors.text }]}
        numberOfLines={1}
      >
        {friend.name.split(" ")[0]}
      </Text>
      <View
        style={[
          styles.friendMetaPill,
          {
            backgroundColor: isDark
              ? "rgba(134,239,172,0.08)"
              : "rgba(14,58,35,0.05)",
          },
        ]}
      >
        <Text
          style={[
            styles.friendMeta,
            { color: isDark ? "#86efac" : Brand.greenDark },
          ]}
        >
          {friend.shiftsTogether} shifts
        </Text>
      </View>
    </Pressable>
  );
}

/* ── Settings row ── */

function SettingsRow({
  icon,
  label,
  hint,
  colors,
  isDark,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        { opacity: pressed ? 0.7 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.settingsIcon,
          {
            backgroundColor: isDark
              ? "rgba(134,239,172,0.10)"
              : Brand.greenLight,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={isDark ? "#86efac" : Brand.green}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.settingsLabel, { color: colors.text }]}>
          {label}
        </Text>
        <Text style={[styles.settingsHint, { color: colors.textSecondary }]}>
          {hint}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.textSecondary}
      />
    </Pressable>
  );
}

/* ── Settings toggle row ── */

function SettingsToggleRow({
  icon,
  label,
  hint,
  value,
  loading,
  colors,
  isDark,
  onToggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  value: boolean;
  loading: boolean;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <View style={styles.settingsRow} accessibilityRole="switch">
      <View
        style={[
          styles.settingsIcon,
          {
            backgroundColor: isDark
              ? "rgba(134,239,172,0.10)"
              : Brand.greenLight,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={isDark ? "#86efac" : Brand.green}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.settingsLabel, { color: colors.text }]}>
          {label}
        </Text>
        <Text style={[styles.settingsHint, { color: colors.textSecondary }]}>
          {hint}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      ) : (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: undefined, true: Brand.green }}
          thumbColor={Platform.OS === "android" ? Brand.accent : undefined}
          accessibilityLabel={label}
        />
      )}
    </View>
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

  /* Hero */
  hero: {
    alignItems: "center",
    marginBottom: 28,
  },
  avatarWrap: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  avatarHalo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#ffffff",
    fontSize: 38,
    fontFamily: FontFamily.headingBold,
  },
  avatarBadge: {
    position: "absolute",
    bottom: 4,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  heroGreeting: {
    fontSize: 14,
    fontFamily: FontFamily.heading,
    fontStyle: "italic",
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  heroName: {
    fontSize: 30,
    fontFamily: FontFamily.headingBold,
    lineHeight: 36,
    textAlign: "center",
    marginBottom: 10,
  },
  heroMeta: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.3,
  },

  /* Your Mahi impact panel */
  mahiContainer: {
    marginBottom: 28,
  },
  mahiCard: {
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 24,
    overflow: "hidden",
  },
  mahiBloomOuter: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(248,251,105,0.06)",
    top: -140,
    right: -100,
  },
  mahiBloomInner: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(248,251,105,0.04)",
    bottom: -60,
    left: -40,
  },
  mahiLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  mahiLabelLine: {
    width: 20,
    height: 2,
    borderRadius: 1,
  },
  mahiLabel: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    color: Brand.accent,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  mahiHero: {
    marginTop: 2,
    marginBottom: 22,
  },
  mahiHeroNumber: {
    fontSize: 56,
    lineHeight: 62,
    fontFamily: FontFamily.headingBold,
    color: "#ffffff",
    letterSpacing: -1.5,
  },
  mahiHeroCaption: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    color: "rgba(255,253,247,0.85)",
    marginTop: 2,
    fontStyle: "italic",
  },
  mahiDivider: {
    height: 1,
    backgroundColor: "rgba(255,253,247,0.14)",
    marginBottom: 18,
  },
  mahiStatsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  mahiStatItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  mahiStatValue: {
    fontSize: 22,
    fontFamily: FontFamily.headingBold,
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  mahiStatLabel: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: "rgba(255,253,247,0.7)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  mahiStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,253,247,0.14)",
  },

  /* Section */
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.2,
  },

  /* Whānau */
  friendsScroll: {
    gap: 10,
    paddingRight: 4,
  },
  friendCard: {
    width: 114,
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
  },
  friendAvatarWrap: {
    position: "relative",
  },
  friendAvatarRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  friendAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  friendAvatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  friendAvatarInitial: {
    color: "#ffffff",
    fontSize: 20,
    fontFamily: FontFamily.headingBold,
  },
  friendName: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    textAlign: "center",
  },
  friendMetaPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  friendMeta: {
    fontSize: 10.5,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  emptyFriendsCard: {
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 6,
  },
  emptyFriendsText: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    textAlign: "center",
    marginTop: 4,
  },
  emptyFriendsMeta: {
    fontSize: 12.5,
    fontFamily: FontFamily.regular,
    textAlign: "center",
  },

  /* Featured unlock */
  featuredCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 10,
    gap: 14,
    borderWidth: 1,
  },
  featuredMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featuredChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featuredChipText: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    letterSpacing: 1,
  },
  featuredDate: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.3,
  },
  featuredBody: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  featuredIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredText: {
    flex: 1,
    gap: 4,
  },
  featuredName: {
    fontSize: 18,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.2,
  },
  featuredDesc: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  featuredFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  featuredPoints: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
  },

  /* Subsection divider */
  subsectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  subsectionLine: {
    flex: 1,
    height: 1,
  },
  subsectionLabel: {
    fontSize: 10.5,
    fontFamily: FontFamily.bold,
    letterSpacing: 1.5,
  },

  /* Achievement row */
  achievementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
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
  achievementPoints: {
    fontSize: 13,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.2,
  },
  unlockedDate: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    marginTop: 2,
  },

  /* Progress bar */
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
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

  /* Settings group */
  settingsGroup: {
    marginBottom: 20,
    borderRadius: 18,
    backgroundColor: "transparent",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsLabel: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
  settingsHint: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },
  settingsDivider: {
    height: 1,
    marginLeft: 58,
  },

  /* Sign out */
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 4,
  },
  signOutText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    letterSpacing: 0.3,
  },

  /* Footer */
  footer: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 8,
    gap: 6,
  },
  footerOrnament: {
    width: 24,
    height: 2,
    borderRadius: 1,
    marginBottom: 6,
  },
  footerText: {
    fontSize: 13,
    fontFamily: FontFamily.heading,
    textAlign: "center",
    fontStyle: "italic",
  },
  footerSubtext: {
    fontSize: 10,
    fontFamily: FontFamily.medium,
    textAlign: "center",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    opacity: 0.7,
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
  body: {
    paddingHorizontal: 16,
    gap: 22,
  },

  /* Title card (overlaps hero) */
  titleCard: {
    marginTop: -18,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: "center",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontFamily: FontFamily.headingBold,
    lineHeight: 30,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  titleRule: {
    width: 28,
    height: 2,
    borderRadius: 1,
    marginTop: 12,
    marginBottom: 12,
    opacity: 0.7,
  },
  description: {
    fontSize: 15,
    fontFamily: FontFamily.regular,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
  },

  /* Meta strip — points + status */
  metaStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    alignSelf: "stretch",
    marginTop: 18,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  metaCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  metaNum: {
    fontSize: 22,
    fontFamily: FontFamily.heading,
    fontVariant: ["tabular-nums"],
    lineHeight: 26,
  },
  metaStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 26,
  },
  metaStatusText: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
  metaLabel: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginTop: 2,
  },
  metaDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: 4,
  },

  /* Section header (label above each card) */
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 4,
  },
  sectionAccent: {
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },

  /* Generic data card */
  dataCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
  },

  /* Milestone date block */
  dateDay: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  dateMain: {
    fontSize: 26,
    fontFamily: FontFamily.heading,
    lineHeight: 32,
    letterSpacing: -0.4,
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  dateMeta: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    marginTop: 8,
  },

  /* Progress block */
  progressTopRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 16,
  },
  progressBigNum: {
    fontSize: 38,
    fontFamily: FontFamily.heading,
    lineHeight: 42,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  progressPct: {
    fontSize: 22,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.5,
  },
  progressGoal: {
    flex: 1,
    alignItems: "flex-end",
    gap: 3,
  },
  progressGoalLabel: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  progressGoalText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    textAlign: "right",
    lineHeight: 17,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },

  /* Rarity block */
  rarityRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rarityCell: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  rarityNum: {
    fontSize: 32,
    fontFamily: FontFamily.heading,
    lineHeight: 36,
    letterSpacing: -0.6,
    fontVariant: ["tabular-nums"],
  },
  rarityPct: {
    fontSize: 22,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.4,
  },
  rarityLabel: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 2,
  },
  rarityDivider: {
    width: StyleSheet.hairlineWidth,
    height: 56,
    marginHorizontal: 8,
  },
  rarityHRule: {
    height: StyleSheet.hairlineWidth,
    marginTop: 18,
    marginBottom: 16,
    marginHorizontal: -4,
  },
  friendsCaption: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    marginBottom: 12,
  },

  /* Friends */
  friendsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    rowGap: 16,
  },
  friendItem: {
    alignItems: "center",
    gap: 6,
    width: 52,
  },
  friendAvatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  friendAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  friendInitial: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: FontFamily.bold,
  },
  friendName: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    textAlign: "center",
    width: "100%",
  },
  friendMoreText: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },
});
