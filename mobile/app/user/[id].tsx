import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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
        <Stack.Screen options={{ title: "", headerTransparent: true }} />
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
        <Stack.Screen options={{ title: "", headerTransparent: true }} />
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

  const heroHeight = insets.top + 128;
  const avatarSize = 104;
  const accentShapeSize = 220;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "",
          headerTransparent: true,
          headerTintColor: "#fffdf7",
        }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 24) + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero canvas ────────────────────────────────── */}
        <View style={[styles.hero, { height: heroHeight }]}>
          <LinearGradient
            colors={
              isDark
                ? ["#13311f", Brand.greenDark]
                : [Brand.green, "#0b2c1a"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.accentShape,
              {
                width: accentShapeSize,
                height: accentShapeSize,
                top: heroHeight - accentShapeSize * 0.55,
                right: -accentShapeSize * 0.35,
                backgroundColor: isDark ? "#2a3b1a" : Brand.accent,
                opacity: isDark ? 0.55 : 0.85,
              },
            ]}
          />
          <View
            style={[
              styles.gridDot,
              { top: insets.top + 8, left: 24, opacity: isDark ? 0.4 : 0.5 },
            ]}
          />
          <View
            style={[
              styles.gridDot,
              { top: insets.top + 8, left: 40, opacity: isDark ? 0.2 : 0.25 },
            ]}
          />
          <View
            style={[
              styles.gridDot,
              { top: insets.top + 24, left: 24, opacity: isDark ? 0.2 : 0.25 },
            ]}
          />
        </View>

        {/* ── Identity block ───────────────────────────── */}
        <View style={[styles.identityBlock, { marginTop: -avatarSize / 2 }]}>
          <View style={styles.avatarWrap}>
            {profile.profilePhotoUrl ? (
              <Image
                source={{ uri: profile.profilePhotoUrl }}
                style={[
                  styles.avatar,
                  {
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                    borderColor: colors.background,
                  },
                ]}
              />
            ) : (
              <View
                style={[
                  styles.avatarFallback,
                  {
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                    borderColor: colors.background,
                    backgroundColor: isDark ? "#223524" : Brand.greenLight,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.avatarInitial,
                    { color: isDark ? Brand.greenLight : Brand.green },
                  ]}
                >
                  {profile.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.heroName, { color: colors.text }]}>
            {profile.name}
          </Text>
          <Text style={[styles.heroTagline, { color: colors.textSecondary }]}>
            Everybody Eats volunteer
          </Text>
        </View>

        {/* ── Stats bento ──────────────────────────────── */}
        <View style={styles.bento}>
          <View
            style={[
              styles.bentoCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.bentoLabel, { color: colors.textSecondary }]}
            >
              THEIR SHIFTS
            </Text>
            <Text style={[styles.bentoValue, { color: colors.text }]}>
              {profile.totalShifts}
            </Text>
          </View>
          <View
            style={[
              styles.bentoCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.bentoLabel, { color: colors.textSecondary }]}
            >
              THEIR HOURS
            </Text>
            <Text style={[styles.bentoValue, { color: colors.text }]}>
              {profile.hoursVolunteered}
            </Text>
          </View>
        </View>

        {/* ── Friendship action ────────────────────────── */}
        <SectionHeading title="Connect" colors={colors} />
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

        {/* ── Safety actions ───────────────────────────── */}
        <View style={[styles.section, styles.safetyRow]}>
          <Pressable
            onPress={handleReport}
            style={({ pressed }) => [
              styles.safetyBtn,
              {
                borderColor: colors.border,
                backgroundColor: "transparent",
                opacity: pressed ? 0.6 : 1,
              },
            ]}
            accessibilityLabel="Report this volunteer"
            accessibilityRole="button"
          >
            <Ionicons
              name={profile.hasReported ? "flag" : "flag-outline"}
              size={15}
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
                borderColor: isDark ? "rgba(239,68,68,0.35)" : "#fecaca",
                backgroundColor: "transparent",
                opacity: pressed || isBlocking || profile.isBlocked ? 0.6 : 1,
              },
            ]}
            accessibilityLabel="Block this volunteer"
            accessibilityRole="button"
          >
            <Ionicons
              name="ban-outline"
              size={15}
              color={isDark ? "#fca5a5" : "#dc2626"}
            />
            <Text
              style={[
                styles.safetyBtnText,
                { color: isDark ? "#fca5a5" : "#dc2626" },
              ]}
            >
              {profile.isBlocked
                ? "Blocked"
                : isBlocking
                ? "Blocking…"
                : "Block"}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.footerNote, { color: colors.textSecondary }]}>
          Kia tūpato — treat our whānau with manaakitanga. Reports are reviewed
          within 24 hours.
        </Text>
      </ScrollView>
    </View>
  );
}

/* ─── Sub-components ────────────────────────────────────────── */

function SectionHeading({
  title,
  colors,
}: {
  title: string;
  colors: (typeof Colors)["light"];
}) {
  return (
    <View style={styles.sectionMarker}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <View
        style={[styles.sectionMarkerRule, { backgroundColor: colors.border }]}
      />
    </View>
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
      <View style={{ gap: 12 }}>
        <StatusCard
          eyebrow="YOU'RE CONNECTED"
          title="You're friends 💚"
          ruleColor={isDark ? Brand.accent : Brand.green}
          colors={colors}
          isDark={isDark}
        />
        <Pressable
          onPress={onViewFullProfile}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: isDark ? Brand.accent : Brand.green,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
          accessibilityLabel={`View full profile for ${firstName}`}
          accessibilityRole="button"
        >
          <Ionicons
            name="arrow-forward"
            size={18}
            color={isDark ? Brand.green : "#fffdf7"}
          />
          <Text
            style={[
              styles.primaryBtnText,
              { color: isDark ? Brand.green : "#fffdf7" },
            ]}
          >
            View full profile
          </Text>
        </Pressable>
      </View>
    );
  }

  if (status === "REQUEST_SENT") {
    return (
      <StatusCard
        eyebrow="PENDING"
        title={`Request sent — hang tight ⏳`}
        ruleColor={isDark ? "#fde047" : "#b45309"}
        colors={colors}
        isDark={isDark}
      />
    );
  }

  if (status === "REQUEST_RECEIVED") {
    return (
      <StatusCard
        eyebrow="INCOMING"
        title={`${firstName} sent you a request — check your friends tab 💌`}
        ruleColor={isDark ? "#93c5fd" : "#1d4ed8"}
        colors={colors}
        isDark={isDark}
      />
    );
  }

  // NONE
  if (!allowFriendRequests) {
    return (
      <StatusCard
        eyebrow="PRIVATE"
        title={`${firstName} isn't accepting new friend requests`}
        ruleColor={colors.border}
        colors={colors}
        isDark={isDark}
      />
    );
  }

  return (
    <Pressable
      onPress={onAddFriend}
      disabled={isSending}
      style={({ pressed }) => [
        styles.primaryBtn,
        {
          backgroundColor: isDark ? Brand.accent : Brand.green,
          opacity: pressed || isSending ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
      accessibilityLabel={`Add ${firstName} as a friend`}
      accessibilityRole="button"
    >
      {isSending ? (
        <ActivityIndicator
          size="small"
          color={isDark ? Brand.green : "#fffdf7"}
        />
      ) : (
        <Ionicons
          name="person-add-outline"
          size={18}
          color={isDark ? Brand.green : "#fffdf7"}
        />
      )}
      <Text
        style={[
          styles.primaryBtnText,
          { color: isDark ? Brand.green : "#fffdf7" },
        ]}
      >
        {isSending ? "Sending…" : "Add friend"}
      </Text>
    </Pressable>
  );
}

function StatusCard({
  eyebrow,
  title,
  ruleColor,
  colors,
  isDark,
}: {
  eyebrow: string;
  title: string;
  ruleColor: string;
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  return (
    <View
      style={[
        styles.statusCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.statusRule, { backgroundColor: ruleColor }]} />
      <View style={styles.statusBody}>
        <Text style={[styles.statusEyebrow, { color: colors.textSecondary }]}>
          {eyebrow}
        </Text>
        <Text style={[styles.statusTitle, { color: colors.text }]}>
          {title}
        </Text>
      </View>
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────────── */

const HORIZONTAL = 22;

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

  /* Hero */
  hero: {
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  accentShape: {
    position: "absolute",
    borderRadius: 999,
  },
  gridDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#fffdf7",
  },
  /* Identity */
  identityBlock: {
    alignItems: "center",
    paddingHorizontal: HORIZONTAL,
  },
  avatarWrap: {
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  avatar: {
    borderWidth: 4,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
  },
  avatarInitial: {
    fontSize: 44,
    fontFamily: FontFamily.headingBold,
  },
  heroName: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: FontFamily.headingBold,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  heroTagline: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontStyle: "italic",
    textAlign: "center",
  },

  /* Bento */
  bento: {
    flexDirection: "row",
    gap: 10,
    marginTop: 26,
    marginHorizontal: HORIZONTAL,
  },
  bentoCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  bentoLabel: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1.2,
  },
  bentoValue: {
    fontSize: 34,
    lineHeight: 36,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },

  /* Section heading */
  sectionMarker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: HORIZONTAL,
    marginTop: 32,
    marginBottom: 14,
  },
  sectionMarkerRule: {
    height: StyleSheet.hairlineWidth,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.3,
  },

  /* Section */
  section: {
    paddingHorizontal: HORIZONTAL,
    gap: 12,
  },

  /* Status card */
  statusCard: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  statusRule: {
    width: 4,
  },
  statusBody: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  statusEyebrow: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1.1,
  },
  statusTitle: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    lineHeight: 20,
  },

  /* Buttons */
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.2,
  },

  /* Safety */
  safetyRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  safetyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  safetyBtnText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
  },

  /* Footer */
  footerNote: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    textAlign: "center",
    marginTop: 18,
    paddingHorizontal: 32,
    fontStyle: "italic",
    lineHeight: 17,
  },
});
