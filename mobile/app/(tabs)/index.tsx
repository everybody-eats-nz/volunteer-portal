import { Ionicons } from "@expo/vector-icons";
import { addDays, startOfDay } from "date-fns";
import * as Haptics from "expo-haptics";
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FeedCard } from "@/components/home/feed-card";
import { FeedItemSheet } from "@/components/home/feed-item-sheet";
import { FeedSkeleton } from "@/components/home/feed-skeleton";
import {
  NextShiftHero,
  getShiftPeriodKey,
} from "@/components/home/next-shift-hero";
import { VolunteersNeededCard } from "@/components/home/volunteers-needed-card";
import { ImageViewer } from "@/components/image-viewer";
import { SurveyCard } from "@/components/survey-card";
import { YearInReviewCard } from "@/components/year-in-review-card";
import { ThemedText } from "@/components/themed-text";
import { StatusBarScrim } from "@/components/ui/status-bar-scrim";
import { Brand, Colors, FontFamily, Palette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useFeed } from "@/hooks/use-feed";
import {
  useFeedComments,
  useFeedInteractions,
} from "@/hooks/use-feed-interactions";
import { useNotifications } from "@/hooks/use-notifications";
import { usePendingFeedItemStore } from "@/hooks/use-pending-feed-item";
import { useProfile } from "@/hooks/use-profile";
import { useHomeShifts, type PeriodFriend } from "@/hooks/use-shifts";
import { usePendingSurveys } from "@/hooks/use-surveys";
import { useYearInReview } from "@/hooks/use-year-in-review";
import type { FeedItem, LikeUser } from "@/lib/dummy-data";
import { posthog } from "@/lib/posthog";

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  // Home-scoped, not the full shifts payload — see useHomeShifts.
  const {
    myShifts,
    available,
    periodFriends,
    userDefaultLocation,
    isLoading: shiftsLoading,
    refresh: refreshShifts,
  } = useHomeShifts();
  const {
    items: feedItems,
    isLoading: feedLoading,
    refresh: refreshFeed,
    refetchItems: refetchFeedItems,
    updateItem: updateFeedItem,
    removeItemsByUser,
  } = useFeed();
  const { unreadCount: unreadNotifications, refresh: refreshNotifications } =
    useNotifications();
  const {
    surveys: pendingSurveys,
    refresh: refreshSurveys,
    dismiss: dismissSurvey,
  } = usePendingSurveys();
  const yearInReview = useYearInReview();

  const {
    toggleLike: apiToggleLike,
    addComment: apiAddComment,
    editComment: apiEditComment,
    deleteComment: apiDeleteComment,
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

  /* Rolling 7-day window from today — keeps the card relevant regardless of
     where we are in the week, so volunteers always see the next stretch of
     needs rather than losing visibility late in the week. */
  const windowStart = startOfDay(new Date());
  const windowEnd = addDays(windowStart, 7);
  /* Scope the "volunteers needed" card to the user's home restaurant when they
     have one set — shifts elsewhere aren't actionable for most volunteers.
     Falls back to every location when no default is configured. */
  const upcomingAvailable = available.filter((s) => {
    const start = new Date(s.start);
    if (start < windowStart || start >= windowEnd) return false;
    if (userDefaultLocation && s.location !== userDefaultLocation) return false;
    return true;
  });

  const [likesSheetItemId, setLikesSheetItemId] = useState<string | null>(null);
  const likesSheetItem = likesSheetItemId
    ? feedItems.find((i) => i.id === likesSheetItemId) ?? null
    : null;
  // Subscribe to the open item's comments. The query is gated on
  // likesSheetItemId so it only fires when the sheet is open, but the cache
  // sticks around — re-opening the same sheet shows comments instantly.
  const sheetComments = useFeedComments(likesSheetItemId);
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

  const getLikersForItem = useCallback(
    (item: FeedItem): LikeUser[] => {
      const myId = profile?.id;
      const others = myId
        ? item.recentLikers.filter((l) => l.id !== myId)
        : item.recentLikers;
      if (!item.likedByMe) return others;
      const meAsLiker: LikeUser = {
        id: myId ?? "",
        name: "You",
        profilePhotoUrl: profile?.image ?? undefined,
      };
      return [meAsLiker, ...others];
    },
    [profile?.id, profile?.image]
  );

  const handleOpenSheet = useCallback((item: FeedItem) => {
    setLikesSheetItemId(item.id);
  }, []);

  // Notification deep link: when a tap stashes a feed item id (e.g. an
  // announcement push), open that item's sheet once the feed has loaded.
  // The id is claimed (cleared) straight away so a later feed refresh can't
  // re-open it. An announcement is usually tapped minutes after it was
  // published, when the cached feed predates it, so a miss refetches the
  // feed before giving up. `latestPendingRef` stops a slow refetch from
  // opening an older item over one tapped after it.
  const pendingFeedItemId = usePendingFeedItemStore((s) => s.pendingId);
  const clearPendingFeedItem = usePendingFeedItemStore((s) => s.clear);
  const latestPendingRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFeedItemId || feedLoading) return;
    const id = pendingFeedItemId;
    latestPendingRef.current = id;
    clearPendingFeedItem();

    const cached = feedItems.find((i) => i.id === id);
    if (cached) {
      handleOpenSheet(cached);
      return;
    }
    refetchFeedItems().then(
      (items) => {
        if (latestPendingRef.current !== id) return;
        const fresh = items.find((i) => i.id === id);
        if (fresh) {
          handleOpenSheet(fresh);
          return;
        }
        // Gone from the feed: expired, deleted, or older than its window.
        Alert.alert(
          "No longer available",
          "This post has been taken down or is no longer in your feed."
        );
      },
      // Offline or a server error: the feed shows its own error state, and
      // saying the post is gone would be wrong.
      () => {}
    );
  }, [
    pendingFeedItemId,
    feedLoading,
    feedItems,
    handleOpenSheet,
    clearPendingFeedItem,
    refetchFeedItems,
  ]);

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

  const nextSurvey = pendingSurveys[0] ?? null;

  const handleDismissSurvey = useCallback(
    async (assignmentId: string) => {
      Haptics.selectionAsync();
      posthog?.capture("survey_dismissed", { assignment_id: assignmentId });
      try {
        await dismissSurvey(assignmentId);
      } catch {
        // The card has already come back; say why.
        Alert.alert(
          "Couldn't do that",
          "We couldn't hide this survey just now. Please try again."
        );
      }
    },
    [dismissSurvey]
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
          text: "Already reported - pending review",
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
    <>
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
              refreshSurveys();
              yearInReview.refresh();
              // A newly assigned survey arrives with a notification, so the
              // bell is refreshed alongside the card it belongs to.
              refreshNotifications();
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
                      ? "rgba(253, 248, 239, 0.06)"
                      : "rgba(29, 83, 55, 0.06)",
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
              accessibilityRole="button"
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

        {/* ── Year in mahi ──
             Seasonal, so it sits right under the next shift while it's
             switched on, above the survey and everything people browse. */}
        {yearInReview.available && yearInReview.year !== null && (
          <View
            style={[styles.yearInReview, { marginTop: nextShift ? 20 : 0 }]}
          >
            <YearInReviewCard
              year={yearInReview.year}
              onWatch={() => {
                posthog?.capture("year_in_review_opened", { source: "home" });
                router.push("/year-in-review" as Href);
              }}
            />
          </View>
        )}

        {/* ── Survey ──
             Under the next shift, which is what people open the app for, and
             above everything they only browse. One at a time, newest first:
             the next takes its place once this one is answered or dismissed,
             so a volunteer who is due several is asked, not buried. */}
        {nextSurvey && (
          <View
            style={[
              styles.surveys,
              {
                marginTop: nextShift || yearInReview.available ? 20 : 0,
              },
            ]}
          >
            <SurveyCard
              key={nextSurvey.assignmentId}
              survey={nextSurvey}
              onTake={() =>
                router.push({
                  pathname: "/survey/[token]",
                  params: { token: nextSurvey.token },
                })
              }
              onDismiss={() => handleDismissSurvey(nextSurvey.assignmentId)}
            />
            {pendingSurveys.length > 1 && (
              <Text
                style={[styles.surveysMore, { color: colors.textSecondary }]}
              >
                {pendingSurveys.length === 2
                  ? "1 more survey after this one"
                  : `${pendingSurveys.length - 1} more surveys after this one`}
              </Text>
            )}
          </View>
        )}

        {/* ── Volunteers Needed ──
             Collapses to a slim reminder when the user already has a confirmed
             shift coming up - they've done their part; just surface the wider
             roster gap as an easy tap-in for picking up more. */}
        <VolunteersNeededCard
          shifts={upcomingAvailable}
          marginTop={
            nextShift || yearInReview.available || nextSurvey ? 20 : 0
          }
          collapsible={nextShift?.status === "CONFIRMED"}
          onShiftPress={(id) => router.push(`/shift/${id}` as Href)}
          onBrowseDay={(dateKey) =>
            router.push(`/(tabs)/shifts?date=${dateKey}` as Href)
          }
          onBrowseAll={() => router.push("/(tabs)/shifts" as Href)}
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
            comments={sheetComments.comments}
            isLoadingComments={sheetComments.isLoading}
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
      <StatusBarScrim />
    </>
  );
}

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
    color: Palette.cream50,
    fontSize: 20,
    fontFamily: FontFamily.bold,
  },
  // Survey
  yearInReview: {
    paddingHorizontal: 20,
  },
  surveys: {
    paddingHorizontal: 20,
    gap: 10,
  },
  surveysMore: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
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
});
