import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { ThemedText } from "@/components/themed-text";
import { StatusBarScrim } from "@/components/ui/status-bar-scrim";
import { Brand, Colors, FontFamily, Palette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  useUserProfile,
  type UserConnection,
  type UserProfile,
} from "@/hooks/use-user-profile";
import { api } from "@/lib/api";
import { formatNZDateOnly, formatNZT } from "@/lib/dates";
import { goBackOrHome } from "@/lib/navigation";

type ThemeColors = (typeof Colors)["light"];

/** How far the content sheet overlaps the bottom of the cover. */
const SHEET_OVERLAP = 28;
const AVATAR_SIZE = 112;
/** Diameter of the warm glow the avatar sits in. */
const GLOW_SIZE = 300;

/** Rows shown per list before the rest collapse into an "N more" row. */
const MAX_SHARED_SHIFTS = 5;
/** Achievements listed before "Show all". */
const COLLAPSED_ACHIEVEMENTS = 5;

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Volunteer profile, opened from a shift's people list, the friends list or a
 * friend notification.
 *
 * One fetch drives two depths: anyone sees who the volunteer is, their totals
 * and how to connect; friends also see their upcoming shifts, the shifts you
 * have done together and their achievements. Report and block are always at
 * the bottom.
 */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const { profile, isLoading, error, setProfile, refresh } = useUserProfile(id);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [respondingTo, setRespondingTo] = useState<"accept" | "decline" | null>(
    null
  );
  // Once the cover has scrolled away the header controls sit on paper, so
  // they (and the status bar) switch from light-on-forest to page colours.
  const [coverHeight, setCoverHeight] = useState(0);
  const [pastCover, setPastCover] = useState(false);
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const threshold = coverHeight - SHEET_OVERLAP - headerHeight;
      const next = coverHeight > 0 && e.nativeEvent.contentOffset.y > threshold;
      setPastCover((prev) => (prev === next ? prev : next));
    },
    [coverHeight, headerHeight]
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
      // so the screen flips to the friends view without a manual reload. The
      // request itself succeeded at this point, so a refresh failure only
      // delays that view; tell the user they're connected either way.
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
      `${firstName} won't be notified. You can still send them a request later if you change your mind.`,
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
              goBackOrHome();
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
                { text: "OK", onPress: () => goBackOrHome() },
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
      <>
        <Stack.Screen options={{ headerTintColor: colors.text }} />
        <View style={[s.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  if (error || !profile) {
    return (
      <>
        <Stack.Screen options={{ headerTintColor: colors.text }} />
        <View style={[s.centered, { backgroundColor: colors.background }]}>
          <View
            style={[s.notFoundIcon, { backgroundColor: colors.surfaceSoft }]}
          >
            <Ionicons
              name="person-outline"
              size={32}
              color={colors.textSecondary}
            />
          </View>
          <ThemedText type="subtitle" style={{ marginTop: 12 }}>
            Volunteer not found
          </ThemedText>
          <Pressable
            onPress={() => goBackOrHome()}
            style={({ pressed }) => [
              s.backButton,
              { backgroundColor: Brand.green, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={s.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const connection =
    profile.friendshipStatus === "FRIENDS" ? profile.connection : null;

  // On iOS 26 the back button sits in liquid glass, which keeps the system's
  // own label colour over any backdrop; elsewhere it needs light glyphs until
  // the cover has scrolled away.
  const headerTint =
    pastCover || isLiquidGlassAvailable() ? colors.text : Palette.cream50;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerTintColor: headerTint }} />
      <StatusBar style={pastCover ? "auto" : "light"} />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 24) + 24,
        }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ Who they are ═══ */}
        <Cover
          profile={profile}
          connection={connection}
          topInset={headerHeight}
          onHeight={setCoverHeight}
        />

        <View style={[s.sheet, { backgroundColor: colors.background }]}>
          <Facts connection={connection} colors={colors} />

          {/* ═══ Connect ═══ */}
          {!connection && (
            <FriendshipAction
              profile={profile}
              firstName={firstName}
              isSending={isSendingRequest}
              respondingTo={respondingTo}
              onAddFriend={handleAddFriend}
              onAcceptRequest={handleAcceptRequest}
              onDeclineRequest={handleDeclineRequest}
              colors={colors}
              isDark={isDark}
            />
          )}

          {connection && (
            <>
              {connection.upcomingShifts.length > 0 && (
                <UpcomingShifts
                  shifts={connection.upcomingShifts}
                  firstName={firstName}
                  colors={colors}
                  onOpen={(shiftId) => {
                    Haptics.selectionAsync();
                    router.push(`/shift/${shiftId}` as Href);
                  }}
                />
              )}
              <SharedShifts connection={connection} colors={colors} />
              <Achievements
                achievements={connection.achievements}
                profile={profile}
                firstName={firstName}
                colors={colors}
                isDark={isDark}
              />
            </>
          )}

          {/* ═══ Manage ═══ */}
          <View style={[s.group, { backgroundColor: colors.card }]}>
            {connection && (
              <ActionRow
                icon="person-remove-outline"
                label={isRemoving ? "Removing…" : "Remove friend"}
                color={colors.text}
                disabled={isRemoving}
                onPress={handleRemoveFriend}
                accessibilityLabel={`Remove ${firstName} from your friends`}
                colors={colors}
              />
            )}
            <ActionRow
              icon={profile.hasReported ? "flag" : "flag-outline"}
              label={profile.hasReported ? "Reported" : `Report ${firstName}`}
              color={colors.text}
              onPress={handleReport}
              accessibilityLabel="Report this volunteer"
              withRule={Boolean(connection)}
              colors={colors}
            />
            <ActionRow
              icon="ban-outline"
              label={
                profile.isBlocked
                  ? "Blocked"
                  : isBlocking
                  ? "Blocking…"
                  : `Block ${firstName}`
              }
              color={colors.destructive}
              disabled={isBlocking || profile.isBlocked}
              onPress={handleBlock}
              accessibilityLabel="Block this volunteer"
              withRule
              colors={colors}
            />
          </View>
        </View>
      </ScrollView>
      {pastCover && <StatusBarScrim />}
    </View>
  );
}

/* ═════════════════════════════════════════════════════════
   IDENTITY
   ═════════════════════════════════════════════════════════ */

/**
 * Forest cover with the volunteer at its centre: their photo ringed in sun
 * yellow on a plate, their name, and their totals with Everybody Eats.
 */
function Cover({
  profile,
  connection,
  topInset,
  onHeight,
}: {
  profile: UserProfile;
  connection: UserConnection | null;
  topInset: number;
  onHeight: (height: number) => void;
}) {
  const stats: { value: number; one: string; many: string }[] = [
    { value: profile.totalShifts, one: "shift", many: "shifts" },
    { value: profile.hoursVolunteered, one: "hour", many: "hours" },
  ];
  if (connection) {
    stats.push({
      value: connection.shiftsTogether,
      one: "with you",
      many: "with you",
    });
  }

  return (
    <View
      style={[s.cover, { paddingTop: topInset + 4 }]}
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
    >
      {/* Keeps the forest behind the status bar when the page is pulled down */}
      <View pointerEvents="none" style={s.overscroll} />
      <View style={s.glowWrap}>
        {/* A soft sun glow behind the photo, fading out into the forest */}
        <Svg
          width={GLOW_SIZE}
          height={GLOW_SIZE}
          style={s.glow}
          pointerEvents="none"
        >
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={Palette.sun200} stopOpacity={0.34} />
              <Stop offset="0.45" stopColor={Palette.sun200} stopOpacity={0.12} />
              <Stop offset="1" stopColor={Palette.sun200} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle
            cx={GLOW_SIZE / 2}
            cy={GLOW_SIZE / 2}
            r={GLOW_SIZE / 2}
            fill="url(#glow)"
          />
        </Svg>
        <Avatar profile={profile} />
      </View>

      <Text style={s.name} accessibilityRole="header">
        {profile.name}
      </Text>
      {connection ? (
        <Text style={s.coverMeta}>
          Friends since{" "}
          {formatNZT(new Date(connection.friendsSince), "MMMM yyyy")}
        </Text>
      ) : null}

      {profile.totalShifts > 0 ? (
        <View style={s.stats}>
          {stats.map((stat, index) => (
            <View key={stat.one} style={s.statCell}>
              {index > 0 && <View style={s.statRule} />}
              <View
                style={s.stat}
                accessible
                accessibilityLabel={`${stat.value} ${
                  stat.value === 1 ? stat.one : stat.many
                }`}
              >
                <Text style={s.statValue}>{stat.value}</Text>
                <Text style={s.statLabel}>
                  {stat.value === 1 ? stat.one : stat.many}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[s.coverMeta, s.coverMetaGap]}>
          Yet to do their first shift
        </Text>
      )}
    </View>
  );
}

function Avatar({ profile }: { profile: UserProfile }) {
  if (profile.profilePhotoUrl) {
    return (
      <Image
        source={{ uri: profile.profilePhotoUrl }}
        style={s.avatar}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[s.avatar, s.avatarFallback]}>
      <Text style={s.avatarInitial}>
        {profile.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/** What else there is to know about a friend, one line per fact. */
function Facts({
  connection,
  colors,
}: {
  connection: UserConnection | null;
  colors: ThemeColors;
}) {
  if (!connection) return null;
  const facts: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [];
  if (connection.favoriteRoleCount > 0) {
    facts.push({
      icon: "restaurant-outline",
      text: `Mostly ${connection.favoriteRole}`,
    });
  }
  if (connection.avgPerMonth > 0) {
    facts.push({
      icon: "repeat-outline",
      text: `About ${plural(connection.avgPerMonth, "shift")} a month`,
    });
  }
  if (connection.mutualFriends > 0) {
    facts.push({
      icon: "people-outline",
      text: plural(connection.mutualFriends, "mutual friend"),
    });
  }
  if (facts.length === 0) return null;

  return (
    <View style={s.facts}>
      {facts.map((fact) => (
        <FactRow key={fact.icon} icon={fact.icon} colors={colors}>
          {fact.text}
        </FactRow>
      ))}
    </View>
  );
}

function FactRow({
  icon,
  colors,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  colors: ThemeColors;
  children: React.ReactNode;
}) {
  return (
    <View style={s.factRow}>
      <Ionicons name={icon} size={18} color={colors.icon} />
      <Text style={[s.factText, { color: colors.text }]}>{children}</Text>
    </View>
  );
}

/* ═════════════════════════════════════════════════════════
   CONNECT - not friends yet
   ═════════════════════════════════════════════════════════ */

function FriendshipAction({
  profile,
  firstName,
  isSending,
  respondingTo,
  onAddFriend,
  onAcceptRequest,
  onDeclineRequest,
  colors,
  isDark,
}: {
  profile: UserProfile;
  firstName: string;
  isSending: boolean;
  respondingTo: "accept" | "decline" | null;
  onAddFriend: () => void;
  onAcceptRequest: () => void;
  onDeclineRequest: () => void;
  colors: ThemeColors;
  isDark: boolean;
}) {
  const primaryBg = isDark ? Brand.accent : Brand.green;
  const primaryFg = isDark ? Palette.ink : Palette.cream50;

  if (profile.friendshipStatus === "REQUEST_SENT") {
    return (
      <View style={[s.panel, { backgroundColor: colors.card }]}>
        <StatusRow
          icon="paper-plane-outline"
          title="Friend request sent"
          meta={`You'll be friends once ${firstName} accepts.`}
          colors={colors}
        />
      </View>
    );
  }

  if (profile.friendshipStatus === "REQUEST_RECEIVED") {
    const isBusy = respondingTo !== null;
    return (
      <View style={[s.panel, s.requestPanel, { backgroundColor: colors.card }]}>
        <StatusRow
          icon="person-add-outline"
          title={`${firstName} wants to be friends`}
          meta={null}
          colors={colors}
        />
        <View style={s.requestButtons}>
          <Pressable
            onPress={onDeclineRequest}
            disabled={isBusy}
            style={({ pressed }) => [
              s.button,
              s.buttonFlex,
              {
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
                opacity: pressed || isBusy ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Decline friend request from ${firstName}`}
          >
            {respondingTo === "decline" ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text style={[s.buttonText, { color: colors.text }]}>Decline</Text>
            )}
          </Pressable>
          <Pressable
            onPress={onAcceptRequest}
            disabled={isBusy}
            style={({ pressed }) => [
              s.button,
              s.buttonFlex,
              {
                backgroundColor: primaryBg,
                opacity: pressed || isBusy ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Accept friend request from ${firstName}`}
          >
            {respondingTo === "accept" ? (
              <ActivityIndicator size="small" color={primaryFg} />
            ) : (
              <Text style={[s.buttonText, { color: primaryFg }]}>Accept</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  if (!profile.allowFriendRequests) {
    return (
      <View style={[s.panel, { backgroundColor: colors.card }]}>
        <StatusRow
          icon="lock-closed-outline"
          title={`${firstName} isn't taking friend requests`}
          meta={null}
          colors={colors}
        />
      </View>
    );
  }

  return (
    <Pressable
      onPress={onAddFriend}
      disabled={isSending}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: primaryBg,
          opacity: pressed || isSending ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Add ${firstName} as a friend`}
    >
      {isSending ? (
        <ActivityIndicator size="small" color={primaryFg} />
      ) : (
        <Ionicons name="person-add-outline" size={18} color={primaryFg} />
      )}
      <Text style={[s.buttonText, { color: primaryFg }]}>
        {isSending ? "Sending…" : "Add friend"}
      </Text>
    </Pressable>
  );
}

function StatusRow({
  icon,
  title,
  meta,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  meta: string | null;
  colors: ThemeColors;
}) {
  return (
    <View style={s.statusRow}>
      <View style={[s.statusBadge, { backgroundColor: colors.surfaceSoft }]}>
        <Ionicons name={icon} size={18} color={colors.tint} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.statusTitle, { color: colors.text }]}>{title}</Text>
        {meta ? (
          <Text style={[s.statusMeta, { color: colors.textSecondary }]}>
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* ═════════════════════════════════════════════════════════
   FRIENDS - their next shifts, your shifts together, achievements
   ═════════════════════════════════════════════════════════ */

function SectionTitle({
  title,
  meta,
  colors,
}: {
  title: string;
  meta?: string;
  colors: ThemeColors;
}) {
  return (
    <View style={s.sectionHead}>
      <Text
        style={[s.sectionTitle, { color: colors.text }]}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {meta ? (
        <Text style={[s.sectionMeta, { color: colors.textSecondary }]}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

/** Day number over short month, the leading tile of a dated row. */
function DateTile({ date, colors }: { date: string; colors: ThemeColors }) {
  return (
    <View style={[s.dateTile, { backgroundColor: colors.surfaceSoft }]}>
      <Text style={[s.dateTileDay, { color: colors.text }]}>
        {formatNZDateOnly(date, "d")}
      </Text>
      <Text style={[s.dateTileMonth, { color: colors.textSecondary }]}>
        {formatNZDateOnly(date, "MMM")}
      </Text>
    </View>
  );
}

function GroupRule({ colors }: { colors: ThemeColors }) {
  return <View style={[s.groupRule, { backgroundColor: colors.border }]} />;
}

/** Closes a capped list with a count of the rows left out. */
function MoreRow({
  count,
  noun,
  colors,
}: {
  count: number;
  noun: string;
  colors: ThemeColors;
}) {
  return (
    <>
      <GroupRule colors={colors} />
      <View style={s.row}>
        <View style={s.moreSpacer} />
        <Text style={[s.moreText, { color: colors.textSecondary }]}>
          {count} more {count === 1 ? noun : `${noun}s`}
        </Text>
      </View>
    </>
  );
}

function UpcomingShifts({
  shifts,
  firstName,
  colors,
  onOpen,
}: {
  shifts: UserConnection["upcomingShifts"];
  firstName: string;
  colors: ThemeColors;
  onOpen: (shiftId: string) => void;
}) {
  return (
    <View style={s.section}>
      <SectionTitle title={`${firstName}'s next shifts`} colors={colors} />
      <View style={[s.group, { backgroundColor: colors.card }]}>
        {shifts.map((shift, index) => {
          const weekday = formatNZDateOnly(shift.date, "EEEE");
          // "12:00 PM" -> "12pm", "5:30 PM" -> "5:30pm", as on the shift screen.
          const time = shift.time
            .replace(":00", "")
            .replace(" ", "")
            .toLowerCase();
          return (
            <View key={shift.id}>
              {index > 0 && <GroupRule colors={colors} />}
              <Pressable
                onPress={() => onOpen(shift.id)}
                style={({ pressed }) => [s.row, { opacity: pressed ? 0.7 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={`${shift.type}, ${weekday} ${formatNZDateOnly(
                  shift.date,
                  "d MMMM"
                )} at ${time}, ${shift.location}. View shift`}
              >
                <DateTile date={shift.date} colors={colors} />
                <View style={s.rowBody}>
                  <Text
                    style={[s.rowTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {shift.type}
                  </Text>
                  <Text
                    style={[s.rowMeta, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {weekday} {time}, {shift.location}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.tabIconDefault}
                />
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SharedShifts({
  connection,
  colors,
}: {
  connection: UserConnection;
  colors: ThemeColors;
}) {
  const shown = connection.sharedShifts.slice(0, MAX_SHARED_SHIFTS);
  const more = connection.shiftsTogether - shown.length;
  const thisYear = formatNZT(new Date(), "yyyy");

  return (
    <View style={s.section}>
      <SectionTitle title="Shifts together" colors={colors} />
      {shown.length === 0 ? (
        <Text style={[s.emptyText, { color: colors.textSecondary }]}>
          You haven&apos;t been on a shift together yet.
        </Text>
      ) : (
        <View style={[s.group, { backgroundColor: colors.card }]}>
          {shown.map((shift, index) => (
            <View key={shift.id}>
              {index > 0 && <GroupRule colors={colors} />}
              <View style={s.row}>
                <DateTile date={shift.date} colors={colors} />
                <View style={s.rowBody}>
                  <Text
                    style={[s.rowTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {formatNZDateOnly(
                      shift.date,
                      shift.date.startsWith(thisYear)
                        ? "EEEE d MMMM"
                        : "EEEE d MMMM yyyy"
                    )}
                  </Text>
                  <Text
                    style={[s.rowMeta, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {shift.type} shift, {shift.location}
                  </Text>
                </View>
              </View>
            </View>
          ))}
          {more > 0 && <MoreRow count={more} noun="shift" colors={colors} />}
        </View>
      )}
    </View>
  );
}

/**
 * Their achievements in one list: what they've unlocked (newest first), then
 * what they're working towards with how far along they are (closest first).
 * The first few rows show, and the rest expand in place. Tolerates an undefined payload
 * (older cached profiles) by showing the empty line.
 */
function Achievements({
  achievements,
  profile,
  firstName,
  colors,
  isDark,
}: {
  achievements: UserConnection["achievements"] | undefined;
  profile: UserProfile;
  firstName: string;
  colors: ThemeColors;
  isDark: boolean;
}) {
  const unlocked = achievements?.items ?? [];
  // One list: unlocked first, then the rest with how far along they are.
  const rows = [
    ...unlocked.map((a) => ({ ...a, kind: "unlocked" as const })),
    ...(achievements?.inProgress ?? []).map((a) => ({
      ...a,
      kind: "locked" as const,
    })),
  ];
  // Older servers capped `items` at 12, so the count can run past the list.
  const unlisted = (achievements?.unlockedCount ?? 0) - unlocked.length;
  const trackColor = isDark
    ? "rgba(253,248,239,0.12)"
    : "rgba(29,83,55,0.12)";

  return (
    <View style={s.section}>
      <SectionTitle
        title="Achievements"
        meta={
          achievements && unlocked.length > 0
            ? `${achievements.unlockedCount} of ${achievements.totalCount}`
            : undefined
        }
        colors={colors}
      />
      {unlocked.length === 0 && (
        <Text style={[s.emptyText, { color: colors.textSecondary }]}>
          {profile.totalShifts === 0
            ? `${firstName}'s first shift will unlock their first achievement.`
            : `${firstName} hasn't unlocked any yet.`}
        </Text>
      )}
      {rows.length > 0 && (
        <ExpandableGroup
          items={rows}
          collapsedCount={COLLAPSED_ACHIEVEMENTS}
          extraCount={unlisted}
          colors={colors}
          renderItem={(row) =>
            row.kind === "unlocked" ? (
              <View
                style={s.row}
                accessible
                accessibilityLabel={`${row.name}. ${row.description}`}
              >
                <View
                  style={[
                    s.achievementIcon,
                    {
                      backgroundColor: isDark
                        ? colors.accentGlow
                        : Palette.sun100,
                    },
                  ]}
                >
                  <Text style={s.achievementEmoji}>{row.icon}</Text>
                </View>
                <View style={s.rowBody}>
                  <Text
                    style={[s.rowTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {row.name}
                  </Text>
                  <Text
                    style={[s.rowMeta, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {row.description}
                  </Text>
                </View>
              </View>
            ) : (
              <View
                style={s.row}
                accessible
                accessibilityLabel={`${row.name}, not unlocked yet. ${row.description}. ${row.current} of ${row.targetLabel}`}
              >
                <View
                  style={[
                    s.achievementIcon,
                    { backgroundColor: colors.surfaceSoft },
                  ]}
                >
                  <Text style={[s.achievementEmoji, s.lockedEmoji]}>
                    {row.icon}
                  </Text>
                </View>
                <View style={s.rowBody}>
                  <Text
                    style={[s.rowTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {row.name}
                  </Text>
                  <Text style={[s.rowMeta, { color: colors.textSecondary }]}>
                    {row.current} of {row.targetLabel}
                  </Text>
                  <View
                    style={[s.progressTrack, { backgroundColor: trackColor }]}
                  >
                    <View
                      style={[
                        s.progressFill,
                        {
                          backgroundColor: colors.tint,
                          width: `${Math.round(
                            (row.current / row.target) * 100
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

/**
 * A grouped list showing its first `collapsedCount` rows, with a row at the
 * bottom that expands it to all of them and back.
 */
function ExpandableGroup<T extends { id: string }>({
  items,
  collapsedCount,
  extraCount = 0,
  renderItem,
  colors,
}: {
  items: T[];
  collapsedCount: number;
  /** Rows that exist but weren't sent, counted after the expanded list. */
  extraCount?: number;
  renderItem: (item: T) => React.ReactNode;
  colors: ThemeColors;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, collapsedCount);

  return (
    <View style={[s.group, { backgroundColor: colors.card }]}>
      {shown.map((item, index) => (
        <View key={item.id}>
          {index > 0 && <GroupRule colors={colors} />}
          {renderItem(item)}
        </View>
      ))}
      {items.length > collapsedCount && (
        <>
          <GroupRule colors={colors} />
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setExpanded((prev) => !prev);
            }}
            style={({ pressed }) => [
              s.row,
              s.toggleRow,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            accessibilityRole="button"
          >
            <View style={s.moreSpacer} />
            <View style={s.toggleLabel}>
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.tint}
              />
              <Text style={[s.toggleText, { color: colors.tint }]}>
                {expanded ? "Show fewer" : `Show all ${items.length}`}
              </Text>
            </View>
          </Pressable>
        </>
      )}
      {expanded && extraCount > 0 && (
        <MoreRow count={extraCount} noun="achievement" colors={colors} />
      )}
    </View>
  );
}

/* ═════════════════════════════════════════════════════════
   MANAGE - remove, report, block
   ═════════════════════════════════════════════════════════ */

function ActionRow({
  icon,
  label,
  color,
  disabled = false,
  onPress,
  accessibilityLabel,
  withRule = false,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  withRule?: boolean;
  colors: ThemeColors;
}) {
  return (
    <>
      {withRule && (
        <View style={[s.actionRule, { backgroundColor: colors.border }]} />
      )}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          s.actionRow,
          { opacity: pressed ? 0.6 : disabled ? 0.5 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
      >
        <Ionicons name={icon} size={19} color={color} />
        <Text style={[s.actionText, { color }]}>{label}</Text>
      </Pressable>
    </>
  );
}

/* ═════════════════════════════════════════════════════════
   STYLES
   ═════════════════════════════════════════════════════════ */

const s = StyleSheet.create({
  sheet: {
    marginTop: -SHEET_OVERLAP,
    borderTopLeftRadius: SHEET_OVERLAP,
    borderTopRightRadius: SHEET_OVERLAP,
    paddingTop: 28,
    paddingHorizontal: 20,
    gap: 28,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 20,
  },
  notFoundIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  backButtonText: {
    color: Palette.cream50,
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },

  /* ── Cover ── */
  cover: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: SHEET_OVERLAP + 28,
    backgroundColor: Palette.forest700,
  },
  overscroll: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "100%",
    height: 1000,
    backgroundColor: Palette.forest700,
  },
  glowWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    top: (AVATAR_SIZE - GLOW_SIZE) / 2,
    left: (AVATAR_SIZE - GLOW_SIZE) / 2,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.forest600,
  },
  avatarInitial: {
    fontSize: 44,
    fontFamily: FontFamily.headingBold,
    color: Palette.sun200,
  },
  name: {
    marginTop: 24,
    fontSize: 36,
    lineHeight: 42,
    fontFamily: FontFamily.display,
    letterSpacing: -0.8,
    textAlign: "center",
    color: Palette.cream50,
  },
  coverMeta: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: FontFamily.medium,
    textAlign: "center",
    color: "rgba(253, 248, 239, 0.7)",
  },
  coverMetaGap: { marginTop: 16 },
  stats: {
    flexDirection: "row",
    marginTop: 24,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  statCell: {
    flex: 1,
    maxWidth: 120,
    flexDirection: "row",
  },
  statRule: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 6,
    backgroundColor: "rgba(253, 248, 239, 0.25)",
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 30,
    lineHeight: 34,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
    color: Palette.sun200,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    color: "rgba(253, 248, 239, 0.7)",
  },
  facts: { gap: 10 },
  factRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  factText: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: FontFamily.medium,
  },

  /* ── Connect ── */
  panel: {
    borderRadius: 20,
    padding: 16,
  },
  requestPanel: { gap: 16 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  statusBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.2,
  },
  statusMeta: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily.regular,
  },
  requestButtons: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  buttonFlex: { flex: 1 },
  buttonText: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    letterSpacing: -0.1,
  },

  /* ── Sections ── */
  section: { gap: 12 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    flexShrink: 1,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.3,
  },
  sectionMeta: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FontFamily.regular,
  },

  /* ── Grouped rows ── */
  group: {
    borderRadius: 18,
    overflow: "hidden",
  },
  groupRule: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 72,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
  },
  rowMeta: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: FontFamily.regular,
  },
  dateTile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dateTileDay: {
    fontSize: 17,
    lineHeight: 19,
    fontFamily: FontFamily.headingBold,
    fontVariant: ["tabular-nums"],
  },
  dateTileMonth: {
    fontSize: 11,
    lineHeight: 13,
    fontFamily: FontFamily.semiBold,
  },
  achievementIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  achievementEmoji: { fontSize: 22 },
  lockedEmoji: { opacity: 0.45 },
  progressTrack: {
    height: 6,
    marginTop: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  moreSpacer: { width: 44 },
  toggleRow: { minHeight: 52 },
  toggleLabel: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toggleText: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
  moreText: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFamily.medium,
  },

  /* ── Manage ── */
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  actionRule: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 49,
  },
  actionText: {
    fontSize: 16,
    fontFamily: FontFamily.medium,
  },
});
