import { Ionicons } from "@expo/vector-icons";
import { MenuView, type MenuAction } from "@react-native-menu/menu";
import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  endOfWeek,
  formatDistanceToNow,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { formatNZT } from "@/lib/dates";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-native-markdown-display";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { useNotifications } from "@/hooks/use-notifications";
import { useProfile } from "@/hooks/use-profile";
import { useShifts, type PeriodFriend } from "@/hooks/use-shifts";
import {
  getShiftThemeByName,
  type FeedComment,
  type FeedItem,
  type LikeUser,
  type Shift,
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
    userDefaultLocation,
    isLoading: shiftsLoading,
    refresh: refreshShifts,
  } = useShifts();
  const {
    items: feedItems,
    isLoading: feedLoading,
    refresh: refreshFeed,
    updateItem: updateFeedItem,
    removeItemsByUser,
  } = useFeed();
  const { unreadCount: unreadNotifications } = useNotifications();

  const {
    toggleLike: apiToggleLike,
    loadComments,
    addComment: apiAddComment,
    editComment: apiEditComment,
    deleteComment: apiDeleteComment,
    getCommentState,
    reportItem,
    hasReported,
    blockUser,
    hasBlocked,
    removeCommentsByUser,
  } = useFeedInteractions();

  const nextShift = myShifts[0] ?? null;
  const nextShiftFriends: PeriodFriend[] = nextShift
    ? periodFriends[getShiftPeriodKey(new Date(nextShift.start))] ?? []
    : [];

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  /* Scope the "volunteers needed" card to the user's home restaurant when they
     have one set — shifts elsewhere aren't actionable for most volunteers.
     Falls back to every location when no default is configured. */
  const thisWeekAvailable = available.filter((s) => {
    const start = new Date(s.start);
    if (start < weekStart || start > weekEnd) return false;
    if (userDefaultLocation && s.location !== userDefaultLocation) return false;
    return true;
  });

  const [likesSheetItemId, setLikesSheetItemId] = useState<string | null>(null);
  const likesSheetItem = likesSheetItemId
    ? feedItems.find((i) => i.id === likesSheetItemId) ?? null
    : null;
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
      const myId = profile?.id;
      const others = myId
        ? item.recentLikers.filter((l) => l.id !== myId)
        : item.recentLikers;
      return item.likedByMe ? [ME_AS_LIKER, ...others] : others;
    },
    [ME_AS_LIKER, profile?.id]
  );

  const getCommentsForItem = useCallback(
    (itemId: string): FeedComment[] => {
      return getCommentState(itemId).comments;
    },
    [getCommentState]
  );

  const handleOpenSheet = useCallback(
    (item: FeedItem) => {
      setLikesSheetItemId(item.id);
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

  const editComment = useCallback(
    async (itemId: string, commentId: string, text: string) => {
      Haptics.selectionAsync();
      const result = await apiEditComment(itemId, commentId, text);
      if (!result) {
        Alert.alert(
          "Couldn't save",
          "We couldn't update your comment. Please try again."
        );
      }
      return result;
    },
    [apiEditComment]
  );

  const deleteComment = useCallback(
    (itemId: string, commentId: string) => {
      Alert.alert("Delete comment?", "This can't be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const ok = await apiDeleteComment(itemId, commentId);
            if (ok) {
              const item = feedItems.find((i) => i.id === itemId);
              if (item) {
                updateFeedItem(itemId, {
                  commentCount: Math.max(0, item.commentCount - 1),
                });
              }
            } else {
              Alert.alert(
                "Couldn't delete",
                "We couldn't delete your comment. Please try again."
              );
            }
          },
        },
      ]);
    },
    [apiDeleteComment, feedItems, updateFeedItem]
  );

  const confirmBlockUser = useCallback(
    (targetUserId: string, displayName: string, onBlocked?: () => void) => {
      Alert.alert(
        "Block User",
        `Block ${displayName}? Their content will be removed from your feed immediately. The Everybody Eats team will be notified.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Block",
            style: "destructive",
            onPress: async () => {
              const ok = await blockUser(targetUserId);
              if (ok) {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                );
                removeItemsByUser(targetUserId);
                removeCommentsByUser(targetUserId);
                Alert.alert(
                  "User Blocked",
                  `${displayName} has been blocked. Their content is no longer visible.`
                );
                onBlocked?.();
              } else {
                Alert.alert(
                  "Error",
                  "Could not block this user. Please try again."
                );
              }
            },
          },
        ]
      );
    },
    [blockUser, removeCommentsByUser, removeItemsByUser]
  );

  const openModerationSheet = useCallback(
    (item: FeedItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const authorId = (item as { userId?: string }).userId ?? null;
      const authorName =
        (item as { userName?: string }).userName ?? "this user";

      const alreadyReported = hasReported(item.id);
      const alreadyBlocked = authorId ? hasBlocked(authorId) : false;

      const options: {
        text: string;
        style?: "default" | "cancel" | "destructive";
        onPress?: () => void;
      }[] = [];

      if (alreadyReported) {
        options.push({
          text: "Already reported — pending review",
          style: "cancel",
        });
      } else {
        options.push(
          {
            text: "Offensive or abusive",
            onPress: () =>
              reportItem("post", item.id, "Offensive or abusive content"),
          },
          {
            text: "Spam",
            onPress: () => reportItem("post", item.id, "Spam"),
          },
          {
            text: "Harassment",
            onPress: () => reportItem("post", item.id, "Harassment"),
          }
        );
      }

      if (authorId && !alreadyBlocked) {
        options.push({
          text: `⛔ Block ${authorName}`,
          style: "destructive",
          onPress: () => confirmBlockUser(authorId, authorName),
        });
      } else if (authorId && alreadyBlocked) {
        options.push({
          text: `${authorName} is blocked`,
          style: "cancel",
        });
      }

      options.push({ text: "Cancel", style: "cancel" });

      Alert.alert(
        "Moderate this post",
        "Help keep our whānau safe. Reports are reviewed within 24 hours.",
        options
      );
    },
    [confirmBlockUser, hasBlocked, hasReported, reportItem]
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        Platform.OS === "android" && { paddingTop: insets.top },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={shiftsLoading || feedLoading}
          onRefresh={() => {
            refreshShifts();
            refreshFeed();
          }}
          tintColor={colors.tint}
          colors={[colors.tint]}
          progressBackgroundColor={colors.card}
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
        <View style={styles.headerRight}>
          <Pressable
            onPress={() => router.push("/notifications" as Href)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.bellButton,
              {
                backgroundColor:
                  colorScheme === "dark"
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(14, 58, 35, 0.06)",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              unreadNotifications > 0
                ? `Notifications, ${unreadNotifications} unread`
                : "Notifications"
            }
          >
            <Ionicons
              name={
                unreadNotifications > 0
                  ? "notifications"
                  : "notifications-outline"
              }
              size={22}
              color={colors.text}
            />
            {unreadNotifications > 0 && (
              <View
                style={[
                  styles.bellDot,
                  {
                    backgroundColor: Brand.accent,
                    borderColor: colors.background,
                  },
                ]}
              />
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            style={({ pressed }) => [
              styles.avatarButton,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityLabel="View profile"
          >
            {profile?.image ? (
              <Image
                source={{ uri: profile.image }}
                style={styles.avatarImage}
              />
            ) : (
              <View
                style={[
                  styles.avatarFallback,
                  { backgroundColor: Brand.green },
                ]}
              >
                <Text style={styles.avatarText}>
                  {(profile?.firstName ?? "").charAt(0)}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* ── Next Shift Hero ── */}
      {nextShift && (
        <NextShiftHero
          shift={nextShift}
          friends={nextShiftFriends}
          onPress={() => router.push(`/shift/${nextShift.id}` as Href)}
        />
      )}

      {/* ── Volunteers Needed ──
           Collapses to a slim reminder when the user already has a confirmed
           shift this week — they've done their part; just surface the wider
           roster gap as an easy tap-in for picking up more. */}
      <VolunteersNeededCard
        shifts={thisWeekAvailable}
        marginTop={nextShift ? 20 : 0}
        collapsible={nextShift?.status === "CONFIRMED"}
        onShiftPress={(id) => router.push(`/shift/${id}` as Href)}
        onBrowseDay={(dateKey) =>
          router.push(`/(tabs)/shifts?date=${dateKey}` as Href)
        }
      />

      {/* ── Activity Feed ── */}
      <View style={styles.feedSection}>
        <ThemedText type="heading" style={styles.feedHeading}>
          What&apos;s happening 🌿
        </ThemedText>

        {feedLoading && feedItems.length === 0 ? (
          <FeedSkeleton colors={colors} />
        ) : (
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
                onReport={() => openModerationSheet(item)}
              />
            ))}
          </View>
        )}
      </View>

      {/* ── Likes Sheet ── */}
      {likesSheetItem && (
        <FeedItemSheet
          item={likesSheetItem}
          likers={getLikersForItem(likesSheetItem)}
          liked={likesSheetItem.likedByMe}
          onToggleLike={() => toggleLike(likesSheetItem)}
          onClose={() => setLikesSheetItemId(null)}
          colors={colors}
          isDark={colorScheme === "dark"}
          comments={getCommentsForItem(likesSheetItem.id)}
          isLoadingComments={getCommentState(likesSheetItem.id).isLoading}
          onAddComment={(text) => addComment(likesSheetItem.id, text)}
          onEditComment={(commentId, text) =>
            editComment(likesSheetItem.id, commentId, text)
          }
          onDeleteComment={(commentId) =>
            deleteComment(likesSheetItem.id, commentId)
          }
          hasReportedItem={hasReported}
          hasBlockedUser={hasBlocked}
          onReport={reportItem}
          onConfirmBlock={confirmBlockUser}
          currentUserId={profile?.id ?? ""}
          onOpenUserProfile={(userId) => {
            if (!userId) return;
            if (userId === profile?.id) {
              setLikesSheetItemId(null);
              router.push("/(tabs)/profile");
              return;
            }
            setLikesSheetItemId(null);
            router.push(`/user/${userId}` as Href);
          }}
          onModeratePost={
            likesSheetItem.type === "photo_post" ||
            likesSheetItem.type === "announcement"
              ? () => openModerationSheet(likesSheetItem)
              : undefined
          }
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
      <View style={[heroStyles.glowInner, { backgroundColor: palette.glow }]} />

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
          <View
            style={[heroStyles.statusPill, { backgroundColor: palette.pillBg }]}
          >
            <Ionicons name={palette.icon} size={12} color={palette.pillText} />
            <Text
              style={[heroStyles.statusPillText, { color: palette.pillText }]}
            >
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
          <View
            style={[heroStyles.accentBar, { backgroundColor: palette.accent }]}
          />
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
                style={[heroStyles.friendsLabel, { color: palette.mutedText }]}
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
        <View
          style={[heroStyles.friendAvatarWrap, { marginLeft: -10, zIndex: 0 }]}
        >
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

/* ── Volunteers Needed Card ── */

type ShortShift = Shift & { open: number };

type NeedPalette = {
  cardBg: string;
  cardBorder: string;
  glow: string;
  shadow: string;
  eyebrow: string;
  displayText: string;
  supportText: string;
  chipBg: string;
  chipDate: string;
  chipName: string;
  chipLocation: string;
  chipNeedsBg: string;
  chipNeedsText: string;
  ctaBorder: string;
  ctaText: string;
  ctaArrowBg: string;
  ctaArrowIcon: string;
};

const NEED_PALETTE_LIGHT: NeedPalette = {
  cardBg: "#fffdf4",
  cardBorder: "rgba(14, 58, 35, 0.08)",
  glow: "rgba(248, 251, 105, 0.35)",
  shadow: "#0e3a23",
  eyebrow: Brand.green,
  displayText: Brand.green,
  supportText: "rgba(16, 20, 24, 0.72)",
  chipBg: Brand.green,
  chipDate: Brand.accent,
  chipName: Brand.warmWhite,
  chipLocation: "rgba(255, 253, 247, 0.65)",
  chipNeedsBg: Brand.accent,
  chipNeedsText: Brand.nearBlack,
  ctaBorder: "rgba(14, 58, 35, 0.18)",
  ctaText: Brand.green,
  ctaArrowBg: Brand.green,
  ctaArrowIcon: Brand.warmWhite,
};

const NEED_PALETTE_DARK: NeedPalette = {
  // Deep warm forest — reads as a dark notice board behind paper chips
  cardBg: "#15231b",
  cardBorder: "rgba(248, 251, 105, 0.18)",
  glow: "rgba(248, 251, 105, 0.22)",
  shadow: "#000000",
  eyebrow: Brand.accent,
  displayText: "#f3f1e3",
  supportText: "rgba(243, 241, 227, 0.72)",
  // Chips are muted cream — dimmer than paper so they don't glow against dark
  chipBg: "#d9d3be",
  chipDate: Brand.green,
  chipName: Brand.nearBlack,
  chipLocation: "rgba(16, 20, 24, 0.62)",
  chipNeedsBg: Brand.green,
  chipNeedsText: Brand.accent,
  ctaBorder: "rgba(248, 251, 105, 0.22)",
  ctaText: Brand.accent,
  ctaArrowBg: Brand.accent,
  ctaArrowIcon: Brand.green,
};

function VolunteersNeededCard({
  shifts,
  marginTop,
  collapsible = false,
  onShiftPress,
  onBrowseDay,
}: {
  shifts: Shift[];
  marginTop: number;
  /** When true, start collapsed with a tap-to-expand slim header. */
  collapsible?: boolean;
  onShiftPress: (id: string) => void;
  /** Navigate to the shifts tab, scoped to this day (YYYY-MM-DD NZ time). */
  onBrowseDay: (dateKey: string) => void;
}) {
  const colorScheme = useColorScheme();
  const palette =
    colorScheme === "dark" ? NEED_PALETTE_DARK : NEED_PALETTE_LIGHT;

  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = useCallback(() => {
    Haptics.selectionAsync();
    setExpanded((prev) => !prev);
  }, []);

  const short: ShortShift[] = shifts
    .map((s) => ({ ...s, open: Math.max(s.capacity - s.signedUp, 0) }))
    .filter((s) => s.open > 0)
    .sort(
      (a, b) =>
        b.open - a.open ||
        new Date(a.start).getTime() - new Date(b.start).getTime()
    );

  if (short.length === 0) return null;

  const totalSpots = short.reduce((sum, s) => sum + s.open, 0);
  const topShifts = short.slice(0, 6);

  /* Earliest upcoming day with open shifts — the CTA jumps straight there. */
  const firstDayKey = short
    .map((s) => ({
      key: formatNZT(new Date(s.start), "yyyy-MM-dd"),
      time: new Date(s.start).getTime(),
    }))
    .sort((a, b) => a.time - b.time)[0].key;

  if (collapsible) {
    return (
      <View
        style={[
          needStyles.collapsibleCard,
          {
            marginTop,
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
            shadowColor: palette.shadow,
          },
        ]}
      >
        {/* Slim header — always visible, tap to expand/collapse */}
        <Pressable
          onPress={toggleExpanded}
          style={({ pressed }) => [
            needStyles.collapsibleHeader,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={
            expanded
              ? "Hide open shifts"
              : `Show ${totalSpots} ${
                  totalSpots === 1 ? "spot" : "spots"
                } still open this week`
          }
          hitSlop={6}
        >
          <Text style={needStyles.compactEmoji}>🙌</Text>
          <View style={needStyles.compactTextBlock}>
            <Text
              style={[needStyles.compactEyebrow, { color: palette.eyebrow }]}
              numberOfLines={1}
            >
              Help needed
            </Text>
            <Text
              style={[needStyles.compactBody, { color: palette.displayText }]}
              numberOfLines={1}
            >
              {totalSpots} more {totalSpots === 1 ? "spot" : "spots"} open this
              week
            </Text>
          </View>
          <View
            style={[
              needStyles.collapsibleChevron,
              { backgroundColor: palette.ctaArrowBg },
            ]}
          >
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={14}
              color={palette.ctaArrowIcon}
            />
          </View>
        </Pressable>

        {/* Expanded body — chips + browse CTA */}
        {expanded && (
          <View style={needStyles.collapsibleBody}>
            <View
              style={[
                needStyles.collapsibleDivider,
                { backgroundColor: palette.ctaBorder },
              ]}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={needStyles.chipsRow}
            >
              {topShifts.map((shift) => (
                <ShortShiftChip
                  key={shift.id}
                  shift={shift}
                  palette={palette}
                  onPress={() => onShiftPress(shift.id)}
                />
              ))}
            </ScrollView>

            <Pressable
              onPress={() => onBrowseDay(firstDayKey)}
              style={({ pressed }) => [
                needStyles.collapsibleCta,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Browse ${short.length} open shifts starting with the next day that needs help`}
              hitSlop={8}
            >
              <Text style={[needStyles.ctaText, { color: palette.ctaText }]}>
                {short.length > topShifts.length
                  ? `See all ${short.length} open shifts`
                  : "Browse open shifts"}
              </Text>
              <View
                style={[
                  needStyles.ctaArrow,
                  { backgroundColor: palette.ctaArrowBg },
                ]}
              >
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={palette.ctaArrowIcon}
                />
              </View>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        needStyles.card,
        {
          marginTop,
          backgroundColor: palette.cardBg,
          borderColor: palette.cardBorder,
          shadowColor: palette.shadow,
        },
      ]}
    >
      {/* Soft accent glow */}
      <View style={[needStyles.glow, { backgroundColor: palette.glow }]} />

      {/* Header: eyebrow + emoji */}
      <View style={needStyles.headerRow}>
        <Text style={[needStyles.eyebrow, { color: palette.eyebrow }]}>
          Help needed this week
        </Text>
        <Text style={needStyles.handsEmoji}>🙌</Text>
      </View>

      {/* Display number */}
      <View style={needStyles.displayRow}>
        <Text
          style={[needStyles.displayNumber, { color: palette.displayText }]}
        >
          {totalSpots}
        </Text>
        <Text style={[needStyles.displayUnit, { color: palette.displayText }]}>
          {totalSpots === 1 ? "spot" : "spots"}
        </Text>
      </View>

      <Text style={[needStyles.supportLine, { color: palette.supportText }]}>
        {short.length === 1
          ? "open on one shift · can you spare a few hours?"
          : `open across ${short.length} shifts · can you lend a hand?`}
      </Text>

      {/* Shift chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={needStyles.chipsScroll}
        contentContainerStyle={needStyles.chipsRow}
      >
        {topShifts.map((shift) => (
          <ShortShiftChip
            key={shift.id}
            shift={shift}
            palette={palette}
            onPress={() => onShiftPress(shift.id)}
          />
        ))}
      </ScrollView>

      {/* CTA row — jumps to the first day that needs crew */}
      <Pressable
        onPress={() => onBrowseDay(firstDayKey)}
        style={({ pressed }) => [
          needStyles.ctaRow,
          { borderTopColor: palette.ctaBorder },
          { opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Browse ${short.length} open shifts starting with the next day that needs help`}
        hitSlop={8}
      >
        <Text style={[needStyles.ctaText, { color: palette.ctaText }]}>
          {short.length > topShifts.length
            ? `See all ${short.length} open shifts`
            : "Browse open shifts"}
        </Text>
        <View
          style={[needStyles.ctaArrow, { backgroundColor: palette.ctaArrowBg }]}
        >
          <Ionicons
            name="arrow-forward"
            size={16}
            color={palette.ctaArrowIcon}
          />
        </View>
      </Pressable>
    </View>
  );
}

/** "Today" / "Tomorrow" / "In 3 days" — falls back to a date for the far future. */
function relativeDayLabel(start: Date): string {
  const days = differenceInDays(startOfDay(start), startOfDay(new Date()));
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1 && days < 14) return `In ${days} days`;
  return formatNZT(start, "EEE · d MMM");
}

function ShortShiftChip({
  shift,
  palette,
  onPress,
}: {
  shift: ShortShift;
  palette: NeedPalette;
  onPress: () => void;
}) {
  const theme = getShiftThemeByName(shift.shiftType.name);
  const start = new Date(shift.start);
  const dayLabel = relativeDayLabel(start);
  const startTime = formatNZT(start, "h:mm a");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        needStyles.chip,
        { backgroundColor: palette.chipBg },
        { transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${shift.shiftType.name} on ${formatNZT(
        start,
        "EEEE d MMMM"
      )} at ${startTime}, ${shift.location}, needs ${shift.open} more ${
        shift.open === 1 ? "volunteer" : "volunteers"
      }`}
    >
      <View style={needStyles.chipInner}>
        {/* Top: date eyebrow + big emoji + shift name (reserves 2 lines) */}
        <View style={needStyles.chipTop}>
          <View style={needStyles.chipDateRow}>
            <Text style={[needStyles.chipDate, { color: palette.chipDate }]}>
              {dayLabel.toUpperCase()}
            </Text>
            <View
              style={[
                needStyles.chipPeriodDot,
                { backgroundColor: palette.chipDate },
              ]}
            />
            <Text
              style={[needStyles.chipPeriodLabel, { color: palette.chipDate }]}
            >
              {startTime}
            </Text>
          </View>

          <Text style={needStyles.chipEmoji}>{theme.emoji}</Text>

          <Text
            style={[needStyles.chipName, { color: palette.chipName }]}
            numberOfLines={2}
          >
            {shift.shiftType.name}
          </Text>
        </View>

        {/* Bottom: location + Needs N pill — anchored at chip bottom so pills
            line up vertically across all chips regardless of name length. */}
        <View style={needStyles.chipBottom}>
          <View style={needStyles.chipLocationRow}>
            <Ionicons
              name="location-outline"
              size={11}
              color={palette.chipLocation}
            />
            <Text
              style={[needStyles.chipLocation, { color: palette.chipLocation }]}
              numberOfLines={1}
            >
              {shift.location}
            </Text>
          </View>

          <View
            style={[
              needStyles.chipNeedsPill,
              { backgroundColor: palette.chipNeedsBg },
            ]}
          >
            <Text
              style={[
                needStyles.chipNeedsText,
                { color: palette.chipNeedsText },
              ]}
            >
              Needs {shift.open} more
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const needStyles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    paddingTop: 24,
    paddingBottom: 18,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  glow: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  handsEmoji: {
    fontSize: 22,
  },
  displayRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 22,
    marginTop: 12,
  },
  displayNumber: {
    fontSize: 56,
    lineHeight: 58,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -1,
  },
  displayUnit: {
    fontSize: 22,
    lineHeight: 32,
    fontFamily: FontFamily.heading,
    marginBottom: 4,
  },
  supportLine: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily.medium,
    paddingHorizontal: 22,
    marginTop: 6,
  },
  chipsScroll: {
    marginTop: 18,
  },
  chipsRow: {
    paddingHorizontal: 22,
    gap: 10,
    paddingRight: 22,
  },
  chip: {
    width: 172,
    height: 170,
    borderRadius: 20,
    overflow: "hidden",
    flexDirection: "row",
  },
  chipInner: {
    flex: 1,
    padding: 14,
    justifyContent: "space-between",
  },
  chipTop: {
    gap: 8,
  },
  chipDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipDate: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    letterSpacing: 1.2,
  },
  chipPeriodDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.7,
  },
  chipPeriodLabel: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1.2,
    opacity: 0.75,
  },
  chipEmoji: {
    fontSize: 28,
    lineHeight: 32,
  },
  chipName: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: FontFamily.semiBold,
    minHeight: 34, // reserve 2 lines so bottom rows line up across chips
  },
  chipBottom: {
    gap: 8,
  },
  chipLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chipLocation: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    flexShrink: 1,
  },
  chipNeedsPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipNeedsText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.1,
  },
  ctaRow: {
    marginTop: 18,
    marginHorizontal: 22,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ctaText: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.1,
  },
  ctaArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  // Collapsible variant — shown when the user already has a confirmed shift
  // this week. Slim header is always visible; tapping expands the chips + CTA.
  collapsibleCard: {
    marginHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  collapsibleHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  compactEmoji: {
    fontSize: 22,
  },
  compactTextBlock: {
    flex: 1,
    gap: 1,
  },
  compactEyebrow: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  compactBody: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FontFamily.semiBold,
  },
  collapsibleChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  collapsibleBody: {
    paddingBottom: 14,
  },
  collapsibleDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  collapsibleCta: {
    marginTop: 14,
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  (meals: number, volunteers: number) =>
    `${meals} meals served by ${volunteers} volunteers 💚`,
  (meals: number, volunteers: number) =>
    `${meals} people fed — ${volunteers} of the whānau showed up with aroha 🌿`,
  (meals: number, volunteers: number) =>
    `Another beautiful night — ${volunteers} volunteers, ${meals} meals out the door ✨`,
  (meals: number, volunteers: number) =>
    `${meals} plates, ${volunteers} volunteers, one big whānau 🍽️`,
  (meals: number, volunteers: number) =>
    `${volunteers} volunteers, ${meals} full bellies — ngā mihi nui 🙌`,
  (meals: number, volunteers: number) =>
    `The whānau showed up! ${volunteers} volunteers served ${meals} meals 💪`,
  (meals: number, volunteers: number) =>
    `Ka pai! ${volunteers} volunteers, ${meals} people served with community love 🌱`,
  (meals: number, volunteers: number) =>
    `${meals} meals, ${volunteers} volunteers, endless aroha — that's Everybody Eats 💚`,
];

function getRecapMessage(
  meals: number,
  volunteers: number,
  id: string
): string {
  // Use id as a stable seed so the same recap always shows the same message
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % RECAP_TEMPLATES.length;
  return RECAP_TEMPLATES[index](meals, volunteers);
}

const SKELETON_ROWS: Array<{ title: number; body: number[] }> = [
  { title: 55, body: [92, 68] },
  { title: 45, body: [88] },
  { title: 60, body: [94, 74, 40] },
];

function FeedSkeleton({ colors }: { colors: (typeof Colors)["light"] }) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View style={styles.feedList} accessibilityLabel="Loading activity feed">
      {SKELETON_ROWS.map((row, i) => (
        <View
          key={i}
          style={[
            styles.feedCard,
            i < SKELETON_ROWS.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.feedIcon,
              { backgroundColor: colors.border, opacity: pulse },
            ]}
          />
          <View style={[styles.feedBody, { gap: 8, paddingTop: 4 }]}>
            <Animated.View
              style={[
                styles.skeletonBar,
                {
                  width: `${row.title}%`,
                  height: 13,
                  backgroundColor: colors.border,
                  opacity: pulse,
                },
              ]}
            />
            {row.body.map((w, j) => (
              <Animated.View
                key={j}
                style={[
                  styles.skeletonBar,
                  {
                    width: `${w}%`,
                    height: 11,
                    backgroundColor: colors.border,
                    opacity: pulse,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
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
  // Only human-authored posts are reportable. System-generated items
  // (achievement, milestone, friend_signup, shift_recap, new_shift,
  // daily_menu) have no author-written content to moderate — but comments
  // on them are still reportable via the sheet.
  const canReport = item.type === "photo_post" || item.type === "announcement";
  const timeAgo = formatDistanceToNow(new Date(item.timestamp), {
    addSuffix: true,
  });
  const markdownStyle = {
    body: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: FontFamily.regular,
    },
    strong: { color: colors.text },
    link: { color: colors.primary },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
  };
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
      {likeCount > 0 && (
        <LikeButton
          liked={liked}
          onPress={onToggleLike}
          color={colors.textSecondary}
          count={likeCount}
        />
      )}
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
            <Markdown style={markdownStyle}>{item.body}</Markdown>
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
            <Markdown style={markdownStyle}>{item.description}</Markdown>
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
            <Markdown style={markdownStyle}>{item.caption}</Markdown>
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
                  accessibilityLabel={`View ${
                    item.photos.length - 3
                  } more photos`}
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
              {getRecapMessage(item.mealsServed, item.volunteerCount, item.id)}
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

    if (item.type === "new_shift") {
      const titleText =
        item.count === 1
          ? `New shift at ${item.location}`
          : `${item.count} new shifts at ${item.location}`;
      const earliest = new Date(item.earliestStart);
      const latest = new Date(item.latestStart);
      const sameDay =
        formatNZT(earliest, "yyyy-MM-dd") === formatNZT(latest, "yyyy-MM-dd");
      const dateText = sameDay
        ? formatNZT(earliest, "EEEE d MMM")
        : `${formatNZT(earliest, "d MMM")} – ${formatNZT(latest, "d MMM")}`;
      return (
        <>
          <View style={[styles.feedIcon, { backgroundColor: "#ffedd5" }]}>
            <Text style={styles.feedIconEmoji}>📅</Text>
          </View>
          <View style={styles.feedBody}>
            <Text style={[styles.feedTitle, { color: colors.text }]}>
              {titleText}
            </Text>
            <Text
              style={[styles.feedDescription, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {dateText} · {item.shiftTypes.join(", ")}
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

    if (item.type === "daily_menu") {
      const serviceDate = new Date(item.serviceDate);
      const dateText = formatNZT(serviceDate, "EEEE d MMM");
      const previewNames = [
        ...(item.mains ?? []),
        ...(item.starter ?? []),
        ...(item.dessert ?? []),
        ...(item.drink ?? []),
      ]
        .map((m) => m?.name)
        .filter((n): n is string => typeof n === "string" && n.length > 0)
        .slice(0, 2);
      const mainsPreview = previewNames.join(" · ");
      return (
        <>
          <View style={[styles.feedIcon, { backgroundColor: "#fef3c7" }]}>
            <Text style={styles.feedIconEmoji}>🍲</Text>
          </View>
          <View style={styles.feedBody}>
            <Text style={[styles.feedTitle, { color: colors.text }]}>
              Menu for {dateText} · {item.location}
            </Text>
            {mainsPreview ? (
              <Text
                style={[
                  styles.feedDescription,
                  { color: colors.textSecondary },
                ]}
                numberOfLines={2}
              >
                {mainsPreview}
              </Text>
            ) : null}
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

  const hasAnnouncementImage = item.type === "announcement" && !!item.imageUrl;

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
      {canReport && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onReport();
          }}
          hitSlop={12}
          style={({ pressed }) => [
            styles.reportBtn,
            { opacity: pressed ? 0.5 : 1 },
          ]}
          accessibilityLabel={
            isReported
              ? "Already reported"
              : "Report or block — moderation options"
          }
          accessibilityRole="button"
        >
          <Ionicons
            name={isReported ? "flag" : "flag-outline"}
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
  new_shift: {
    emoji: "📅",
    label: "New Shifts",
    bg: "#ffedd5",
    bgDark: "rgba(251, 146, 60, 0.12)",
    accent: "#c2410c",
    accentDark: "#fdba74",
    accentSoft: "#fff7ed",
    accentSoftDark: "rgba(251, 146, 60, 0.10)",
  },
  daily_menu: {
    emoji: "🍲",
    label: "Tonight's Menu",
    bg: "#fef3c7",
    bgDark: "rgba(245, 158, 11, 0.12)",
    accent: "#b45309",
    accentDark: "#fcd34d",
    accentSoft: "#fffbeb",
    accentSoftDark: "rgba(245, 158, 11, 0.10)",
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
  onEditComment,
  onDeleteComment,
  hasReportedItem,
  hasBlockedUser,
  onReport,
  onConfirmBlock,
  currentUserId,
  onModeratePost,
  onOpenUserProfile,
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
  onEditComment: (commentId: string, text: string) => void;
  onDeleteComment: (commentId: string) => void;
  hasReportedItem: (id: string) => boolean;
  hasBlockedUser: (userId: string) => boolean;
  onReport: (type: string, id: string, reason: string) => void;
  onConfirmBlock: (userId: string, name: string) => void;
  currentUserId: string;
  onModeratePost?: () => void;
  onOpenUserProfile: (userId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [commentText, setCommentText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const beginEdit = useCallback((comment: FeedComment) => {
    Haptics.selectionAsync();
    setEditingId(comment.id);
    setEditDraft(comment.text);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft("");
  }, []);

  const saveEdit = useCallback(
    (comment: FeedComment) => {
      const trimmed = editDraft.trim();
      if (!trimmed || trimmed === comment.text) {
        cancelEdit();
        return;
      }
      onEditComment(comment.id, trimmed);
      cancelEdit();
    },
    [editDraft, onEditComment, cancelEdit]
  );

  const buildCommentMenuActions = useCallback(
    (comment: FeedComment): MenuAction[] => {
      const isOwn = comment.userId === currentUserId;
      if (isOwn) {
        return [
          { id: "edit", title: "Edit", image: "pencil" },
          {
            id: "delete",
            title: "Delete",
            image: "trash",
            attributes: { destructive: true },
          },
        ];
      }
      const alreadyReported = hasReportedItem(comment.id);
      const alreadyBlocked = hasBlockedUser(comment.userId);
      const actions: MenuAction[] = [];
      if (alreadyReported) {
        actions.push({
          id: "reported",
          title: "Reported — pending review",
          attributes: { disabled: true },
        });
      } else {
        actions.push({
          id: "report",
          title: "Report",
          image: "flag",
          subactions: [
            {
              id: "report:offensive",
              title: "Offensive or abusive",
            },
            { id: "report:harassment", title: "Harassment" },
            { id: "report:spam", title: "Spam" },
          ],
        });
      }
      if (alreadyBlocked) {
        actions.push({
          id: "blocked",
          title: `${comment.userName} is blocked`,
          attributes: { disabled: true },
        });
      } else {
        actions.push({
          id: "block",
          title: `Block ${comment.userName}`,
          image: "person.crop.circle.badge.xmark",
          attributes: { destructive: true },
        });
      }
      return actions;
    },
    [currentUserId, hasReportedItem, hasBlockedUser]
  );

  const handleCommentMenuAction = useCallback(
    (comment: FeedComment, eventId: string) => {
      Haptics.selectionAsync();
      switch (eventId) {
        case "edit":
          beginEdit(comment);
          return;
        case "delete":
          onDeleteComment(comment.id);
          return;
        case "report:offensive":
          onReport("comment", comment.id, "Offensive or abusive content");
          return;
        case "report:harassment":
          onReport("comment", comment.id, "Harassment");
          return;
        case "report:spam":
          onReport("comment", comment.id, "Spam");
          return;
        case "block":
          onConfirmBlock(comment.userId, comment.userName);
          return;
      }
    },
    [beginEdit, onDeleteComment, onReport, onConfirmBlock]
  );
  const [sheetViewer, setSheetViewer] = useState<{
    images: string[];
    index: number;
  } | null>(null);
  const openSheetViewer = useCallback((images: string[], index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheetViewer({ images, index });
  }, []);
  const closeSheetViewer = useCallback(() => {
    setSheetViewer(null);
  }, []);
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
  const heroEmoji =
    item.type === "achievement" && item.achievementIcon
      ? item.achievementIcon
      : config.emoji;
  const isPastDailyMenu =
    item.type === "daily_menu" &&
    formatNZT(new Date(item.serviceDate), "yyyy-MM-dd") <
      formatNZT(new Date(), "yyyy-MM-dd");
  const headerLabel = isPastDailyMenu ? "Past Menu" : config.label;

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
    body = getRecapMessage(item.mealsServed, item.volunteerCount, item.id);
  } else if (item.type === "new_shift") {
    title =
      item.count === 1
        ? `New shift at ${item.location}`
        : `${item.count} new shifts at ${item.location}`;
    const earliest = new Date(item.earliestStart);
    const latest = new Date(item.latestStart);
    const sameDay =
      formatNZT(earliest, "yyyy-MM-dd") === formatNZT(latest, "yyyy-MM-dd");
    const dateText = sameDay
      ? formatNZT(earliest, "EEEE d MMM")
      : `${formatNZT(earliest, "d MMM")} – ${formatNZT(latest, "d MMM")}`;
    body = `${dateText} · ${item.shiftTypes.join(", ")}`;
  } else if (item.type === "daily_menu") {
    const serviceDate = new Date(item.serviceDate);
    title = `Menu for ${formatNZT(serviceDate, "EEEE d MMM")} at ${
      item.location
    }`;
    const sections: string[] = [];
    if (item.chefName) sections.push(`👨‍🍳 **${item.chefName}**`);
    if (item.announcement) sections.push(item.announcement);
    const courseBlock = (
      heading: string,
      items: typeof item.mains | undefined
    ) => {
      if (!items || items.length === 0) return null;
      const valid = items.filter(
        (m): m is NonNullable<typeof m> => Boolean(m?.name)
      );
      if (valid.length === 0) return null;
      const isSingle = valid.length === 1;
      const lines = valid.map((m) => {
        const prefix = isSingle ? "" : "- ";
        return m.description
          ? `${prefix}**${m.name}** — ${m.description}`
          : `${prefix}${m.name}`;
      });
      return `**${heading}**\n${lines.join("\n")}`;
    };
    const courses = [
      courseBlock("🥗 Starter", item.starter),
      courseBlock("🍽️ Mains", item.mains),
      courseBlock("🍷 Drinks", item.drink),
      courseBlock("🍰 Dessert", item.dessert),
    ].filter((s): s is string => s !== null);
    sections.push(...courses);
    body = sections.join("\n\n");
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
                    <Text style={sheet.heroAvatarBadgeEmoji}>{heroEmoji}</Text>
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
                  <Text style={sheet.heroEmoji}>{heroEmoji}</Text>
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
                  {headerLabel}
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

              {/* Body text — use Markdown renderer for announcements and menus */}
              {item.type === "announcement" || item.type === "daily_menu" ? (
                <Markdown
                  style={{
                    body: {
                      color: colors.textSecondary,
                      fontSize: 14,
                      lineHeight: 20,
                      fontFamily: FontFamily.regular,
                    },
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

            {/* ── New shift preview list ── */}
            {item.type === "new_shift" &&
              item.preview &&
              item.preview.length > 0 && (
                <View
                  style={[
                    sheet.shiftListCard,
                    {
                      backgroundColor: colors.card,
                      shadowColor: isDark ? "#000" : "#64748b",
                    },
                  ]}
                >
                  <Text
                    style={[
                      sheet.shiftListHeader,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {item.count <= item.preview.length
                      ? `Shift${item.count === 1 ? "" : "s"} available`
                      : `Soonest ${item.preview.length} of ${item.count}`}
                  </Text>
                  {item.preview.map((s, idx) => {
                    const start = new Date(s.start);
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          onClose();
                          router.push(`/shift/${s.id}` as Href);
                        }}
                        style={({ pressed }) => [
                          sheet.shiftListRow,
                          {
                            borderTopWidth:
                              idx === 0 ? 0 : StyleSheet.hairlineWidth,
                            borderTopColor: colors.border,
                            opacity: pressed ? 0.6 : 1,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${s.shiftTypeName} on ${formatNZT(
                          start,
                          "EEEE d MMMM"
                        )}`}
                      >
                        <View
                          style={[
                            sheet.shiftListDate,
                            {
                              backgroundColor: isDark
                                ? "rgba(134, 239, 172, 0.10)"
                                : Brand.greenLight,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              sheet.shiftListDay,
                              { color: isDark ? "#86efac" : Brand.green },
                            ]}
                          >
                            {formatNZT(start, "EEE").toUpperCase()}
                          </Text>
                          <Text
                            style={[
                              sheet.shiftListDayNum,
                              { color: isDark ? "#86efac" : Brand.green },
                            ]}
                          >
                            {formatNZT(start, "d")}
                          </Text>
                        </View>
                        <View style={sheet.shiftListBody}>
                          <Text
                            style={[
                              sheet.shiftListTitle,
                              { color: colors.text },
                            ]}
                            numberOfLines={1}
                          >
                            {s.shiftTypeName}
                          </Text>
                          <Text
                            style={[
                              sheet.shiftListMeta,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {formatNZT(start, "MMM · h:mm a")}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      onClose();
                      router.push("/(tabs)/shifts?tab=browse");
                    }}
                    style={({ pressed }) => [
                      sheet.shiftListCTA,
                      {
                        backgroundColor: isDark
                          ? "rgba(134, 239, 172, 0.12)"
                          : Brand.greenLight,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Browse all shifts"
                  >
                    <Text
                      style={[
                        sheet.shiftListCTAText,
                        { color: isDark ? "#86efac" : Brand.green },
                      ]}
                    >
                      {item.count > item.preview.length
                        ? `Browse all ${item.count} shifts`
                        : "Browse shifts"}
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={16}
                      color={isDark ? "#86efac" : Brand.green}
                    />
                  </Pressable>
                </View>
              )}

            {/* ── Daily menu CTA: browse shifts on that service day (only if today or upcoming) ── */}
            {item.type === "daily_menu" &&
              formatNZT(new Date(item.serviceDate), "yyyy-MM-dd") >=
                formatNZT(new Date(), "yyyy-MM-dd") && (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  onClose();
                  const dateKey = formatNZT(
                    new Date(item.serviceDate),
                    "yyyy-MM-dd"
                  );
                  router.push(
                    `/(tabs)/shifts?date=${dateKey}` as Href
                  );
                }}
                style={({ pressed }) => [
                  sheet.shiftListCTA,
                  {
                    backgroundColor: Brand.green,
                    opacity: pressed ? 0.85 : 1,
                    marginHorizontal: 16,
                    marginBottom: 12,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="See shifts available on this day"
              >
                <Text style={[sheet.shiftListCTAText, { color: "#ffffff" }]}>
                  See shifts for this day
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#ffffff" />
              </Pressable>
            )}

            {/* ── Friend signup CTA: jump to that shift (only if upcoming) ── */}
            {item.type === "friend_signup" &&
              item.shiftId &&
              new Date(item.shiftDate).getTime() > Date.now() && (
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  onClose();
                  router.push(`/shift/${item.shiftId}` as Href);
                }}
                style={({ pressed }) => [
                  sheet.shiftListCTA,
                  {
                    backgroundColor: Brand.green,
                    opacity: pressed ? 0.85 : 1,
                    marginHorizontal: 16,
                    marginBottom: 12,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Sign up for the ${item.shiftTypeName} shift`}
              >
                <Text style={[sheet.shiftListCTAText, { color: "#ffffff" }]}>
                  Sign up for this shift
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#ffffff" />
              </Pressable>
            )}

            {/* ── Photo gallery (for photo_post type) ── */}
            {/* Announcement image */}
            {item.type === "announcement" && item.imageUrl && (
              <Pressable
                onPress={() => openSheetViewer([item.imageUrl!], 0)}
                accessibilityLabel="View announcement image"
                accessibilityRole="imagebutton"
              >
                <Image
                  source={{ uri: item.imageUrl }}
                  style={[
                    sheet.photoSingle,
                    { borderRadius: 12, marginBottom: 12 },
                  ]}
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
                    onPress={() => openSheetViewer(item.photos, 0)}
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
                        onPress={() => openSheetViewer(item.photos, i)}
                        accessibilityLabel="View photo"
                        accessibilityRole="imagebutton"
                      >
                        <Image source={{ uri }} style={sheet.photoScrollItem} />
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
                    const openAuthor = () => {
                      Haptics.selectionAsync();
                      onOpenUserProfile(comment.userId);
                    };
                    const isOwn = comment.userId === currentUserId;
                    const isEditing = editingId === comment.id;
                    const editDisabled =
                      !editDraft.trim() || editDraft.trim() === comment.text;
                    return (
                      <View key={comment.id} style={sheet.commentRow}>
                        <Pressable
                          onPress={openAuthor}
                          hitSlop={6}
                          accessibilityLabel={`View ${comment.userName}'s profile`}
                          accessibilityRole="button"
                          style={({ pressed }) => ({
                            opacity: pressed ? 0.7 : 1,
                          })}
                        >
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
                        </Pressable>
                        <View style={sheet.commentContent}>
                          <View style={sheet.commentHeader}>
                            <Pressable
                              onPress={openAuthor}
                              hitSlop={6}
                              accessibilityLabel={`View ${comment.userName}'s profile`}
                              accessibilityRole="button"
                              style={({ pressed }) => ({
                                opacity: pressed ? 0.7 : 1,
                                flexShrink: 1,
                              })}
                            >
                              <Text
                                style={[
                                  sheet.commentUserName,
                                  { color: colors.text },
                                ]}
                                numberOfLines={1}
                              >
                                {comment.userName}
                              </Text>
                            </Pressable>
                            <Text
                              style={[
                                sheet.commentTime,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {` · ${commentTimeAgo}`}
                            </Text>
                          </View>
                          {isEditing ? (
                            <View style={sheet.commentEditBlock}>
                              <TextInput
                                value={editDraft}
                                onChangeText={setEditDraft}
                                autoFocus
                                multiline
                                maxLength={1000}
                                style={[
                                  sheet.commentEditInput,
                                  {
                                    color: colors.text,
                                    backgroundColor: isDark
                                      ? "rgba(255,255,255,0.05)"
                                      : "#f8fafc",
                                    borderColor: isDark
                                      ? "rgba(255,255,255,0.1)"
                                      : "#e2e8f0",
                                  },
                                ]}
                                accessibilityLabel="Edit comment"
                              />
                              <View style={sheet.commentEditActions}>
                                <Pressable
                                  onPress={cancelEdit}
                                  hitSlop={8}
                                  style={({ pressed }) => [
                                    sheet.commentEditBtn,
                                    { opacity: pressed ? 0.6 : 1 },
                                  ]}
                                  accessibilityLabel="Cancel edit"
                                  accessibilityRole="button"
                                >
                                  <Text
                                    style={[
                                      sheet.commentEditBtnText,
                                      { color: colors.textSecondary },
                                    ]}
                                  >
                                    Cancel
                                  </Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => saveEdit(comment)}
                                  disabled={editDisabled}
                                  hitSlop={8}
                                  style={({ pressed }) => [
                                    sheet.commentEditBtn,
                                    sheet.commentEditSaveBtn,
                                    {
                                      backgroundColor: editDisabled
                                        ? isDark
                                          ? "rgba(255,255,255,0.05)"
                                          : "#e2e8f0"
                                        : Brand.green,
                                      opacity:
                                        pressed && !editDisabled ? 0.75 : 1,
                                    },
                                  ]}
                                  accessibilityLabel="Save edit"
                                  accessibilityRole="button"
                                >
                                  <Text
                                    style={[
                                      sheet.commentEditBtnText,
                                      {
                                        color: editDisabled
                                          ? colors.textSecondary
                                          : "#ffffff",
                                      },
                                    ]}
                                  >
                                    Save
                                  </Text>
                                </Pressable>
                              </View>
                            </View>
                          ) : (
                            <Text
                              style={[
                                sheet.commentText,
                                { color: colors.text },
                              ]}
                            >
                              {comment.text}
                            </Text>
                          )}
                        </View>
                        {!isEditing && (
                          <MenuView
                            onPressAction={({ nativeEvent }) =>
                              handleCommentMenuAction(
                                comment,
                                nativeEvent.event
                              )
                            }
                            actions={buildCommentMenuActions(comment)}
                            shouldOpenOnLongPress={false}
                            themeVariant={isDark ? "dark" : "light"}
                            style={sheet.commentMoreBtn}
                          >
                            <View
                              style={sheet.commentMoreBtnInner}
                              accessibilityLabel={
                                isOwn
                                  ? "Edit or delete comment"
                                  : `Report or block ${comment.userName}`
                              }
                              accessibilityRole="button"
                            >
                              <Ionicons
                                name="ellipsis-horizontal"
                                size={16}
                                color={colors.textSecondary}
                              />
                            </View>
                          </MenuView>
                        )}
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

            {/* Moderation strip — visible Report/Block call-to-action */}
            {onModeratePost && (
              <View
                style={[
                  sheet.moderateCard,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "#fafafa",
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text
                  style={[sheet.moderateText, { color: colors.textSecondary }]}
                >
                  See something that doesn&apos;t belong? Report or block to
                  keep our whānau safe.
                </Text>
                <Pressable
                  onPress={onModeratePost}
                  hitSlop={8}
                  style={({ pressed }) => [
                    sheet.moderateActionBtn,
                    {
                      backgroundColor: isDark
                        ? "rgba(220,38,38,0.12)"
                        : "#fff1f2",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  accessibilityLabel="Report or block this post"
                  accessibilityRole="button"
                >
                  <Ionicons name="flag-outline" size={13} color="#dc2626" />
                  <Text
                    style={[sheet.moderateActionBtnText, { color: "#dc2626" }]}
                  >
                    Report / Block
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <ImageViewer
        visible={sheetViewer !== null}
        images={sheetViewer?.images ?? []}
        initialIndex={sheetViewer?.index ?? 0}
        onClose={closeSheetViewer}
      />
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  greeting: {
    fontSize: 15,
    marginBottom: 2,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  bellDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
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
  skeletonBar: {
    borderRadius: 4,
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
    top: 14,
    right: 0,
    zIndex: 10,
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

  // New-shift preview list (inside sheet)
  shiftListCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  shiftListHeader: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  shiftListRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
  },
  shiftListDate: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
  },
  shiftListDay: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.8,
    lineHeight: 12,
  },
  shiftListDayNum: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    lineHeight: 22,
  },
  shiftListBody: {
    flex: 1,
    gap: 2,
  },
  shiftListTitle: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
  shiftListMeta: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },
  shiftListCTA: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
  },
  shiftListCTAText: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
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
    alignItems: "baseline",
    flexWrap: "wrap",
  },
  commentUserName: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
    flexShrink: 1,
  },
  commentTime: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    flexShrink: 0,
  },
  commentText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 20,
  },
  commentMoreBtn: {
    marginTop: -2,
    marginRight: -6,
  },
  commentMoreBtnInner: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  commentEditBlock: {
    marginTop: 4,
    gap: 8,
  },
  commentEditInput: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 20,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  commentEditActions: {
    flexDirection: "row",
    alignSelf: "flex-end",
    gap: 8,
  },
  commentEditBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  commentEditSaveBtn: {
    minWidth: 64,
  },
  commentEditBtnText: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },
  moderateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  moderateText: {
    flex: 1,
    fontSize: 12,
    fontFamily: FontFamily.regular,
    lineHeight: 16,
  },
  moderateActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  moderateActionBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
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
