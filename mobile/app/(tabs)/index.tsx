import { Ionicons } from "@expo/vector-icons";
import { differenceInHours, differenceInMinutes, endOfWeek, formatDistanceToNow, startOfWeek } from "date-fns";
import { formatNZT } from "@/lib/dates";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter, type Href } from "expo-router";
import { useCallback, useRef, useState } from "react";
import Markdown from "react-native-markdown-display";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { ImageViewer } from "@/components/image-viewer";
import { useFeed } from "@/hooks/use-feed";
import { useFeedInteractions } from "@/hooks/use-feed-interactions";
import { useProfile } from "@/hooks/use-profile";
import { useShifts, type PeriodFriend } from "@/hooks/use-shifts";
import {
  type FeedComment,
  type FeedItem,
  type LikeUser,
} from "@/lib/dummy-data";

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const {
    myShifts,
    available,
    periodFriends,
    isLoading: shiftsLoading,
    refresh: refreshShifts,
  } = useShifts();
  const {
    items: feedItems,
    isLoading: feedLoading,
    refresh: refreshFeed,
    updateItem: updateFeedItem,
  } = useFeed();

  const {
    toggleLike: apiToggleLike,
    loadComments,
    addComment: apiAddComment,
    getCommentState,
    reportItem,
    hasReported,
  } = useFeedInteractions();

  const nextShift = myShifts[0] ?? null;
  const nextShiftFriends: PeriodFriend[] = nextShift
    ? periodFriends[getShiftPeriodKey(new Date(nextShift.start))] ?? []
    : [];

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekAvailable = available.filter((s) => {
    const start = new Date(s.start);
    return start >= weekStart && start <= weekEnd;
  });

  const [likesSheetItem, setLikesSheetItem] = useState<FeedItem | null>(null);
  const [viewerImages, setViewerImages] = useState<string[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  const openImageViewer = useCallback((images: string[], index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewerImages(images);
    setViewerIndex(index);
  }, []);

  const closeImageViewer = useCallback(() => {
    setViewerImages(null);
  }, []);

  const toggleLike = useCallback(
    async (item: FeedItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Optimistic update
      const wasLiked = item.likedByMe;
      updateFeedItem(item.id, {
        likedByMe: !wasLiked,
        likeCount: item.likeCount + (wasLiked ? -1 : 1),
      });
      // API call — revert on failure
      const result = await apiToggleLike(item.id);
      if (result) {
        updateFeedItem(item.id, {
          likedByMe: result.liked,
          likeCount: result.likeCount,
        });
      } else {
        // Revert
        updateFeedItem(item.id, {
          likedByMe: wasLiked,
          likeCount: item.likeCount,
        });
      }
    },
    [apiToggleLike, updateFeedItem]
  );

  const ME_AS_LIKER: LikeUser = {
    id: profile?.id ?? "",
    name: "You",
    profilePhotoUrl: profile?.image ?? undefined,
  };

  const getLikersForItem = useCallback(
    (item: FeedItem): LikeUser[] => {
      const likers = [...item.recentLikers];
      if (item.likedByMe) likers.unshift(ME_AS_LIKER);
      return likers;
    },
    [ME_AS_LIKER]
  );

  const getCommentsForItem = useCallback(
    (itemId: string): FeedComment[] => {
      return getCommentState(itemId).comments;
    },
    [getCommentState]
  );

  const handleOpenSheet = useCallback(
    (item: FeedItem) => {
      setLikesSheetItem(item);
      loadComments(item.id);
    },
    [loadComments]
  );

  const addComment = useCallback(
    async (itemId: string, text: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const result = await apiAddComment(
        itemId,
        text,
        profile?.id ?? "",
        profile?.firstName ?? "You",
        profile?.image ?? undefined
      );
      if (result) {
        // Update comment count in the feed item
        const item = feedItems.find((i) => i.id === itemId);
        if (item) {
          updateFeedItem(itemId, { commentCount: item.commentCount + 1 });
        }
      }
    },
    [apiAddComment, profile, feedItems, updateFeedItem]
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, Platform.OS === 'android' && { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={shiftsLoading || feedLoading}
          onRefresh={() => {
            refreshShifts();
            refreshFeed();
          }}
          tintColor={colors.primary}
        />
      }
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text
            style={[
              styles.greeting,
              { color: colors.textSecondary, fontFamily: FontFamily.regular },
            ]}
          >
            Kia ora 👋
          </Text>
          <ThemedText type="title">{profile?.firstName ?? ""}</ThemedText>
        </View>
        <Pressable
          onPress={() => router.push("/(tabs)/profile")}
          style={({ pressed }) => [
            styles.avatarButton,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityLabel="View profile"
        >
          {profile?.image ? (
            <Image source={{ uri: profile.image }} style={styles.avatarImage} />
          ) : (
            <View
              style={[styles.avatarFallback, { backgroundColor: Brand.green }]}
            >
              <Text style={styles.avatarText}>
                {(profile?.firstName ?? "").charAt(0)}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ── Next Shift Hero ── */}
      {nextShift && (
        <NextShiftHero
          shift={nextShift}
          friends={nextShiftFriends}
          onPress={() => router.push(`/shift/${nextShift.id}` as Href)}
        />
      )}

      {/* ── Open Shifts CTA ── */}
      {thisWeekAvailable.length > 0 && (
        <Pressable
          onPress={() => router.push("/(tabs)/shifts?tab=browse")}
          style={({ pressed }) => [
            styles.openShiftsBanner,
            {
              backgroundColor: Brand.accent,
              opacity: pressed ? 0.9 : 1,
              marginTop: nextShift ? 20 : 0,
            },
          ]}
          accessibilityLabel="Browse available shifts"
        >
          <View style={styles.openShiftsContent}>
            <Text style={styles.openShiftsEmoji}>✋</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.openShiftsTitle, { color: Brand.nearBlack }]}
              >
                Volunteers needed!
              </Text>
              <Text style={[styles.openShiftsBody, { color: Brand.nearBlack }]}>
                {thisWeekAvailable.length} open{" "}
                {thisWeekAvailable.length === 1 ? "shift" : "shifts"} this week
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={Brand.nearBlack} />
          </View>
        </Pressable>
      )}

      {/* ── Activity Feed ── */}
      <View style={styles.feedSection}>
        <ThemedText type="heading" style={styles.feedHeading}>
          What&apos;s happening 🌿
        </ThemedText>

        <View style={styles.feedList}>
          {feedItems.map((item, index) => (
            <FeedCard
              key={item.id}
              item={item}
              colors={colors}
              isLast={index === feedItems.length - 1}
              liked={item.likedByMe}
              onToggleLike={() => toggleLike(item)}
              onShowSheet={() => handleOpenSheet(item)}
              onOpenImages={openImageViewer}
              commentCount={item.commentCount}
              isReported={hasReported(item.id)}
              onReport={() => {
                if (hasReported(item.id)) {
                  Alert.alert("Already reported", "You've already reported this content. Our team will review it within 24 hours.");
                  return;
                }
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert(
                  "Report Content",
                  "Why are you reporting this?",
                  [
                    {
                      text: "Offensive or abusive content",
                      onPress: () => reportItem("post", item.id, "Offensive or abusive content"),
                    },
                    {
                      text: "Spam",
                      onPress: () => reportItem("post", item.id, "Spam"),
                    },
                    {
                      text: "Harassment",
                      onPress: () => reportItem("post", item.id, "Harassment"),
                    },
                    { text: "Cancel", style: "cancel" },
                  ]
                );
              }}
            />
          ))}
        </View>
      </View>

      {/* ── Likes Sheet ── */}
      {likesSheetItem && (
        <FeedItemSheet
          item={likesSheetItem}
          likers={getLikersForItem(likesSheetItem)}
          liked={likesSheetItem.likedByMe}
          onToggleLike={() => toggleLike(likesSheetItem)}
          onClose={() => setLikesSheetItem(null)}
          colors={colors}
          isDark={colorScheme === "dark"}
          comments={getCommentsForItem(likesSheetItem.id)}
          isLoadingComments={getCommentState(likesSheetItem.id).isLoading}
          onAddComment={(text) => addComment(likesSheetItem.id, text)}
          onOpenImages={openImageViewer}
        />
      )}

      <ImageViewer
        visible={viewerImages !== null}
        images={viewerImages ?? []}
        initialIndex={viewerIndex}
        onClose={closeImageViewer}
      />

      {/* ── Footer / aroha ── */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          Nāu te rourou, nāku te rourou, ka ora ai te iwi 🌱
        </Text>
        <Text style={[styles.footerSubtext, { color: colors.textSecondary }]}>
          With your basket and my basket, the people will thrive
        </Text>
      </View>
    </ScrollView>
  );
}

/* ── Next Shift Hero ── */

type ShiftStatusKey = "CONFIRMED" | "PENDING" | "WAITLISTED";

const HERO_PALETTE: Record<
  ShiftStatusKey,
  {
    gradient: readonly [string, string, string];
    glow: string;
    ring: string;
    pillBg: string;
    pillText: string;
    accent: string;
    heroText: string;
    bodyText: string;
    mutedText: string;
    chevron: string;
    eyebrow: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  CONFIRMED: {
    gradient: ["#0b2c1b", "#165135", "#0a2416"],
    glow: "rgba(248, 251, 105, 0.22)",
    ring: "rgba(255, 255, 255, 0.07)",
    pillBg: Brand.accent,
    pillText: Brand.nearBlack,
    accent: Brand.accent,
    heroText: "#f8fcef",
    bodyText: "rgba(248, 252, 239, 0.92)",
    mutedText: "rgba(248, 252, 239, 0.62)",
    chevron: "rgba(255, 255, 255, 0.45)",
    eyebrow: "Your next shift",
    label: "Confirmed",
    icon: "checkmark-circle",
  },
  PENDING: {
    gradient: ["#3a2808", "#6b4912", "#2a1d05"],
    glow: "rgba(251, 191, 36, 0.24)",
    ring: "rgba(255, 255, 255, 0.06)",
    pillBg: "#fbbf24",
    pillText: "#3a2808",
    accent: "#fbbf24",
    heroText: "#fdf6e3",
    bodyText: "rgba(253, 246, 227, 0.92)",
    mutedText: "rgba(253, 246, 227, 0.60)",
    chevron: "rgba(255, 255, 255, 0.45)",
    eyebrow: "Awaiting approval",
    label: "Pending",
    icon: "time",
  },
  WAITLISTED: {
    gradient: ["#1a2332", "#334155", "#0f172a"],
    glow: "rgba(148, 163, 184, 0.22)",
    ring: "rgba(255, 255, 255, 0.06)",
    pillBg: "#e2e8f0",
    pillText: "#0f172a",
    accent: "#cbd5e1",
    heroText: "#f1f5f9",
    bodyText: "rgba(241, 245, 249, 0.92)",
    mutedText: "rgba(241, 245, 249, 0.58)",
    chevron: "rgba(255, 255, 255, 0.45)",
    eyebrow: "You're on the waitlist",
    label: "Waitlisted",
    icon: "list",
  },
};

function resolveStatusKey(status?: string | null): ShiftStatusKey {
  if (status === "PENDING" || status === "REGULAR_PENDING") return "PENDING";
  if (status === "WAITLISTED") return "WAITLISTED";
  return "CONFIRMED";
}

/** Day/evening cutoff matches the server (DAY_EVENING_CUTOFF_HOUR = 16 NZT). */
function getShiftPeriodKey(start: Date): string {
  const dateStr = formatNZT(start, "yyyy-MM-dd");
  const hour = parseInt(formatNZT(start, "H"), 10);
  return `${dateStr}-${hour < 16 ? "DAY" : "EVE"}`;
}

function formatCountdown(start: Date, now: Date): string | null {
  const minutes = differenceInMinutes(start, now);
  if (minutes <= 0) return "Starting now";
  if (minutes < 60) return `In ${minutes} min`;
  const hours = differenceInHours(start, now);
  if (hours < 24) return `In ${hours}h ${minutes - hours * 60}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours - days * 24;
  if (days < 7) {
    return remHours > 0
      ? `In ${days} day${days === 1 ? "" : "s"} ${remHours}h`
      : `In ${days} day${days === 1 ? "" : "s"}`;
  }
  return `In ${days} days`;
}

function NextShiftHero({
  shift,
  friends,
  onPress,
}: {
  shift: {
    id: string;
    shiftType: { name: string };
    start: string;
    location: string;
    status?: string | null;
  };
  friends: PeriodFriend[];
  onPress: () => void;
}) {
  const statusKey = resolveStatusKey(shift.status);
  const palette = HERO_PALETTE[statusKey];
  const start = new Date(shift.start);
  const countdown = formatCountdown(start, new Date());
  const isEvening = parseInt(formatNZT(start, "H"), 10) >= 16;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        heroStyles.card,
        { transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Next shift: ${shift.shiftType.name} at ${shift.location}, ${palette.label}`}
    >
      <LinearGradient
        colors={palette.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Warm ambient glow (upper-right) */}
      <View style={[heroStyles.glow, { backgroundColor: palette.glow }]} />
      <View
        style={[
          heroStyles.glowInner,
          { backgroundColor: palette.glow },
        ]}
      />

      {/* Decorative concentric rings */}
      <View
        style={[
          heroStyles.ring,
          heroStyles.ringOuter,
          { borderColor: palette.ring },
        ]}
      />
      <View
        style={[
          heroStyles.ring,
          heroStyles.ringInner,
          { borderColor: palette.ring },
        ]}
      />

      <View style={heroStyles.content}>
        {/* Top row — status pill + chevron */}
        <View style={heroStyles.topRow}>
          <View style={[heroStyles.statusPill, { backgroundColor: palette.pillBg }]}>
            <Ionicons name={palette.icon} size={12} color={palette.pillText} />
            <Text style={[heroStyles.statusPillText, { color: palette.pillText }]}>
              {palette.label}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.chevron} />
        </View>

        {/* Hero time block */}
        <View style={heroStyles.heroBlock}>
          <Text style={[heroStyles.eyebrow, { color: palette.mutedText }]}>
            {palette.eyebrow}
          </Text>
          <Text style={[heroStyles.heroTime, { color: palette.heroText }]}>
            {formatNZT(start, "h:mm a")}
          </Text>
          <View style={[heroStyles.accentBar, { backgroundColor: palette.accent }]} />
          <Text style={[heroStyles.heroDate, { color: palette.bodyText }]}>
            {formatNZT(start, "EEEE · d MMMM")}
          </Text>
        </View>

        {/* Shift type + location */}
        <View style={heroStyles.metaBlock}>
          <Text
            style={[heroStyles.shiftName, { color: palette.heroText }]}
            numberOfLines={1}
          >
            {shift.shiftType.name}
          </Text>
          <View style={heroStyles.metaRow}>
            <Ionicons
              name="location-outline"
              size={13}
              color={palette.bodyText}
            />
            <Text
              style={[heroStyles.metaText, { color: palette.bodyText }]}
              numberOfLines={1}
            >
              {shift.location}
            </Text>
          </View>
        </View>

        {/* Friends on this period */}
        {friends.length > 0 && (
          <View
            style={[
              heroStyles.friendsRow,
              { borderTopColor: "rgba(255,255,255,0.08)" },
            ]}
          >
            <HeroFriendAvatars friends={friends} />
            <View style={heroStyles.friendsTextBlock}>
              <Text
                style={[
                  heroStyles.friendsLabel,
                  { color: palette.mutedText },
                ]}
              >
                {isEvening ? "Evening crew" : "Day crew"}
              </Text>
              <Text
                style={[heroStyles.friendsNames, { color: palette.heroText }]}
                numberOfLines={1}
              >
                {formatFriendNames(friends)}
              </Text>
            </View>
          </View>
        )}

        {/* Countdown strip */}
        {countdown && (
          <View
            style={[
              heroStyles.countdown,
              { borderTopColor: "rgba(255,255,255,0.08)" },
            ]}
          >
            <View style={heroStyles.countdownLeft}>
              <View
                style={[
                  heroStyles.countdownDot,
                  { backgroundColor: palette.accent },
                ]}
              />
              <Text
                style={[
                  heroStyles.countdownLabel,
                  { color: palette.mutedText },
                ]}
              >
                Countdown
              </Text>
            </View>
            <Text
              style={[heroStyles.countdownValue, { color: palette.heroText }]}
            >
              {countdown}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function formatFriendNames(friends: PeriodFriend[]): string {
  const firsts = friends.map((f) => f.name.split(" ")[0]).filter(Boolean);
  if (firsts.length === 0) return "";
  if (firsts.length === 1) return `${firsts[0]} is volunteering too`;
  if (firsts.length === 2) return `${firsts[0]} & ${firsts[1]}`;
  const remaining = firsts.length - 2;
  return `${firsts[0]}, ${firsts[1]} +${remaining} more`;
}

function HeroFriendAvatars({ friends }: { friends: PeriodFriend[] }) {
  const maxShow = 4;
  const shown = friends.slice(0, maxShow);
  const overflow = friends.length - maxShow;

  return (
    <View style={heroStyles.friendsStack}>
      {shown.map((friend, index) => (
        <View
          key={friend.id}
          style={[
            heroStyles.friendAvatarWrap,
            { marginLeft: index === 0 ? 0 : -10, zIndex: maxShow - index },
          ]}
        >
          {friend.profilePhotoUrl ? (
            <Image
              source={{ uri: friend.profilePhotoUrl }}
              style={heroStyles.friendAvatar}
            />
          ) : (
            <View
              style={[heroStyles.friendAvatar, heroStyles.friendAvatarFallback]}
            >
              <Text style={heroStyles.friendInitial}>
                {friend.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      ))}
      {overflow > 0 && (
        <View style={[heroStyles.friendAvatarWrap, { marginLeft: -10, zIndex: 0 }]}>
          <View
            style={[heroStyles.friendAvatar, heroStyles.friendOverflowPill]}
          >
            <Text style={heroStyles.friendOverflowText}>+{overflow}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const heroStyles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#0b2c1b",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 8,
  },
  content: {
    padding: 22,
  },
  glow: {
    position: "absolute",
    top: -120,
    right: -110,
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.9,
  },
  glowInner: {
    position: "absolute",
    top: -60,
    right: -50,
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.8,
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 999,
  },
  ringOuter: {
    width: 360,
    height: 360,
    top: -160,
    right: -130,
  },
  ringInner: {
    width: 240,
    height: 240,
    top: -90,
    right: -70,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.4,
  },
  heroBlock: {
    marginTop: 22,
    alignItems: "flex-start",
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  heroTime: {
    marginTop: 6,
    fontSize: 46,
    lineHeight: 52,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.5,
  },
  accentBar: {
    marginTop: 8,
    width: 40,
    height: 2,
    borderRadius: 1,
  },
  heroDate: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.2,
  },
  metaBlock: {
    marginTop: 20,
    gap: 6,
  },
  shiftName: {
    fontSize: 19,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
  friendsRow: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  friendsStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendAvatarWrap: {},
  friendAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
  },
  friendAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  friendInitial: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    color: "#ffffff",
  },
  friendOverflowPill: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  friendOverflowText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    color: "#ffffff",
  },
  friendsTextBlock: {
    flex: 1,
    gap: 2,
  },
  friendsLabel: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  friendsNames: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.1,
  },
  countdown: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  countdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countdownDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  countdownLabel: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  countdownValue: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.2,
  },
});

/* ── Feed Card ── */

function LikeButton({
  liked,
  onPress,
  color,
  count,
}: {
  liked: boolean;
  onPress: () => void;
  color: string;
  count: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.likeButton,
        { opacity: pressed ? 0.5 : 1 },
      ]}
      accessibilityLabel={liked ? "Unlike" : "Like"}
      accessibilityRole="button"
    >
      <Ionicons
        name={liked ? "heart" : "heart-outline"}
        size={15}
        color={liked ? "#e11d48" : color}
      />
      {count > 0 && (
        <Text style={[styles.likeCount, { color: liked ? "#e11d48" : color }]}>
          {count}
        </Text>
      )}
    </Pressable>
  );
}

/* ── Friend Avatar with Badge ── */

function FeedAvatar({
  profilePhotoUrl,
  userName,
  emoji,
  badgeBg,
}: {
  profilePhotoUrl?: string;
  userName: string;
  emoji: string;
  badgeBg: string;
}) {
  const initial = userName.charAt(0).toUpperCase();

  return (
    <View style={styles.feedAvatarContainer}>
      {profilePhotoUrl ? (
        <Image
          source={{ uri: profilePhotoUrl }}
          style={styles.feedAvatarImage}
        />
      ) : (
        <View
          style={[
            styles.feedAvatarFallback,
            { backgroundColor: Brand.greenLight },
          ]}
        >
          <Text style={styles.feedAvatarInitial}>{initial}</Text>
        </View>
      )}
      <View style={[styles.feedAvatarBadge, { backgroundColor: badgeBg }]}>
        <Text style={styles.feedAvatarBadgeEmoji}>{emoji}</Text>
      </View>
    </View>
  );
}

const RECAP_TEMPLATES = [
  (meals: number, volunteers: number, hours: number) =>
    `${meals} meals served by ${volunteers} volunteers across ${hours} hours of mahi 💚`,
  (meals: number, volunteers: number, hours: number) =>
    `${meals} people fed — ${volunteers} of the whānau showed up for ${hours} hours of aroha 🌿`,
  (meals: number, volunteers: number, hours: number) =>
    `Another beautiful night — ${volunteers} volunteers, ${meals} meals out the door, ${hours} hours of volunteer power ✨`,
  (meals: number, volunteers: number, hours: number) =>
    `${meals} plates, ${volunteers} volunteers, ${hours} hours, one big whānau 🍽️`,
  (meals: number, volunteers: number, hours: number) =>
    `${volunteers} volunteers put in ${hours} hours of mahi — ${meals} full bellies — ngā mihi nui 🙌`,
  (meals: number, volunteers: number, hours: number) =>
    `The whānau showed up! ${volunteers} volunteers served ${meals} meals across ${hours} hours 💪`,
  (meals: number, volunteers: number, hours: number) =>
    `Ka pai! ${volunteers} volunteers, ${meals} kai served — ${hours} hours of community love 🌱`,
  (meals: number, volunteers: number, hours: number) =>
    `${meals} meals, ${volunteers} volunteers, ${hours} hours, endless aroha — that's Everybody Eats 💚`,
];

function getRecapMessage(
  meals: number,
  volunteers: number,
  hours: number,
  id: string
): string {
  // Use id as a stable seed so the same recap always shows the same message
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % RECAP_TEMPLATES.length;
  return RECAP_TEMPLATES[index](meals, volunteers, hours);
}

function FeedCard({
  item,
  colors,
  isLast,
  liked,
  onToggleLike,
  onShowSheet,
  onOpenImages,
  commentCount,
  onReport,
  isReported = false,
}: {
  item: FeedItem;
  colors: (typeof Colors)["light"];
  isLast: boolean;
  liked: boolean;
  onToggleLike: () => void;
  onShowSheet: () => void;
  onOpenImages: (images: string[], index: number) => void;
  commentCount: number;
  onReport: () => void;
  isReported?: boolean;
}) {
  const timeAgo = formatDistanceToNow(new Date(item.timestamp), {
    addSuffix: true,
  });
  const borderStyle = !isLast
    ? {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      }
    : undefined;

  const likeCount = item.likeCount;

  const socialButtons = (
    <View style={styles.feedSocialRow}>
      {commentCount > 0 && (
        <Pressable
          onPress={onShowSheet}
          hitSlop={8}
          style={({ pressed }) => [
            styles.commentButton,
            { opacity: pressed ? 0.5 : 1 },
          ]}
          accessibilityLabel={`${commentCount} comments`}
        >
          <Ionicons
            name="chatbubble-outline"
            size={15}
            color={colors.textSecondary}
          />
          <Text style={[styles.commentCount, { color: colors.textSecondary }]}>
            {commentCount}
          </Text>
        </Pressable>
      )}
      <LikeButton
        liked={liked}
        onPress={onToggleLike}
        color={colors.textSecondary}
        count={likeCount}
      />
    </View>
  );

  const renderContent = () => {
    if (item.type === "announcement") {
      const iconAndBody = (
        <>
          <View style={[styles.feedIcon, { backgroundColor: "#fef9c3" }]}>
            <Text style={styles.feedIconEmoji}>📢</Text>
          </View>
          <View style={styles.feedBody}>
            <Text style={[styles.feedTitle, { color: colors.text }]}>
              {item.title}
            </Text>
            <Text
              style={[styles.feedDescription, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {item.body}
            </Text>
            <View style={styles.feedFooter}>
              <View
                style={[
                  styles.feedMeta,
                  { flexDirection: "column", alignItems: "flex-start", gap: 2 },
                ]}
              >
                <Text
                  style={[styles.feedMetaText, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {item.author}
                </Text>
                <Text
                  style={[styles.feedMetaText, { color: colors.textSecondary }]}
                >
                  {timeAgo}
                </Text>
              </View>
              {socialButtons}
            </View>
          </View>
        </>
      );

      return (
        <>
          {item.imageUrl && (
            <Pressable
              onPress={() => onOpenImages([item.imageUrl!], 0)}
              style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
              accessibilityLabel="View announcement image"
              accessibilityRole="imagebutton"
            >
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.announcementImage}
                resizeMode="cover"
              />
            </Pressable>
          )}
          {item.imageUrl ? (
            <View style={styles.feedCard}>{iconAndBody}</View>
          ) : (
            iconAndBody
          )}
        </>
      );
    }

    if (item.type === "achievement") {
      return (
        <>
          {item.isFriend ? (
            <FeedAvatar
              profilePhotoUrl={item.profilePhotoUrl}
              userName={item.userName}
              emoji="🏆"
              badgeBg="#fef3c7"
            />
          ) : (
            <View style={[styles.feedIcon, { backgroundColor: "#fef3c7" }]}>
              <Text style={styles.feedIconEmoji}>🏆</Text>
            </View>
          )}
          <View style={styles.feedBody}>
            <Text style={[styles.feedTitle, { color: colors.text }]}>
              Ka pai! {item.userName} earned &quot;{item.achievementName}&quot;
            </Text>
            <Text
              style={[styles.feedDescription, { color: colors.textSecondary }]}
            >
              {item.description}
            </Text>
            <View style={styles.feedFooter}>
              <Text
                style={[styles.feedMetaText, { color: colors.textSecondary }]}
              >
                {timeAgo}
              </Text>
              {socialButtons}
            </View>
          </View>
        </>
      );
    }

    if (item.type === "milestone") {
      return (
        <>
          {item.isFriend ? (
            <FeedAvatar
              profilePhotoUrl={item.profilePhotoUrl}
              userName={item.userName}
              emoji="🔥"
              badgeBg="#dcfce7"
            />
          ) : (
            <View style={[styles.feedIcon, { backgroundColor: "#dcfce7" }]}>
              <Text style={styles.feedIconEmoji}>🔥</Text>
            </View>
          )}
          <View style={styles.feedBody}>
            <Text style={[styles.feedTitle, { color: colors.text }]}>
              {item.userName} reached {item.count} shifts!
            </Text>
            <Text
              style={[styles.feedDescription, { color: colors.textSecondary }]}
            >
              Ngā mihi nui — what a legend 💚
            </Text>
            <View style={styles.feedFooter}>
              <Text
                style={[styles.feedMetaText, { color: colors.textSecondary }]}
              >
                {timeAgo}
              </Text>
              {socialButtons}
            </View>
          </View>
        </>
      );
    }

    if (item.type === "photo_post") {
      return (
        <>
          {item.isFriend ? (
            <FeedAvatar
              profilePhotoUrl={item.profilePhotoUrl}
              userName={item.userName}
              emoji="📸"
              badgeBg="#fce7f3"
            />
          ) : (
            <View style={[styles.feedIcon, { backgroundColor: "#fce7f3" }]}>
              <Text style={styles.feedIconEmoji}>📸</Text>
            </View>
          )}
          <View style={styles.feedBody}>
            <Text style={[styles.feedTitle, { color: colors.text }]}>
              {item.userName} shared photos
            </Text>
            <Text
              style={[styles.feedDescription, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              📍 {item.location} ·{" "}
              {formatNZT(new Date(item.shiftDate), "d MMM")} {item.period}
            </Text>
            <Text
              style={[styles.feedDescription, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {item.caption}
            </Text>
            {/* Inline photo preview */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.feedPhotoStrip}
              contentContainerStyle={styles.feedPhotoStripContent}
            >
              {item.photos.slice(0, 3).map((uri, i) => (
                <Pressable
                  key={`${item.id}-thumb-${i}`}
                  onPress={() => onOpenImages(item.photos, i)}
                  accessibilityLabel="View photo"
                  accessibilityRole="imagebutton"
                >
                  <Image source={{ uri }} style={styles.feedPhotoThumb} />
                </Pressable>
              ))}
              {item.photos.length > 3 && (
                <Pressable
                  onPress={() => onOpenImages(item.photos, 3)}
                  style={[
                    styles.feedPhotoThumb,
                    styles.feedPhotoMore,
                    {
                      backgroundColor: colors.border,
                    },
                  ]}
                  accessibilityLabel={`View ${item.photos.length - 3} more photos`}
                  accessibilityRole="imagebutton"
                >
                  <Text
                    style={[
                      styles.feedPhotoMoreText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    +{item.photos.length - 3}
                  </Text>
                </Pressable>
              )}
            </ScrollView>
            <View style={styles.feedFooter}>
              <Text
                style={[styles.feedMetaText, { color: colors.textSecondary }]}
              >
                {timeAgo}
              </Text>
              {socialButtons}
            </View>
          </View>
        </>
      );
    }

    if (item.type === "friend_signup") {
      return (
        <>
          <FeedAvatar
            profilePhotoUrl={item.profilePhotoUrl}
            userName={item.userName}
            emoji="✋"
            badgeBg="#dbeafe"
          />
          <View style={styles.feedBody}>
            <Text style={[styles.feedTitle, { color: colors.text }]}>
              {item.userName} signed up for {item.shiftTypeName}
            </Text>
            <Text
              style={[styles.feedDescription, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              📍 {item.location} ·{" "}
              {formatNZT(new Date(item.shiftDate), "EEEE d MMM")}
            </Text>
            <View style={styles.feedFooter}>
              <Text
                style={[styles.feedMetaText, { color: colors.textSecondary }]}
              >
                {timeAgo}
              </Text>
              {socialButtons}
            </View>
          </View>
        </>
      );
    }

    if (item.type === "shift_recap") {
      return (
        <>
          <View style={[styles.feedIcon, { backgroundColor: "#d1fae5" }]}>
            <Text style={styles.feedIconEmoji}>🍽️</Text>
          </View>
          <View style={styles.feedBody}>
            <Text style={[styles.feedTitle, { color: colors.text }]}>
              {item.location} — {formatNZT(new Date(item.date), "EEEE d MMM")}
            </Text>
            <Text
              style={[styles.feedDescription, { color: colors.textSecondary }]}
            >
              {getRecapMessage(
                item.mealsServed,
                item.volunteerCount,
                item.volunteerHours,
                item.id
              )}
            </Text>
            <View style={styles.feedFooter}>
              <Text
                style={[styles.feedMetaText, { color: colors.textSecondary }]}
              >
                {timeAgo}
              </Text>
              {socialButtons}
            </View>
          </View>
        </>
      );
    }

    return null;
  };

  const hasAnnouncementImage =
    item.type === "announcement" && !!item.imageUrl;

  return (
    <Pressable
      onPress={onShowSheet}
      style={({ pressed }) => [
        styles.feedCard,
        borderStyle,
        hasAnnouncementImage && styles.feedCardColumn,
        { opacity: pressed ? 0.7 : 1 },
      ]}
      accessibilityRole="button"
    >
      {renderContent()}
      {/* Report button — positioned top-right, only for user-generated items */}
      {(item.type === "achievement" ||
        item.type === "milestone" ||
        item.type === "friend_signup" ||
        item.type === "announcement") && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onReport();
          }}
          hitSlop={10}
          style={({ pressed }) => [
            styles.reportBtn,
            { opacity: pressed ? 0.5 : isReported ? 0.7 : 0.35 },
          ]}
          accessibilityLabel={isReported ? "Already reported" : "Report this post"}
          accessibilityRole="button"
        >
          <Ionicons
            name={isReported ? "flag" : "ellipsis-horizontal"}
            size={14}
            color={isReported ? "#f97316" : colors.textSecondary}
          />
        </Pressable>
      )}
    </Pressable>
  );
}

/* ── Feed Item Sheet ── */

const SHEET_TYPE_CONFIG = {
  announcement: {
    emoji: "📢",
    label: "Announcement",
    bg: "#fef9c3",
    bgDark: "rgba(254, 249, 195, 0.12)",
    accent: "#b45309",
    accentDark: "#fbbf24",
    accentSoft: "#fef3c7",
    accentSoftDark: "rgba(251, 191, 36, 0.10)",
  },
  achievement: {
    emoji: "🏆",
    label: "Achievement",
    bg: "#fef3c7",
    bgDark: "rgba(254, 243, 199, 0.12)",
    accent: "#d97706",
    accentDark: "#fbbf24",
    accentSoft: "#fef9c3",
    accentSoftDark: "rgba(251, 191, 36, 0.10)",
  },
  milestone: {
    emoji: "🔥",
    label: "Milestone",
    bg: "#dcfce7",
    bgDark: "rgba(220, 252, 231, 0.12)",
    accent: "#16a34a",
    accentDark: "#86efac",
    accentSoft: "#f0fdf4",
    accentSoftDark: "rgba(34, 197, 94, 0.10)",
  },
  photo_post: {
    emoji: "📸",
    label: "Photo",
    bg: "#fce7f3",
    bgDark: "rgba(236, 72, 153, 0.12)",
    accent: "#be185d",
    accentDark: "#f9a8d4",
    accentSoft: "#fdf2f8",
    accentSoftDark: "rgba(236, 72, 153, 0.10)",
  },
  friend_signup: {
    emoji: "✋",
    label: "Friend Activity",
    bg: "#dbeafe",
    bgDark: "rgba(59, 130, 246, 0.12)",
    accent: "#1d4ed8",
    accentDark: "#93c5fd",
    accentSoft: "#eff6ff",
    accentSoftDark: "rgba(59, 130, 246, 0.10)",
  },
  shift_recap: {
    emoji: "🍽️",
    label: "Shift Recap",
    bg: "#d1fae5",
    bgDark: "rgba(16, 185, 129, 0.12)",
    accent: "#047857",
    accentDark: "#6ee7b7",
    accentSoft: "#ecfdf5",
    accentSoftDark: "rgba(16, 185, 129, 0.10)",
  },
} as const;

function FeedItemSheet({
  item,
  likers,
  liked,
  onToggleLike,
  onClose,
  colors,
  isDark,
  comments,
  isLoadingComments,
  onAddComment,
  onOpenImages,
}: {
  item: FeedItem;
  likers: LikeUser[];
  liked: boolean;
  onToggleLike: () => void;
  onClose: () => void;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  comments: FeedComment[];
  isLoadingComments?: boolean;
  onAddComment: (text: string) => void;
  onOpenImages: (images: string[], index: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const [commentText, setCommentText] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollToEnd = useCallback(() => {
    setTimeout(
      () => scrollViewRef.current?.scrollToEnd({ animated: true }),
      50
    );
  }, []);
  const timeAgo = formatDistanceToNow(new Date(item.timestamp), {
    addSuffix: true,
  });
  const config = SHEET_TYPE_CONFIG[item.type];
  const accentColor = isDark ? config.accentDark : config.accent;

  // Determine hero avatar for friend items
  const hasFriendAvatar =
    (item.type === "achievement" ||
      item.type === "milestone" ||
      item.type === "photo_post" ||
      item.type === "friend_signup") &&
    item.isFriend &&
    item.profilePhotoUrl;

  // Build title/body
  let title = "";
  let body = "";
  if (item.type === "announcement") {
    title = item.title;
    body = item.body;
  } else if (item.type === "achievement") {
    title = `Ka pai! ${item.userName} earned "${item.achievementName}"`;
    body = item.description;
  } else if (item.type === "milestone") {
    title = `${item.userName} reached ${item.count} shifts!`;
    body = "Ngā mihi nui — what a legend 💚";
  } else if (item.type === "photo_post") {
    title = `${item.userName} shared photos`;
    body = item.caption;
  } else if (item.type === "friend_signup") {
    title = `${item.userName} signed up for ${item.shiftTypeName}`;
    body = `📍 ${item.location} · ${formatNZT(
      new Date(item.shiftDate),
      "EEEE d MMM"
    )}`;
  } else if (item.type === "shift_recap") {
    title = `${item.location} — ${formatNZT(
      new Date(item.date),
      "EEEE d MMM"
    )}`;
    body = getRecapMessage(
      item.mealsServed,
      item.volunteerCount,
      item.volunteerHours,
      item.id
    );
  }

  const likeCount = likers.length;
  const shownLikers = likers.slice(0, 5);

  return (
    <Modal
      visible
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.sheetPage}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[styles.sheetPage, { backgroundColor: colors.background }]}
        >
          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom: Math.max(insets.bottom, 20) + 12,
            }}
          >
            {/* ── Hero section (handle bar embedded) ── */}
            <View
              style={[
                sheet.heroBanner,
                { backgroundColor: isDark ? config.bgDark : config.bg },
              ]}
            >
              {/* Handle bar */}
              <View
                style={[
                  styles.sheetHandleBar,
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
                  sheet.heroRing,
                  sheet.heroRingOuter,
                  {
                    borderColor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(0,0,0,0.03)",
                  },
                ]}
              />
              <View
                style={[
                  sheet.heroRing,
                  sheet.heroRingInner,
                  {
                    borderColor: isDark
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(0,0,0,0.04)",
                  },
                ]}
              />

              {/* Close pill - top right */}
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityLabel="Close"
                accessibilityRole="button"
                style={({ pressed }) => [
                  sheet.closePill,
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

              {/* Hero icon or friend avatar */}
              {hasFriendAvatar ? (
                <View style={sheet.heroAvatarWrapper}>
                  <Image
                    source={{
                      uri: (item as { profilePhotoUrl: string })
                        .profilePhotoUrl,
                    }}
                    style={sheet.heroAvatar}
                  />
                  <View
                    style={[
                      sheet.heroAvatarBadge,
                      {
                        backgroundColor: isDark ? colors.card : "#ffffff",
                        borderColor: isDark ? colors.card : config.bg,
                      },
                    ]}
                  >
                    <Text style={sheet.heroAvatarBadgeEmoji}>
                      {config.emoji}
                    </Text>
                  </View>
                </View>
              ) : (
                <View
                  style={[
                    sheet.heroIconCircle,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(255,255,255,0.65)",
                    },
                  ]}
                >
                  <Text style={sheet.heroEmoji}>{config.emoji}</Text>
                </View>
              )}

              {/* Type label pill */}
              <View
                style={[
                  sheet.heroLabel,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(0,0,0,0.04)",
                  },
                ]}
              >
                <Text style={[sheet.heroLabelText, { color: accentColor }]}>
                  {config.label}
                </Text>
              </View>
            </View>

            {/* ── Content card ── */}
            <View
              style={[
                sheet.contentCard,
                {
                  backgroundColor: colors.card,
                  shadowColor: isDark ? "#000" : "#64748b",
                },
              ]}
            >
              {/* Title */}
              <Text style={[sheet.title, { color: colors.text }]}>{title}</Text>

              {/* Body text — use Markdown renderer for announcements */}
              {item.type === "announcement" ? (
                <Markdown
                  style={{
                    body: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, fontFamily: FontFamily.regular },
                    strong: { color: colors.text },
                    link: { color: colors.primary },
                    bullet_list: { marginVertical: 4 },
                    ordered_list: { marginVertical: 4 },
                  }}
                >
                  {body}
                </Markdown>
              ) : (
                <Text style={[sheet.body, { color: colors.textSecondary }]}>
                  {body}
                </Text>
              )}

              {/* Meta pills */}
              <View style={sheet.metaRow}>
                {item.type === "announcement" && (
                  <View
                    style={[
                      sheet.metaPill,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.05)"
                          : "#f8fafc",
                      },
                    ]}
                  >
                    <Ionicons
                      name="person"
                      size={11}
                      color={colors.textSecondary}
                    />
                    <Text
                      style={[
                        sheet.metaPillText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {item.author}
                    </Text>
                  </View>
                )}
                {item.type === "photo_post" && (
                  <>
                    <View
                      style={[
                        sheet.metaPill,
                        {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.05)"
                            : "#f8fafc",
                        },
                      ]}
                    >
                      <Ionicons
                        name="location"
                        size={11}
                        color={colors.textSecondary}
                      />
                      <Text
                        style={[
                          sheet.metaPillText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {item.location}
                      </Text>
                    </View>
                    <View
                      style={[
                        sheet.metaPill,
                        {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.05)"
                            : "#f8fafc",
                        },
                      ]}
                    >
                      <Ionicons
                        name="calendar"
                        size={11}
                        color={colors.textSecondary}
                      />
                      <Text
                        style={[
                          sheet.metaPillText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {formatNZT(new Date(item.shiftDate), "d MMM")}{" "}
                        {item.period}
                      </Text>
                    </View>
                  </>
                )}
                <View
                  style={[
                    sheet.metaPill,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.05)"
                        : "#f8fafc",
                    },
                  ]}
                >
                  <Ionicons
                    name="time"
                    size={11}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      sheet.metaPillText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {timeAgo}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Photo gallery (for photo_post type) ── */}
            {/* Announcement image */}
            {item.type === "announcement" && item.imageUrl && (
              <Pressable
                onPress={() => onOpenImages([item.imageUrl!], 0)}
                accessibilityLabel="View announcement image"
                accessibilityRole="imagebutton"
              >
                <Image
                  source={{ uri: item.imageUrl }}
                  style={[sheet.photoSingle, { borderRadius: 12, marginBottom: 12 }]}
                  resizeMode="cover"
                />
              </Pressable>
            )}

            {item.type === "photo_post" && item.photos.length > 0 && (
              <View
                style={[
                  sheet.photoGalleryCard,
                  {
                    backgroundColor: colors.card,
                    shadowColor: isDark ? "#000" : "#64748b",
                  },
                ]}
              >
                {item.photos.length === 1 ? (
                  <Pressable
                    onPress={() => onOpenImages(item.photos, 0)}
                    accessibilityLabel="View photo"
                    accessibilityRole="imagebutton"
                  >
                    <Image
                      source={{ uri: item.photos[0] }}
                      style={sheet.photoSingle}
                    />
                  </Pressable>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={sheet.photoScrollContent}
                  >
                    {item.photos.map((uri, i) => (
                      <Pressable
                        key={`${item.id}-photo-${i}`}
                        onPress={() => onOpenImages(item.photos, i)}
                        accessibilityLabel="View photo"
                        accessibilityRole="imagebutton"
                      >
                        <Image
                          source={{ uri }}
                          style={sheet.photoScrollItem}
                        />
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
                <Text
                  style={[sheet.photoCount, { color: colors.textSecondary }]}
                >
                  {item.photos.length}{" "}
                  {item.photos.length === 1 ? "photo" : "photos"}
                </Text>
              </View>
            )}

            {/* ── Unified social section (likes + comments) ── */}
            <View
              style={[
                sheet.socialCard,
                {
                  backgroundColor: colors.card,
                  shadowColor: isDark ? "#000" : "#64748b",
                },
              ]}
            >
              {/* Like row */}
              <View style={sheet.socialRow}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onToggleLike();
                  }}
                  style={({ pressed }) => [
                    sheet.likeButton,
                    {
                      backgroundColor: liked
                        ? "rgba(225, 29, 72, 0.10)"
                        : isDark
                        ? "rgba(255,255,255,0.05)"
                        : "#f8fafc",
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                    },
                  ]}
                  accessibilityLabel={liked ? "Unlike" : "Like"}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={liked ? "heart" : "heart-outline"}
                    size={20}
                    color={liked ? "#e11d48" : colors.textSecondary}
                  />
                </Pressable>

                <View style={sheet.socialInfo}>
                  <Text
                    style={[
                      sheet.socialTitle,
                      { color: liked ? "#e11d48" : colors.text },
                    ]}
                  >
                    {liked ? "You liked this" : "Like this"}
                  </Text>
                  {likeCount > 0 && (
                    <Text
                      style={[
                        sheet.socialCount,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {likeCount} {likeCount === 1 ? "person" : "people"} liked
                      this
                    </Text>
                  )}
                </View>

                {shownLikers.length > 0 && (
                  <View style={sheet.socialAvatarStack}>
                    {shownLikers.map((liker, i) => {
                      const initial = liker.name.charAt(0).toUpperCase();
                      return (
                        <View
                          key={liker.id}
                          style={[
                            sheet.socialAvatarRing,
                            {
                              zIndex: shownLikers.length - i,
                              marginLeft: i === 0 ? 0 : -10,
                              borderColor: colors.card,
                            },
                          ]}
                        >
                          {liker.profilePhotoUrl ? (
                            <Image
                              source={{ uri: liker.profilePhotoUrl }}
                              style={sheet.socialAvatarImg}
                            />
                          ) : (
                            <View
                              style={[
                                sheet.socialAvatarFallback,
                                { backgroundColor: Brand.greenLight },
                              ]}
                            >
                              <Text
                                style={[
                                  sheet.socialAvatarInitial,
                                  { color: Brand.green },
                                ]}
                              >
                                {initial}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                    {likeCount > 5 && (
                      <View
                        style={[
                          sheet.socialAvatarRing,
                          {
                            zIndex: 0,
                            marginLeft: -10,
                            borderColor: colors.card,
                          },
                        ]}
                      >
                        <View
                          style={[
                            sheet.socialAvatarFallback,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.08)"
                                : "#f1f5f9",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              sheet.socialAvatarInitial,
                              { color: colors.textSecondary },
                            ]}
                          >
                            +{likeCount - 5}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Divider between likes and comments */}
              <View
                style={[
                  sheet.socialDivider,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.06)"
                      : "#f1f5f9",
                  },
                ]}
              />

              {/* Comments */}
              {isLoadingComments ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={{ marginVertical: 12 }}
                />
              ) : comments.length > 0 ? (
                <View style={sheet.commentsList}>
                  {comments.map((comment) => {
                    const initial = comment.userName.charAt(0).toUpperCase();
                    const commentTimeAgo = formatDistanceToNow(
                      new Date(comment.timestamp),
                      { addSuffix: true }
                    );
                    return (
                      <View key={comment.id} style={sheet.commentRow}>
                        {comment.profilePhotoUrl ? (
                          <Image
                            source={{ uri: comment.profilePhotoUrl }}
                            style={sheet.commentAvatar}
                          />
                        ) : (
                          <View
                            style={[
                              sheet.commentAvatarFallback,
                              { backgroundColor: Brand.greenLight },
                            ]}
                          >
                            <Text
                              style={[
                                sheet.commentAvatarInitial,
                                { color: Brand.green },
                              ]}
                            >
                              {initial}
                            </Text>
                          </View>
                        )}
                        <View style={sheet.commentContent}>
                          <View style={sheet.commentHeader}>
                            <Text
                              style={[
                                sheet.commentUserName,
                                { color: colors.text },
                              ]}
                              numberOfLines={1}
                            >
                              {comment.userName}
                            </Text>
                            <Text
                              style={[
                                sheet.commentTime,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {commentTimeAgo}
                            </Text>
                          </View>
                          <Text
                            style={[sheet.commentText, { color: colors.text }]}
                          >
                            {comment.text}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text
                  style={[sheet.commentsEmpty, { color: colors.textSecondary }]}
                >
                  Be the first to comment 💬
                </Text>
              )}

              {/* Comment input */}
              <View
                style={[
                  sheet.commentInputRow,
                  {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: isDark
                      ? "rgba(255,255,255,0.06)"
                      : "#f1f5f9",
                  },
                ]}
              >
                <TextInput
                  style={[
                    sheet.commentInput,
                    {
                      color: colors.text,
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.05)"
                        : "#f8fafc",
                    },
                  ]}
                  placeholder="Add a comment..."
                  placeholderTextColor={colors.textSecondary}
                  value={commentText}
                  onChangeText={setCommentText}
                  onFocus={scrollToEnd}
                  multiline
                  maxLength={280}
                />
                <Pressable
                  onPress={() => {
                    const trimmed = commentText.trim();
                    if (trimmed) {
                      onAddComment(trimmed);
                      setCommentText("");
                    }
                  }}
                  disabled={!commentText.trim()}
                  style={({ pressed }) => [
                    sheet.commentSendButton,
                    {
                      backgroundColor: commentText.trim()
                        ? Brand.green
                        : isDark
                        ? "rgba(255,255,255,0.05)"
                        : "#e2e8f0",
                      opacity: pressed && commentText.trim() ? 0.7 : 1,
                    },
                  ]}
                  accessibilityLabel="Send comment"
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="arrow-up"
                    size={18}
                    color={
                      commentText.trim() ? "#ffffff" : colors.textSecondary
                    }
                  />
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    // paddingBottom is set dynamically via insets.bottom in contentContainerStyle
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerLeft: {
    gap: 2,
  },
  greeting: {
    fontSize: 15,
    marginBottom: 2,
  },
  avatarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 20,
    fontFamily: FontFamily.bold,
  },

  // Open shifts banner
  openShiftsBanner: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
  },
  openShiftsContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  openShiftsEmoji: {
    fontSize: 24,
  },
  openShiftsTitle: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
  openShiftsBody: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    opacity: 0.8,
    marginTop: 1,
  },

  // Feed
  feedSection: {
    marginTop: 28,
    paddingHorizontal: 20,
  },
  feedHeading: {
    marginBottom: 14,
  },
  feedList: {
    backgroundColor: "transparent",
  },
  feedCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 14,
    gap: 12,
  },
  feedCardColumn: {
    flexDirection: "column",
    gap: 0,
  },
  reportBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 4,
  },
  announcementImage: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    marginBottom: 10,
  },
  feedIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  feedIconEmoji: {
    fontSize: 18,
  },
  feedBody: {
    flex: 1,
    gap: 3,
  },
  feedTitle: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    lineHeight: 20,
  },
  feedDescription: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 20,
  },
  feedFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  likeCount: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
  },

  // Friend avatar with badge
  feedAvatarContainer: {
    width: 42,
    height: 42,
    marginTop: 1,
  },
  feedAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  feedAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  feedAvatarInitial: {
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
    color: Brand.green,
  },
  feedAvatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  feedAvatarBadgeEmoji: {
    fontSize: 10,
  },
  feedSocialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  commentButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
  },
  commentCount: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
  },
  feedMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
  },
  feedMetaText: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },
  feedDot: {
    fontSize: 12,
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 16,
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    textAlign: "center",
    fontStyle: "italic",
  },
  footerSubtext: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    textAlign: "center",
    opacity: 0.7,
  },

  // Feed photo thumbnails
  feedPhotoStrip: {
    marginTop: 6,
  },
  feedPhotoStripContent: {
    gap: 6,
  },
  feedPhotoThumb: {
    width: 72,
    height: 54,
    borderRadius: 8,
    overflow: "hidden",
  },
  feedPhotoMore: {
    alignItems: "center",
    justifyContent: "center",
  },
  feedPhotoMoreText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
  },

  // Sheet (native pageSheet — only handle + page wrapper)
  sheetPage: {
    flex: 1,
  },
  sheetHandleBar: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    alignSelf: "center",
  },
});

/* ── Sheet detail styles ── */

const sheet = StyleSheet.create({
  // Hero banner
  heroBanner: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 24,
    gap: 16,
    overflow: "hidden",
  },
  heroRing: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 999,
  },
  heroRingOuter: {
    width: 280,
    height: 280,
    top: -60,
  },
  heroRingInner: {
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
  heroIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  heroEmoji: {
    fontSize: 32,
  },
  heroAvatarWrapper: {
    width: 80,
    height: 80,
  },
  heroAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  heroAvatarBadge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
  heroAvatarBadgeEmoji: {
    fontSize: 13,
  },
  heroLabel: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  heroLabelText: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  // Content card
  contentCard: {
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
  body: {
    fontSize: 15,
    fontFamily: FontFamily.regular,
    lineHeight: 23,
    textAlign: "center",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  metaPillText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
  },

  // Social card
  socialCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    padding: 18,
    gap: 0,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  likeButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  socialInfo: {
    flex: 1,
    gap: 2,
  },
  socialTitle: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
  socialCount: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },
  socialAvatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  socialAvatarRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    overflow: "hidden",
  },
  socialAvatarImg: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
  },
  socialAvatarFallback: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    alignItems: "center",
    justifyContent: "center",
  },
  socialAvatarInitial: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
  },

  // Divider between likes and comments
  socialDivider: {
    height: 1,
    marginVertical: 14,
  },

  // Photo gallery
  photoGalleryCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  photoSingle: {
    width: "100%",
    height: 220,
  },
  photoScrollContent: {
    gap: 3,
  },
  photoScrollItem: {
    width: 220,
    height: 180,
  },
  photoCount: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    textAlign: "center",
    paddingVertical: 10,
  },

  // Comments (inside social card)
  commentsEmpty: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    textAlign: "center",
    paddingVertical: 16,
  },
  commentsList: {
    gap: 4,
    marginTop: 4,
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginTop: 2,
  },
  commentAvatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  commentAvatarInitial: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
  },
  commentContent: {
    flex: 1,
    gap: 2,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  commentUserName: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
    flex: 1,
  },
  commentTime: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
  },
  commentText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 20,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
  },
  commentInput: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    fontFamily: FontFamily.regular,
    maxHeight: 80,
  },
  commentSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
