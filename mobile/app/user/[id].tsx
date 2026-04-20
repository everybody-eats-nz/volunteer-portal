import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  useUserProfile,
  type UserFriendshipStatus,
} from "@/hooks/use-user-profile";
import { api } from "@/lib/api";

const GRADE_CONFIG: Record<
  string,
  { label: string; color: string; colorDark: string; emoji: string }
> = {
  GREEN: { label: "Green", color: "#22c55e", colorDark: "#86efac", emoji: "🌿" },
  YELLOW: { label: "Yellow", color: "#eab308", colorDark: "#fde047", emoji: "⭐" },
  PINK: { label: "Pink", color: "#ec4899", colorDark: "#f9a8d4", emoji: "💖" },
};

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const { profile, isLoading, error, setProfile } = useUserProfile(id);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  const firstName = profile?.firstName ?? profile?.name.split(" ")[0] ?? "them";

  // If the viewer opens their own profile, send them to the profile tab.
  useEffect(() => {
    if (profile?.isSelf) {
      router.replace("/(tabs)/profile");
    }
  }, [profile?.isSelf, router]);

  const handleAddFriend = async () => {
    if (!profile) return;
    if (!profile.allowFriendRequests) {
      Alert.alert(
        "Not accepting requests",
        `${firstName} isn't accepting new friend requests right now.`
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSendingRequest(true);
    try {
      await api(`/api/mobile/users/${profile.id}/friend-request`, {
        method: "POST",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setProfile((prev) =>
        prev ? { ...prev, friendshipStatus: "REQUEST_SENT" } : prev
      );
    } catch {
      Alert.alert(
        "Couldn't send request",
        "Please try again in a moment."
      );
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleReport = () => {
    if (!profile) return;
    Alert.alert(
      "Report this volunteer",
      profile.hasReported
        ? "You've already reported this volunteer. The Everybody Eats team will review within 24 hours."
        : `Help keep our whānau safe. Why are you reporting ${firstName}?`,
      profile.hasReported
        ? [{ text: "OK", style: "cancel" }]
        : [
            {
              text: "🚩 Offensive or abusive behaviour",
              onPress: () => submitReport("Offensive or abusive content"),
            },
            {
              text: "🚩 Harassment",
              onPress: () => submitReport("Harassment"),
            },
            {
              text: "🚩 Spam",
              onPress: () => submitReport("Spam"),
            },
            { text: "Cancel", style: "cancel" },
          ]
    );
  };

  const submitReport = async (reason: string) => {
    if (!profile) return;
    try {
      await api("/api/mobile/report", {
        method: "POST",
        body: { targetType: "user", targetId: profile.id, reason },
      });
      setProfile((prev) => (prev ? { ...prev, hasReported: true } : prev));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Report submitted",
        "Thank you. The Everybody Eats team will review within 24 hours."
      );
    } catch {
      Alert.alert("Error", "Could not submit report. Please try again.");
    }
  };

  const handleBlock = () => {
    if (!profile) return;
    if (profile.isBlocked) {
      Alert.alert(
        "Already blocked",
        `${firstName} is blocked. Their content won't appear in your feed.`
      );
      return;
    }
    Alert.alert(
      "Block this volunteer?",
      `${firstName}'s posts and comments will be hidden from your feed. The Everybody Eats team will be notified.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            setIsBlocking(true);
            try {
              await api(`/api/mobile/users/${profile.id}/block`, {
                method: "POST",
              });
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              Alert.alert(
                "User blocked",
                `${firstName} has been blocked.`,
                [{ text: "OK", onPress: () => router.back() }]
              );
            } catch {
              Alert.alert(
                "Error",
                "Could not block this user. Please try again."
              );
            } finally {
              setIsBlocking(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={Brand.green} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <Text style={{ fontSize: 48, marginBottom: 12 }}>😕</Text>
        <ThemedText type="heading">Volunteer not found</ThemedText>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text
            style={[
              styles.backLinkText,
              { color: isDark ? Brand.greenLight : Brand.green },
            ]}
          >
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  const grade = GRADE_CONFIG[profile.grade] ?? GRADE_CONFIG.GREEN;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + 44,
        paddingBottom: Math.max(insets.bottom, 20) + 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Profile Header ── */}
      <View
        style={[
          styles.headerCard,
          { backgroundColor: isDark ? Brand.greenDark : Brand.green },
        ]}
      >
        <View style={[styles.decoCircle, styles.decoCircle1]} />
        <View style={[styles.decoCircle, styles.decoCircle2]} />
        <View style={styles.headerContent}>
          {profile.profilePhotoUrl ? (
            <Image
              source={{ uri: profile.profilePhotoUrl }}
              style={styles.avatarImage}
            />
          ) : (
            <View
              style={[
                styles.avatarFallback,
                { backgroundColor: "rgba(255,255,255,0.2)" },
              ]}
            >
              <Text style={styles.avatarInitial}>
                {profile.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <ThemedText type="title" style={styles.headerName}>
            {profile.name}
          </ThemedText>

          <View style={styles.gradePill}>
            <Text style={{ fontSize: 12 }}>{grade.emoji}</Text>
            <Text style={styles.gradePillText}>{grade.label} volunteer</Text>
          </View>
        </View>
      </View>

      {/* ── Minimal Stats ── */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={styles.statEmoji}>🍽️</Text>
          <Text
            style={[
              styles.statValue,
              { color: isDark ? Brand.greenLight : Brand.green },
            ]}
          >
            {profile.totalShifts}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Shifts
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Text style={styles.statEmoji}>⏱️</Text>
          <Text
            style={[
              styles.statValue,
              { color: isDark ? "#60a5fa" : "#2563eb" },
            ]}
          >
            {profile.hoursVolunteered}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Hours
          </Text>
        </View>
      </View>

      {/* ── Friendship action ── */}
      <View style={styles.section}>
        <FriendshipAction
          status={profile.friendshipStatus}
          firstName={firstName}
          allowFriendRequests={profile.allowFriendRequests}
          isSending={isSendingRequest}
          onAddFriend={handleAddFriend}
          onViewFullProfile={() =>
            router.replace({
              pathname: "/friend/[id]",
              params: { id: profile.id },
            })
          }
          colors={colors}
          isDark={isDark}
        />
      </View>

      {/* ── Safety Actions ── */}
      <View style={[styles.section, styles.safetyRow]}>
        <Pressable
          onPress={handleReport}
          style={({ pressed }) => [
            styles.safetyBtn,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityLabel="Report this volunteer"
          accessibilityRole="button"
        >
          <Ionicons
            name={profile.hasReported ? "flag" : "flag-outline"}
            size={16}
            color={profile.hasReported ? "#dc2626" : colors.textSecondary}
          />
          <Text
            style={[
              styles.safetyBtnText,
              {
                color: profile.hasReported
                  ? "#dc2626"
                  : colors.textSecondary,
              },
            ]}
          >
            {profile.hasReported ? "Reported" : "Report"}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleBlock}
          disabled={isBlocking || profile.isBlocked}
          style={({ pressed }) => [
            styles.safetyBtn,
            {
              borderColor: "#fca5a5",
              backgroundColor: isDark
                ? "rgba(220,38,38,0.08)"
                : "#fff5f5",
              opacity: pressed || isBlocking || profile.isBlocked ? 0.6 : 1,
            },
          ]}
          accessibilityLabel="Block this volunteer"
          accessibilityRole="button"
        >
          <Ionicons name="ban-outline" size={16} color="#dc2626" />
          <Text style={[styles.safetyBtnText, { color: "#dc2626" }]}>
            {profile.isBlocked
              ? "Blocked"
              : isBlocking
              ? "Blocking…"
              : "Block"}
          </Text>
        </Pressable>
      </View>

      {/* ── Footer note ── */}
      <Text style={[styles.footerNote, { color: colors.textSecondary }]}>
        Kia tūpato — treat our whānau with manaakitanga. Reports are reviewed
        within 24 hours.
      </Text>
    </ScrollView>
  );
}

function FriendshipAction({
  status,
  firstName,
  allowFriendRequests,
  isSending,
  onAddFriend,
  onViewFullProfile,
  colors,
  isDark,
}: {
  status: UserFriendshipStatus;
  firstName: string;
  allowFriendRequests: boolean;
  isSending: boolean;
  onAddFriend: () => void;
  onViewFullProfile: () => void;
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  if (status === "FRIENDS") {
    return (
      <View style={{ gap: 10 }}>
        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: isDark
                ? "rgba(14,58,35,0.2)"
                : Brand.greenLight,
            },
          ]}
        >
          <Ionicons
            name="people"
            size={18}
            color={isDark ? Brand.greenLight : Brand.green}
          />
          <Text
            style={[
              styles.statusCardText,
              { color: isDark ? Brand.greenLight : Brand.green },
            ]}
          >
            You&apos;re friends 💚
          </Text>
        </View>
        <Pressable
          onPress={onViewFullProfile}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: Brand.green,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
          accessibilityLabel={`View full profile for ${firstName}`}
          accessibilityRole="button"
        >
          <Ionicons name="person-circle-outline" size={18} color="#ffffff" />
          <Text style={styles.primaryBtnText}>View full profile</Text>
        </Pressable>
      </View>
    );
  }

  if (status === "REQUEST_SENT") {
    return (
      <View
        style={[
          styles.statusCard,
          {
            backgroundColor: isDark
              ? "rgba(251, 191, 36, 0.12)"
              : "#fffbeb",
          },
        ]}
      >
        <Ionicons
          name="time-outline"
          size={18}
          color={isDark ? "#fde047" : "#b45309"}
        />
        <Text
          style={[
            styles.statusCardText,
            { color: isDark ? "#fde047" : "#b45309" },
          ]}
        >
          Request sent — hang tight ⏳
        </Text>
      </View>
    );
  }

  if (status === "REQUEST_RECEIVED") {
    return (
      <View
        style={[
          styles.statusCard,
          {
            backgroundColor: isDark
              ? "rgba(59, 130, 246, 0.12)"
              : "#eff6ff",
          },
        ]}
      >
        <Ionicons
          name="mail-unread-outline"
          size={18}
          color={isDark ? "#93c5fd" : "#1d4ed8"}
        />
        <Text
          style={[
            styles.statusCardText,
            { color: isDark ? "#93c5fd" : "#1d4ed8" },
          ]}
        >
          {firstName} sent you a friend request — check your friends tab 💌
        </Text>
      </View>
    );
  }

  // NONE
  if (!allowFriendRequests) {
    return (
      <View
        style={[
          styles.statusCard,
          {
            backgroundColor: isDark
              ? "rgba(255,255,255,0.04)"
              : "#f1f5f9",
          },
        ]}
      >
        <Ionicons
          name="lock-closed-outline"
          size={18}
          color={colors.textSecondary}
        />
        <Text
          style={[styles.statusCardText, { color: colors.textSecondary }]}
        >
          {firstName} isn&apos;t accepting new friend requests
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onAddFriend}
      disabled={isSending}
      style={({ pressed }) => [
        styles.primaryBtn,
        {
          backgroundColor: Brand.green,
          opacity: pressed || isSending ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
      accessibilityLabel={`Add ${firstName} as a friend`}
      accessibilityRole="button"
    >
      {isSending ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <Ionicons name="person-add-outline" size={18} color="#ffffff" />
      )}
      <Text style={styles.primaryBtnText}>
        {isSending ? "Sending…" : "Add friend"}
      </Text>
    </Pressable>
  );
}

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

  /* Header */
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
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 12,
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarFallback: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarInitial: {
    color: "#ffffff",
    fontSize: 34,
    fontFamily: FontFamily.bold,
  },
  headerName: {
    color: "#ffffff",
    textAlign: "center",
  },
  gradePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  gradePillText: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
  },

  /* Stats */
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  statEmoji: {
    fontSize: 22,
  },
  statValue: {
    fontSize: 22,
    fontFamily: FontFamily.bold,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  /* Sections */
  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },

  /* Status card (friends / request sent / etc.) */
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
  },
  statusCardText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },

  /* Buttons */
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },

  /* Safety actions */
  safetyRow: {
    flexDirection: "row",
    gap: 10,
  },
  safetyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  safetyBtnText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
  },

  /* Footer note */
  footerNote: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    textAlign: "center",
    paddingHorizontal: 32,
    marginTop: 20,
    lineHeight: 18,
  },
});
