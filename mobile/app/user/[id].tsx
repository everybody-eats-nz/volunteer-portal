import { Ionicons } from "@expo/vector-icons";
import { differenceInDays } from "date-fns";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
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
import { Eyebrow } from "@/components/ui/eyebrow";
import { Brand, Colors, FontFamily, Palette } from "@/constants/theme";
import { formatNZT } from "@/lib/dates";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  useUserProfile,
  type UserConnection,
  type UserFriendshipStatus,
  type UserProfile,
} from "@/hooks/use-user-profile";
import { api } from "@/lib/api";
import { getShiftThemeByName } from "@/lib/dummy-data";

/**
 * Unified volunteer profile screen.
 *
 * Renders one of two views from a single fetch:
 * - Trimmed (not-friends): identity + minimal stats + connect / safety actions.
 * - Full (friends): adds connection bento, monthly rhythm, favourite role,
 *   shared-moments timeline, the friend's upcoming shifts, and remove-friend.
 *
 * Both states share the same hero/identity/safety footer so the transition
 * from "stranger → friend" inside the same session feels continuous.
 */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const { profile, isLoading, error, setProfile, refresh } = useUserProfile(id);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [respondingTo, setRespondingTo] = useState<"accept" | "decline" | null>(
    null
  );

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
      Alert.alert("Couldn't send request", "Please try again in a moment.");
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!profile?.friendRequestId || respondingTo) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRespondingTo("accept");
    try {
      await api(
        `/api/mobile/friends/requests/${profile.friendRequestId}/accept`,
        { method: "POST" }
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Pull the freshly-friends payload (now includes the connection block)
      // so the screen flips to the rich layout without a manual reload. The
      // request itself succeeded at this point, so a refresh failure only
      // delays the rich view — tell the user they're connected either way.
      try {
        await refresh();
      } catch {
        Alert.alert(
          "You're connected!",
          `You're now friends with ${firstName}. Pull to refresh to see their full profile.`
        );
      }
    } catch {
      Alert.alert("Couldn't accept request", "Please try again in a moment.");
    } finally {
      setRespondingTo(null);
    }
  };

  const handleDeclineRequest = () => {
    if (!profile?.friendRequestId || respondingTo) return;
    Alert.alert(
      "Decline request?",
      `${firstName} won't be notified — you can still send them a request later if you change your mind.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            if (!profile?.friendRequestId) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setRespondingTo("decline");
            try {
              await api(
                `/api/mobile/friends/requests/${profile.friendRequestId}/decline`,
                { method: "POST" }
              );
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              setProfile((prev) =>
                prev
                  ? { ...prev, friendshipStatus: "NONE", friendRequestId: null }
                  : prev
              );
            } catch {
              Alert.alert(
                "Couldn't decline request",
                "Please try again in a moment."
              );
            } finally {
              setRespondingTo(null);
            }
          },
        },
      ]
    );
  };

  const handleRemoveFriend = () => {
    if (!profile) return;
    Alert.alert(
      "Remove friend",
      `Remove ${firstName} from your friends? You can send a new friend request anytime.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setIsRemoving(true);
            try {
              await api(`/api/mobile/friends/${profile.id}`, {
                method: "DELETE",
              });
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              router.back();
            } catch {
              Alert.alert(
                "Error",
                "Could not remove this friend. Please try again."
              );
            } finally {
              setIsRemoving(false);
            }
          },
        },
      ]
    );
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
              text: "Offensive or abusive behaviour",
              onPress: () => submitReport("Offensive or abusive content"),
            },
            {
              text: "Harassment",
              onPress: () => submitReport("Harassment"),
            },
            {
              text: "Spam",
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
              Alert.alert("User blocked", `${firstName} has been blocked.`, [
                { text: "OK", onPress: () => router.back() },
              ]);
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

  const isFriends = profile.friendshipStatus === "FRIENDS";
  const heroHeight = insets.top + 128;
  const avatarSize = 104;
  const accentShapeSize = 220;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "",
          headerTransparent: true,
          headerTintColor: Palette.cream50,
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
                ? [Palette.forest600, Palette.forest800]
                : [Palette.forest500, Palette.forest700]
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
                backgroundColor: isDark ? Palette.forest500 : Brand.accent,
                opacity: isDark ? 0.45 : 0.85,
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
        <IdentityBlock
          profile={profile}
          isDark={isDark}
          colors={colors}
          avatarSize={avatarSize}
        />

        {isFriends && profile.connection ? (
          <FullProfile
            profile={profile}
            connection={profile.connection}
            firstName={firstName}
            colors={colors}
            isDark={isDark}
            isRemoving={isRemoving}
            onRemoveFriend={handleRemoveFriend}
            onOpenShift={(shiftId) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/shift/${shiftId}` as Href);
            }}
          />
        ) : (
          <TrimmedProfile
            profile={profile}
            firstName={firstName}
            colors={colors}
            isDark={isDark}
            isSendingRequest={isSendingRequest}
            respondingTo={respondingTo}
            onAddFriend={handleAddFriend}
            onAcceptRequest={handleAcceptRequest}
            onDeclineRequest={handleDeclineRequest}
          />
        )}

        {/* ── Safety actions (always visible) ────────────── */}
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
                  color: profile.hasReported ? "#dc2626" : colors.textSecondary,
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
          {isFriends
            ? "Treat our whānau with manaakitanga."
            : "Kia tūpato — treat our whānau with manaakitanga. Reports are reviewed within 24 hours."}
        </Text>
      </ScrollView>
    </View>
  );
}

/* ─── Identity ──────────────────────────────────────────────── */

function IdentityBlock({
  profile,
  isDark,
  colors,
  avatarSize,
}: {
  profile: UserProfile;
  isDark: boolean;
  colors: (typeof Colors)["light"];
  avatarSize: number;
}) {
  const isFriends =
    profile.friendshipStatus === "FRIENDS" && profile.connection;
  const connection = profile.connection;

  const daysSinceFriends = connection
    ? differenceInDays(new Date(), new Date(connection.friendsSince))
    : 0;
  const isNewFriend = isFriends && daysSinceFriends <= 30;
  const isCloseBuddy = isFriends && (connection?.shiftsTogether ?? 0) > 10;
  const connectedSince = connection
    ? formatNZT(new Date(connection.friendsSince), "MMMM yyyy")
    : null;

  return (
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
                backgroundColor: isDark ? Palette.forest600 : Brand.greenLight,
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

      <View style={styles.identityEyebrow}>
        <Eyebrow color={colors.textSecondary}>
          {isFriends ? "Your whānau" : "Volunteer"}
        </Eyebrow>
      </View>

      <Text style={[styles.heroName, { color: colors.text }]}>
        {profile.name}
      </Text>

      {isFriends && connectedSince ? (
        <Text style={[styles.connectedSince, { color: colors.textSecondary }]}>
          Connected since {connectedSince}
          <Text
            style={{ color: isDark ? Brand.accentSubtle : Brand.greenHover }}
          >
            {" "}
            · {daysSinceFriends} days
          </Text>
        </Text>
      ) : (
        <Text style={[styles.heroTagline, { color: colors.textSecondary }]}>
          Everybody Eats volunteer
        </Text>
      )}

      {isFriends && (isNewFriend || isCloseBuddy) ? (
        <View style={styles.badgeRow}>
          {isNewFriend && (
            <Badge
              label="New friend"
              emoji="✨"
              tone="accent"
              isDark={isDark}
            />
          )}
          {isCloseBuddy && (
            <Badge
              label="Close buddy"
              emoji="🤝"
              tone="green"
              isDark={isDark}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

/* ─── Trimmed (not-friends) view ─────────────────────────────── */

function TrimmedProfile({
  profile,
  firstName,
  colors,
  isDark,
  isSendingRequest,
  respondingTo,
  onAddFriend,
  onAcceptRequest,
  onDeclineRequest,
}: {
  profile: UserProfile;
  firstName: string;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  isSendingRequest: boolean;
  respondingTo: "accept" | "decline" | null;
  onAddFriend: () => void;
  onAcceptRequest: () => void;
  onDeclineRequest: () => void;
}) {
  return (
    <>
      {/* ── Stats bento ──────────────────────────────── */}
      <View style={styles.bento}>
        <View
          style={[
            styles.bentoCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.bentoLabel, { color: colors.textSecondary }]}>
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
          <Text style={[styles.bentoLabel, { color: colors.textSecondary }]}>
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
          respondingTo={respondingTo}
          onAddFriend={onAddFriend}
          onAcceptRequest={onAcceptRequest}
          onDeclineRequest={onDeclineRequest}
          colors={colors}
          isDark={isDark}
        />
      </View>
    </>
  );
}

/* ─── Full (friends) view ───────────────────────────────────── */

function FullProfile({
  profile,
  connection,
  firstName,
  colors,
  isDark,
  isRemoving,
  onRemoveFriend,
  onOpenShift,
}: {
  profile: UserProfile;
  connection: UserConnection;
  firstName: string;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  isRemoving: boolean;
  onRemoveFriend: () => void;
  onOpenShift: (shiftId: string) => void;
}) {
  return (
    <>
      {/* ── Connection bento (asymmetric) ────────────── */}
      <View style={styles.bentoFull}>
        <View
          style={[
            styles.bentoHero,
            { backgroundColor: Palette.forest700 },
          ]}
        >
          {/* Warm sun glow on the dark forest stat panel */}
          <View pointerEvents="none" style={styles.bentoGlow} />
          <Text
            style={[styles.bentoLabel, { color: "rgba(253,248,239,0.7)" }]}
          >
            SHARED SHIFTS
          </Text>
          <Text
            style={[styles.bentoHeroValue, { color: Palette.sun200 }]}
          >
            {connection.shiftsTogether}
          </Text>
          <Text
            style={[
              styles.bentoHeroCaption,
              { color: "rgba(253,248,239,0.7)" },
            ]}
          >
            mahi done together
          </Text>
          <View
            style={[
              styles.bentoArc,
              {
                borderColor: Palette.cream50,
                opacity: 0.12,
              },
            ]}
          />
        </View>

        <View style={styles.bentoColumn}>
          <View
            style={[
              styles.bentoMini,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.bentoLabel, { color: colors.textSecondary }]}>
              THEIR HOURS
            </Text>
            <Text style={[styles.bentoMiniValue, { color: colors.text }]}>
              {profile.hoursVolunteered}
            </Text>
          </View>
          <View
            style={[
              styles.bentoMini,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.bentoLabel, { color: colors.textSecondary }]}>
              MUTUAL FRIENDS
            </Text>
            <Text style={[styles.bentoMiniValue, { color: colors.text }]}>
              {connection.mutualFriends}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Achievements ───────────────────────────────── */}
      <SectionHeading title="Achievements" colors={colors} />
      <View style={styles.section}>
        <TrophyShelf
          achievements={connection.achievements}
          firstName={firstName}
          colors={colors}
          isDark={isDark}
        />
      </View>

      {/* ── Their Mahi ─────────────────────────────────── */}
      <SectionHeading title="Their mahi" colors={colors} />
      <View style={styles.section}>
        <View
          style={[
            styles.rhythmCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <RhythmStat
            value={connection.shiftsThisMonth.toString()}
            label="This month"
            colors={colors}
          />
          <View
            style={[styles.rhythmDivider, { backgroundColor: colors.border }]}
          />
          <RhythmStat
            value={connection.avgPerMonth.toString()}
            label="Avg / month"
            colors={colors}
          />
          <View
            style={[styles.rhythmDivider, { backgroundColor: colors.border }]}
          />
          <RhythmStat
            value={profile.totalShifts.toString()}
            label="All-time"
            colors={colors}
          />
        </View>

        <View
          style={[
            styles.featureCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.featureRule,
              { backgroundColor: isDark ? Brand.accent : Brand.green },
            ]}
          />
          <View style={styles.featureBody}>
            <Text
              style={[styles.featureEyebrow, { color: colors.textSecondary }]}
            >
              FAVOURITE ROLE
            </Text>
            <View style={styles.featureRow}>
              <Text style={styles.featureEmoji}>
                {getShiftThemeByName(connection.favoriteRole).emoji}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>
                  {connection.favoriteRole}
                </Text>
                <Text
                  style={[
                    styles.featureMeta,
                    { color: colors.textSecondary },
                  ]}
                >
                  Completed {connection.favoriteRoleCount}{" "}
                  {connection.favoriteRoleCount === 1 ? "time" : "times"}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* ── Shared shifts ──────────────────────────────── */}
      <SectionHeading title="Shared shifts" colors={colors} />
      <View style={styles.section}>
        {connection.sharedShifts.length > 0 ? (
          <View>
            {connection.sharedShifts.slice(0, 5).map((shift, idx) => {
              const isLast =
                idx === Math.min(connection.sharedShifts.length, 5) - 1;
              const shiftDate = new Date(shift.date);
              return (
                <View key={shift.id} style={styles.timelineRow}>
                  <View style={styles.timelineDateCol}>
                    <Text style={[styles.timelineDay, { color: colors.text }]}>
                      {formatNZT(shiftDate, "d")}
                    </Text>
                    <Text
                      style={[
                        styles.timelineMonth,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {formatNZT(shiftDate, "MMM").toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.timelineRail}>
                    <View
                      style={[
                        styles.timelineNode,
                        {
                          backgroundColor: shift.isUpcoming
                            ? isDark
                              ? Brand.accent
                              : Brand.green
                            : colors.border,
                          borderColor: colors.background,
                        },
                      ]}
                    />
                    {!isLast && (
                      <View
                        style={[
                          styles.timelineLine,
                          { backgroundColor: colors.border },
                        ]}
                      />
                    )}
                  </View>

                  <View style={styles.timelineContent}>
                    <Text
                      style={[styles.timelineTitle, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {shift.type}
                    </Text>
                    <Text
                      style={[
                        styles.timelineMeta,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {shift.location}
                    </Text>
                    {shift.isUpcoming && (
                      <View
                        style={[
                          styles.upcomingTag,
                          {
                            backgroundColor: isDark
                              ? "rgba(248,251,105,0.12)"
                              : Palette.sun100,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.upcomingDot,
                            {
                              backgroundColor: isDark
                                ? Brand.accent
                                : Brand.green,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.upcomingTagText,
                            {
                              color: isDark ? Brand.accent : Brand.greenHover,
                            },
                          ]}
                        >
                          Coming up
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
            {connection.sharedShifts.length > 5 && (
              <Text style={[styles.moreText, { color: colors.textSecondary }]}>
                + {connection.sharedShifts.length - 5} more shifts together
              </Text>
            )}
          </View>
        ) : (
          <EmptyCanvas
            title="No shared shifts yet"
            subtitle={`Sign up for the same shifts to create moments with ${firstName}.`}
            colors={colors}
            isDark={isDark}
          />
        )}
      </View>

      {/* ── Join them on a shift ─────────────────────────── */}
      <SectionHeading title={`Join ${firstName}`} colors={colors} />
      <View style={styles.section}>
        {connection.upcomingShifts.length > 0 ? (
          <>
            <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
              Tap a shift to sign up alongside {firstName}.
            </Text>
            <View style={{ gap: 10 }}>
              {connection.upcomingShifts.map((shift) => {
                const theme = getShiftThemeByName(shift.type);
                const date = new Date(shift.date);
                return (
                  <Pressable
                    key={shift.id}
                    onPress={() => onOpenShift(shift.id)}
                    style={({ pressed }) => [
                      styles.upcomingRow,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        opacity: pressed ? 0.85 : 1,
                        transform: [{ scale: pressed ? 0.99 : 1 }],
                      },
                    ]}
                    accessibilityLabel={`Sign up for ${shift.type} on ${formatNZT(date, "MMMM d")} with ${firstName}`}
                    accessibilityRole="button"
                  >
                    <View
                      style={[
                        styles.upcomingIcon,
                        {
                          backgroundColor: isDark
                            ? theme.bgDark
                            : theme.bgLight,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 22 }}>{theme.emoji}</Text>
                    </View>
                    <View style={styles.upcomingBody}>
                      <Text
                        style={[styles.upcomingType, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {shift.type}
                      </Text>
                      <Text
                        style={[
                          styles.upcomingMeta,
                          { color: colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {shift.location} · {shift.time}
                      </Text>
                    </View>
                    <View style={styles.upcomingTrailing}>
                      <Text
                        style={[styles.upcomingDate, { color: colors.text }]}
                      >
                        {formatNZT(date, "MMM d")}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={colors.textSecondary}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <EmptyCanvas
            title="Quiet for now"
            subtitle={`Check back later — ${firstName}'s schedule will appear here.`}
            colors={colors}
            isDark={isDark}
          />
        )}
      </View>

      {/* ── Remove friend ──────────────────────────────── */}
      <View style={[styles.section, { marginTop: 28 }]}>
        <Pressable
          onPress={onRemoveFriend}
          disabled={isRemoving}
          style={({ pressed }) => [
            styles.removeFriendBtn,
            {
              borderColor: colors.border,
              opacity: pressed || isRemoving ? 0.6 : 1,
            },
          ]}
          accessibilityLabel={`Remove ${firstName} from your friends`}
          accessibilityRole="button"
        >
          <Ionicons
            name="person-remove-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text
            style={[styles.removeFriendText, { color: colors.textSecondary }]}
          >
            {isRemoving ? "Removing…" : `Remove ${firstName} from friends`}
          </Text>
        </Pressable>
      </View>
    </>
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

function RhythmStat({
  value,
  label,
  colors,
}: {
  value: string;
  label: string;
  colors: (typeof Colors)["light"];
}) {
  return (
    <View style={styles.rhythmStat}>
      <Text style={[styles.rhythmValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.rhythmLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

function Badge({
  label,
  emoji,
  tone,
  isDark,
}: {
  label: string;
  emoji: string;
  tone: "accent" | "green";
  isDark: boolean;
}) {
  const bg =
    tone === "accent"
      ? isDark
        ? "rgba(248,251,105,0.14)"
        : Palette.sun100
      : isDark
      ? "rgba(155,189,160,0.16)"
      : Brand.greenLight;
  const fg =
    tone === "accent"
      ? isDark
        ? Brand.accent
        : Palette.ink
      : isDark
      ? Palette.forest200
      : Brand.green;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ fontSize: 12 }}>{emoji}</Text>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/**
 * The friend's achievements rendered as "plates on a shelf" — a featured
 * latest unlock, then the rest as a horizontally scrolling row of plates.
 * Tolerates an undefined payload (older cached profiles) by showing the
 * empty state.
 */
function TrophyShelf({
  achievements,
  firstName,
  colors,
  isDark,
}: {
  achievements: UserConnection["achievements"] | undefined;
  firstName: string;
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  if (!achievements || achievements.unlockedCount === 0) {
    return (
      <EmptyCanvas
        title="The shelf is waiting"
        subtitle={`${firstName} hasn't unlocked any achievements yet — their first shift will start the collection.`}
        colors={colors}
        isDark={isDark}
      />
    );
  }

  const [latest, ...rest] = achievements.items;
  const overflow = achievements.unlockedCount - achievements.items.length;

  return (
    <View style={{ gap: 12 }}>
      <Text style={[styles.shelfSummary, { color: colors.textSecondary }]}>
        {achievements.unlockedCount} of {achievements.totalCount} unlocked ·{" "}
        {achievements.totalPoints} points
      </Text>

      {/* Featured latest unlock */}
      <View
        style={[
          styles.featuredUnlock,
          {
            backgroundColor: colors.card,
            borderColor: isDark ? "rgba(248,251,105,0.25)" : Palette.sun300,
          },
        ]}
      >
        <View
          style={[
            styles.plate,
            styles.plateLarge,
            {
              backgroundColor: isDark
                ? "rgba(248,251,105,0.12)"
                : Palette.sun100,
              borderColor: isDark ? "rgba(248,251,105,0.3)" : Palette.sun300,
            },
          ]}
        >
          <Text style={{ fontSize: 30 }}>{latest.icon}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            style={[styles.featureEyebrow, { color: colors.textSecondary }]}
          >
            LATEST UNLOCK
          </Text>
          <Text
            style={[styles.featuredUnlockName, { color: colors.text }]}
            numberOfLines={1}
          >
            {latest.name}
          </Text>
          <Text
            style={[styles.featuredUnlockMeta, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {latest.description}
          </Text>
          <Text
            style={[
              styles.featuredUnlockDate,
              { color: isDark ? Brand.accentSubtle : Brand.greenHover },
            ]}
          >
            +{latest.points} pts · {formatNZT(new Date(latest.unlockedAt), "MMM yyyy")}
          </Text>
        </View>
      </View>

      {/* The shelf */}
      {rest.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelfScroll}
        >
          {rest.map((achievement) => (
            <View
              key={achievement.id}
              style={[
                styles.shelfItem,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              accessibilityLabel={`${achievement.name}: ${achievement.description}`}
            >
              <View
                style={[
                  styles.plate,
                  {
                    backgroundColor: isDark
                      ? "rgba(248,251,105,0.10)"
                      : Palette.cream100,
                    borderColor: isDark
                      ? "rgba(248,251,105,0.16)"
                      : colors.border,
                  },
                ]}
              >
                <Text style={{ fontSize: 22 }}>{achievement.icon}</Text>
              </View>
              <Text
                style={[styles.shelfItemName, { color: colors.text }]}
                numberOfLines={2}
              >
                {achievement.name}
              </Text>
              <Text
                style={[styles.shelfItemPoints, { color: colors.textSecondary }]}
              >
                {achievement.points} pts
              </Text>
            </View>
          ))}
          {overflow > 0 && (
            <View
              style={[
                styles.shelfItem,
                styles.shelfOverflow,
                { borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.shelfOverflowCount,
                  { color: isDark ? Palette.forest200 : Brand.green },
                ]}
              >
                +{overflow}
              </Text>
              <Text
                style={[styles.shelfItemPoints, { color: colors.textSecondary }]}
              >
                more
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function EmptyCanvas({
  title,
  subtitle,
  colors,
  isDark,
}: {
  title: string;
  subtitle: string;
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  return (
    <View
      style={[
        styles.emptyCanvas,
        {
          borderColor: colors.border,
          backgroundColor: isDark
            ? "rgba(255,255,255,0.015)"
            : "rgba(29,83,55,0.03)",
        },
      ]}
    >
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {subtitle}
      </Text>
    </View>
  );
}

function FriendshipAction({
  status,
  firstName,
  allowFriendRequests,
  isSending,
  respondingTo,
  onAddFriend,
  onAcceptRequest,
  onDeclineRequest,
  colors,
  isDark,
}: {
  status: UserFriendshipStatus;
  firstName: string;
  allowFriendRequests: boolean;
  isSending: boolean;
  respondingTo: "accept" | "decline" | null;
  onAddFriend: () => void;
  onAcceptRequest: () => void;
  onDeclineRequest: () => void;
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
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
    const isAccepting = respondingTo === "accept";
    const isDeclining = respondingTo === "decline";
    const isBusy = respondingTo !== null;

    return (
      <View style={{ gap: 12 }}>
        <StatusCard
          eyebrow="INCOMING"
          title={`Kia ora — ${firstName} wants to connect`}
          ruleColor={isDark ? "#93c5fd" : "#1d4ed8"}
          colors={colors}
          isDark={isDark}
        />
        <Pressable
          onPress={onAcceptRequest}
          disabled={isBusy}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: isDark ? Brand.accent : Brand.green,
              opacity: pressed || isBusy ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
          accessibilityLabel={`Accept friend request from ${firstName}`}
          accessibilityRole="button"
        >
          {isAccepting ? (
            <ActivityIndicator
              size="small"
              color={isDark ? Brand.green : Palette.cream50}
            />
          ) : (
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color={isDark ? Brand.green : Palette.cream50}
            />
          )}
          <Text
            style={[
              styles.primaryBtnText,
              { color: isDark ? Brand.green : Palette.cream50 },
            ]}
          >
            {isAccepting ? "Accepting…" : "Accept request"}
          </Text>
        </Pressable>
        <Pressable
          onPress={onDeclineRequest}
          disabled={isBusy}
          style={({ pressed }) => [
            styles.declineBtn,
            {
              borderColor: colors.border,
              opacity: pressed || isBusy ? 0.7 : 1,
            },
          ]}
          accessibilityLabel={`Decline friend request from ${firstName}`}
          accessibilityRole="button"
        >
          {isDeclining ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Ionicons
              name="close-outline"
              size={16}
              color={colors.textSecondary}
            />
          )}
          <Text
            style={[styles.declineBtnText, { color: colors.textSecondary }]}
          >
            {isDeclining ? "Declining…" : "Decline"}
          </Text>
        </Pressable>
      </View>
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
          color={isDark ? Brand.green : Palette.cream50}
        />
      ) : (
        <Ionicons
          name="person-add-outline"
          size={18}
          color={isDark ? Brand.green : Palette.cream50}
        />
      )}
      <Text
        style={[
          styles.primaryBtnText,
          { color: isDark ? Brand.green : Palette.cream50 },
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
    backgroundColor: Palette.cream50,
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
  identityEyebrow: {
    marginBottom: 10,
    alignSelf: "center",
  },
  heroName: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: FontFamily.display,
    textAlign: "center",
    letterSpacing: -0.8,
  },
  heroTagline: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: FontFamily.regular,
    fontStyle: "italic",
    textAlign: "center",
  },
  connectedSince: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: FontFamily.regular,
    textAlign: "center",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.2,
  },

  /* Bento — trimmed view */
  bento: {
    flexDirection: "row",
    gap: 10,
    marginTop: 26,
    marginHorizontal: HORIZONTAL,
  },
  bentoCard: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  bentoValue: {
    fontSize: 34,
    lineHeight: 36,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },

  /* Bento — full (friends) view */
  bentoFull: {
    flexDirection: "row",
    gap: 10,
    marginTop: 26,
    marginHorizontal: HORIZONTAL,
  },
  bentoHero: {
    flex: 1.35,
    borderRadius: 24,
    padding: 20,
    justifyContent: "space-between",
    overflow: "hidden",
    minHeight: 160,
  },
  bentoGlow: {
    position: "absolute",
    top: -60,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(248,251,105,0.12)",
  },
  bentoArc: {
    position: "absolute",
    right: -60,
    bottom: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
  },
  bentoColumn: {
    flex: 1,
    gap: 10,
  },
  bentoMini: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "space-between",
  },
  bentoLabel: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1.2,
  },
  bentoHeroValue: {
    fontSize: 56,
    lineHeight: 60,
    fontFamily: FontFamily.display,
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
    marginTop: 4,
  },
  bentoHeroCaption: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    fontStyle: "italic",
  },
  bentoMiniValue: {
    fontSize: 28,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
    marginTop: 8,
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

  /* Sections */
  section: {
    paddingHorizontal: HORIZONTAL,
    gap: 12,
  },

  /* Status card */
  statusCard: {
    flexDirection: "row",
    borderRadius: 18,
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
    minHeight: 54,
    borderRadius: 999,
  },
  primaryBtnText: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.2,
  },
  declineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1.25,
  },
  declineBtnText: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.2,
  },

  /* Rhythm card */
  rhythmCard: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
    alignItems: "stretch",
  },
  rhythmStat: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  rhythmValue: {
    fontSize: 24,
    fontFamily: FontFamily.headingBold,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  rhythmLabel: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.3,
  },
  rhythmDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 6,
  },

  /* Feature card */
  featureCard: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  featureRule: {
    width: 4,
  },
  featureBody: {
    flex: 1,
    padding: 16,
    gap: 10,
  },
  featureEyebrow: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1.1,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureEmoji: {
    fontSize: 32,
  },
  featureTitle: {
    fontSize: 17,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.2,
  },
  featureMeta: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    marginTop: 2,
  },

  /* Timeline */
  timelineRow: {
    flexDirection: "row",
    gap: 14,
    paddingBottom: 18,
  },
  timelineDateCol: {
    width: 44,
    alignItems: "flex-end",
    paddingTop: 2,
  },
  timelineDay: {
    fontSize: 26,
    lineHeight: 28,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  timelineMonth: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  timelineRail: {
    width: 14,
    alignItems: "center",
    paddingTop: 8,
  },
  timelineNode: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  timelineLine: {
    width: StyleSheet.hairlineWidth,
    flex: 1,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    gap: 3,
    paddingTop: 4,
  },
  timelineTitle: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
  timelineMeta: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
  upcomingTag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  upcomingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  upcomingTagText: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.4,
  },
  moreText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    textAlign: "center",
    paddingTop: 4,
    fontStyle: "italic",
  },

  /* Upcoming list */
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
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
  upcomingTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  upcomingDate: {
    fontSize: 13,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.2,
  },
  sectionHint: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    marginBottom: 4,
    marginTop: -4,
  },

  /* Trophy shelf */
  shelfSummary: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.2,
    marginTop: -4,
  },
  featuredUnlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  featuredUnlockName: {
    fontSize: 17,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.2,
  },
  featuredUnlockMeta: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    lineHeight: 17,
  },
  featuredUnlockDate: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    marginTop: 2,
  },
  plate: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  plateLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  shelfScroll: {
    gap: 10,
    paddingRight: HORIZONTAL,
  },
  shelfItem: {
    width: 104,
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shelfItemName: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    textAlign: "center",
    lineHeight: 16,
  },
  shelfItemPoints: {
    fontSize: 10,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.3,
  },
  shelfOverflow: {
    justifyContent: "center",
    borderStyle: "dashed",
    borderWidth: 1,
  },
  shelfOverflowCount: {
    fontSize: 22,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.5,
  },

  /* Empty canvas */
  emptyCanvas: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },

  /* Remove friend */
  removeFriendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  removeFriendText: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
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
    minHeight: 44,
    borderRadius: 999,
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
