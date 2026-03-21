import { Ionicons } from "@expo/vector-icons";
import { differenceInHours, format, formatDistanceToNow } from "date-fns";
import * as Haptics from "expo-haptics";
import { useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
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
import { useProfile } from "@/hooks/use-profile";
import { useShifts } from "@/hooks/use-shifts";
import {
  FEED_ITEMS,
  type FeedItem,
  type LikeUser,
} from "@/lib/dummy-data";

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { myShifts, available, isLoading: shiftsLoading, refresh: refreshShifts } = useShifts();

  const nextShift = myShifts[0] ?? null;
  const hoursUntilShift = nextShift
    ? differenceInHours(new Date(nextShift.start), new Date())
    : null;

  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());
  const [likesSheetItem, setLikesSheetItem] = useState<FeedItem | null>(null);

  const toggleLike = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLikedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const ME_AS_LIKER: LikeUser = {
    id: profile?.id ?? '',
    name: 'You',
    profilePhotoUrl: profile?.image ?? undefined,
  };

  const getLikersForItem = useCallback((item: FeedItem, isLikedByMe: boolean): LikeUser[] => {
    const likers = [...item.likes];
    if (isLikedByMe) likers.unshift(ME_AS_LIKER);
    return likers;
  }, [ME_AS_LIKER]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={shiftsLoading}
          onRefresh={refreshShifts}
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
          <ThemedText type="title">{profile?.firstName ?? ''}</ThemedText>
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
            <Image
              source={{ uri: profile.image }}
              style={styles.avatarImage}
            />
          ) : (
            <View
              style={[styles.avatarFallback, { backgroundColor: Brand.green }]}
            >
              <Text style={styles.avatarText}>
                {(profile?.firstName ?? '').charAt(0)}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* ── Next Shift Hero ── */}
      {nextShift && (
        <Pressable
          onPress={() => router.push(`/shift/${nextShift.id}` as Href)}
          style={({ pressed }) => [
            styles.heroCard,
            { opacity: pressed ? 0.95 : 1 },
          ]}
          accessibilityLabel={`Next shift: ${nextShift.shiftType.name} at ${nextShift.location}`}
        >
          <View style={styles.heroGradient}>
            {/* Top row */}
            <View style={styles.heroTop}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>🍽️ Next mahi</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color="rgba(255,255,255,0.6)"
              />
            </View>

            {/* Shift type */}
            <Text style={styles.heroTitle}>{nextShift.shiftType.name}</Text>

            {/* Details */}
            <View style={styles.heroDetails}>
              <View style={styles.heroDetail}>
                <Text style={styles.heroEmoji}>📍</Text>
                <Text style={styles.heroDetailText}>{nextShift.location}</Text>
              </View>
              <View style={styles.heroDetail}>
                <Text style={styles.heroEmoji}>🕐</Text>
                <Text style={styles.heroDetailText}>
                  {format(new Date(nextShift.start), "EEEE d MMM, h:mm a")}
                </Text>
              </View>
            </View>

            {/* Countdown */}
            {hoursUntilShift !== null && hoursUntilShift > 0 && (
              <View style={styles.heroCountdown}>
                <Text style={styles.heroCountdownText}>
                  {hoursUntilShift < 24
                    ? `⏰ ${hoursUntilShift}h away — see you soon!`
                    : `📅 ${Math.floor(hoursUntilShift / 24)} days to go`}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      )}

      {/* ── Open Shifts CTA ── */}
      {available.length > 0 && (
        <Pressable
          onPress={() => router.push("/(tabs)/shifts")}
          style={({ pressed }) => [
            styles.openShiftsBanner,
            {
              backgroundColor: Brand.accent,
              opacity: pressed ? 0.9 : 1,
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
                {available.length} shifts are looking for whānau
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
          {FEED_ITEMS.map((item, index) => (
            <FeedCard
              key={item.id}
              item={item}
              colors={colors}
              isLast={index === FEED_ITEMS.length - 1}
              liked={likedItems.has(item.id)}
              onToggleLike={() => toggleLike(item.id)}
              onShowSheet={() => setLikesSheetItem(item)}
              myPhoto={profile?.image ?? undefined}
            />
          ))}
        </View>
      </View>

      {/* ── Likes Sheet ── */}
      {likesSheetItem && (
        <FeedItemSheet
          item={likesSheetItem}
          likers={getLikersForItem(likesSheetItem, likedItems.has(likesSheetItem.id))}
          liked={likedItems.has(likesSheetItem.id)}
          onToggleLike={() => toggleLike(likesSheetItem.id)}
          onClose={() => setLikesSheetItem(null)}
          colors={colors}
          isDark={colorScheme === "dark"}
        />
      )}

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

/* ── Feed Card ── */

function LikeButton({
  liked,
  onPress,
  onShowLikes,
  color,
  likers,
  myPhoto,
}: {
  liked: boolean;
  onPress: () => void;
  onShowLikes: () => void;
  color: string;
  likers: LikeUser[];
  myPhoto?: string;
}) {
  // Build display list: if I liked, prepend me
  const displayLikers = liked
    ? [{ id: "me", name: "You", profilePhotoUrl: myPhoto }, ...likers]
    : likers;
  const shown = displayLikers.slice(0, 3);

  return (
    <View style={styles.likeRow}>
      {shown.length > 0 && (
        <Pressable
          onPress={onShowLikes}
          hitSlop={4}
          style={({ pressed }) => [
            styles.avatarStack,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityLabel={`Liked by ${displayLikers.length} people, tap to see who`}
        >
          {shown.map((liker, i) => {
            const initial = liker.name.charAt(0).toUpperCase();
            return (
              <View
                key={liker.id}
                style={[
                  styles.avatarStackItem,
                  { zIndex: shown.length - i, marginLeft: i === 0 ? 0 : -8 },
                ]}
              >
                {liker.profilePhotoUrl ? (
                  <Image
                    source={{ uri: liker.profilePhotoUrl }}
                    style={styles.avatarStackImage}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatarStackFallback,
                      { backgroundColor: Brand.greenLight },
                    ]}
                  >
                    <Text style={[styles.avatarStackInitial, { color: Brand.green }]}>
                      {initial}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </Pressable>
      )}
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
          size={18}
          color={liked ? "#e11d48" : color}
        />
      </Pressable>
    </View>
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
        <View style={[styles.feedAvatarFallback, { backgroundColor: Brand.greenLight }]}>
          <Text style={styles.feedAvatarInitial}>{initial}</Text>
        </View>
      )}
      <View style={[styles.feedAvatarBadge, { backgroundColor: badgeBg }]}>
        <Text style={styles.feedAvatarBadgeEmoji}>{emoji}</Text>
      </View>
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
  myPhoto,
}: {
  item: FeedItem;
  colors: (typeof Colors)["light"];
  isLast: boolean;
  liked: boolean;
  onToggleLike: () => void;
  onShowSheet: () => void;
  myPhoto?: string;
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

  const likeButton = (
    <LikeButton
      liked={liked}
      onPress={onToggleLike}
      onShowLikes={onShowSheet}
      color={colors.textSecondary}
      likers={item.likes}
      myPhoto={myPhoto}
    />
  );

  const renderContent = () => {
    if (item.type === "announcement") {
      return (
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
              <View style={[styles.feedMeta, { flexDirection: "column", alignItems: "flex-start", gap: 2 }]}>
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
              {likeButton}
            </View>
          </View>
        </>
      );
    }

    if (item.type === "new_shift") {
      const spotsLeft = item.shift.capacity - item.shift.signedUp;
      return (
        <>
          <View style={[styles.feedIcon, { backgroundColor: Brand.greenLight }]}>
            <Text style={styles.feedIconEmoji}>🆕</Text>
          </View>
          <View style={styles.feedBody}>
            <Text style={[styles.feedTitle, { color: colors.text }]}>
              New shift available
            </Text>
            <Text
              style={[styles.feedDescription, { color: colors.textSecondary }]}
            >
              {item.shift.shiftType.name} at {item.shift.location} — {spotsLeft}{" "}
              spot{spotsLeft !== 1 ? "s" : ""} left
            </Text>
            <View style={styles.feedFooter}>
              <View style={styles.feedMeta}>
                <Text
                  style={[styles.feedMetaText, { color: colors.textSecondary }]}
                >
                  {format(new Date(item.shift.start), "EEE d MMM, h:mm a")}
                </Text>
                <Text style={[styles.feedDot, { color: colors.textSecondary }]}>
                  ·
                </Text>
                <Text
                  style={[styles.feedMetaText, { color: colors.textSecondary }]}
                >
                  {timeAgo}
                </Text>
              </View>
              {likeButton}
            </View>
          </View>
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
              {likeButton}
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
              {likeButton}
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
              📍 {item.location} · {format(new Date(item.shiftDate), "d MMM")} {item.period}
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
                <Image
                  key={`${item.id}-thumb-${i}`}
                  source={{ uri }}
                  style={styles.feedPhotoThumb}
                />
              ))}
              {item.photos.length > 3 && (
                <View
                  style={[
                    styles.feedPhotoThumb,
                    styles.feedPhotoMore,
                    {
                      backgroundColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.feedPhotoMoreText, { color: colors.textSecondary }]}>
                    +{item.photos.length - 3}
                  </Text>
                </View>
              )}
            </ScrollView>
            <View style={styles.feedFooter}>
              <Text
                style={[styles.feedMetaText, { color: colors.textSecondary }]}
              >
                {timeAgo}
              </Text>
              {likeButton}
            </View>
          </View>
        </>
      );
    }

    return null;
  };

  return (
    <Pressable
      onPress={onShowSheet}
      style={({ pressed }) => [
        styles.feedCard,
        borderStyle,
        { opacity: pressed ? 0.7 : 1 },
      ]}
      accessibilityRole="button"
    >
      {renderContent()}
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
  new_shift: {
    emoji: "🆕",
    label: "New Shift",
    bg: Brand.greenLight,
    bgDark: "rgba(14, 58, 35, 0.2)",
    accent: Brand.green,
    accentDark: "#86efac",
    accentSoft: "#dcfce7",
    accentSoftDark: "rgba(34, 197, 94, 0.10)",
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
} as const;

function FeedItemSheet({
  item,
  likers,
  liked,
  onToggleLike,
  onClose,
  colors,
  isDark,
}: {
  item: FeedItem;
  likers: LikeUser[];
  liked: boolean;
  onToggleLike: () => void;
  onClose: () => void;
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const timeAgo = formatDistanceToNow(new Date(item.timestamp), { addSuffix: true });
  const config = SHEET_TYPE_CONFIG[item.type];
  const accentColor = isDark ? config.accentDark : config.accent;

  // Determine hero avatar for friend items
  const hasFriendAvatar =
    (item.type === "achievement" || item.type === "milestone" || item.type === "photo_post") &&
    item.isFriend &&
    item.profilePhotoUrl;

  // Build title/body
  let title = "";
  let body = "";
  if (item.type === "announcement") {
    title = item.title;
    body = item.body;
  } else if (item.type === "new_shift") {
    const spotsLeft = item.shift.capacity - item.shift.signedUp;
    title = "New shift available";
    body = `${item.shift.shiftType.name} at ${item.shift.location} — ${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`;
  } else if (item.type === "achievement") {
    title = `Ka pai! ${item.userName} earned "${item.achievementName}"`;
    body = item.description;
  } else if (item.type === "milestone") {
    title = `${item.userName} reached ${item.count} shifts!`;
    body = "Ngā mihi nui — what a legend 💚";
  } else if (item.type === "photo_post") {
    title = `${item.userName} shared photos`;
    body = item.caption;
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
      <View
        style={[
          styles.sheetPage,
          { backgroundColor: colors.background },
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
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
                { backgroundColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" },
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
                  source={{ uri: (item as { profilePhotoUrl: string }).profilePhotoUrl }}
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
                  <Text style={sheet.heroAvatarBadgeEmoji}>{config.emoji}</Text>
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
              <Text
                style={[
                  sheet.heroLabelText,
                  { color: accentColor },
                ]}
              >
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
            <Text style={[sheet.title, { color: colors.text }]}>
              {title}
            </Text>

            {/* Body text */}
            <Text style={[sheet.body, { color: colors.textSecondary }]}>
              {body}
            </Text>

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
                  <Ionicons name="person" size={11} color={colors.textSecondary} />
                  <Text style={[sheet.metaPillText, { color: colors.textSecondary }]}>
                    {item.author}
                  </Text>
                </View>
              )}
              {item.type === "new_shift" && (
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
                    <Ionicons name="calendar" size={11} color={colors.textSecondary} />
                    <Text style={[sheet.metaPillText, { color: colors.textSecondary }]}>
                      {format(new Date(item.shift.start), "EEE d MMM")}
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
                    <Ionicons name="time" size={11} color={colors.textSecondary} />
                    <Text style={[sheet.metaPillText, { color: colors.textSecondary }]}>
                      {format(new Date(item.shift.start), "h:mm a")}
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
                    <Ionicons name="location" size={11} color={colors.textSecondary} />
                    <Text style={[sheet.metaPillText, { color: colors.textSecondary }]}>
                      {item.shift.location}
                    </Text>
                  </View>
                </>
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
                    <Ionicons name="location" size={11} color={colors.textSecondary} />
                    <Text style={[sheet.metaPillText, { color: colors.textSecondary }]}>
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
                    <Ionicons name="calendar" size={11} color={colors.textSecondary} />
                    <Text style={[sheet.metaPillText, { color: colors.textSecondary }]}>
                      {format(new Date(item.shiftDate), "d MMM")} {item.period}
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
                <Ionicons name="time" size={11} color={colors.textSecondary} />
                <Text style={[sheet.metaPillText, { color: colors.textSecondary }]}>
                  {timeAgo}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Shift link (for new_shift type) ── */}
          {item.type === "new_shift" && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
                router.push(`/shift/${item.shift.id}` as Href);
              }}
              style={({ pressed }) => [
                sheet.shiftLink,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.04)"
                    : "#f8fafc",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "#e2e8f0",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityLabel="View shift details"
              accessibilityRole="link"
            >
              <View style={[sheet.shiftLinkIcon, { backgroundColor: isDark ? "rgba(14,58,35,0.3)" : Brand.greenLight }]}>
                <Ionicons name="calendar" size={14} color={isDark ? "#86efac" : Brand.green} />
              </View>
              <Text style={[sheet.shiftLinkText, { color: colors.text }]}>
                View shift details
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Pressable>
          )}

          {/* ── Photo gallery (for photo_post type) ── */}
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
                <Image
                  source={{ uri: item.photos[0] }}
                  style={sheet.photoSingle}
                />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={sheet.photoScrollContent}
                >
                  {item.photos.map((uri, i) => (
                    <Image
                      key={`${item.id}-photo-${i}`}
                      source={{ uri }}
                      style={sheet.photoScrollItem}
                    />
                  ))}
                </ScrollView>
              )}
              <Text style={[sheet.photoCount, { color: colors.textSecondary }]}>
                {item.photos.length} {item.photos.length === 1 ? "photo" : "photos"}
              </Text>
            </View>
          )}

          {/* ── Social section ── */}
          <View
            style={[
              sheet.socialCard,
              {
                backgroundColor: colors.card,
                shadowColor: isDark ? "#000" : "#64748b",
              },
            ]}
          >
            {/* Like + count row */}
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
                  <Text style={[sheet.socialCount, { color: colors.textSecondary }]}>
                    {likeCount} {likeCount === 1 ? "person" : "people"} liked this
                  </Text>
                )}
              </View>

              {/* Stacked avatars on the right */}
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
                            <Text style={[sheet.socialAvatarInitial, { color: Brand.green }]}>
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

            {/* Expanded likers list */}
            {shownLikers.length > 0 && (
              <View style={sheet.likersSection}>
                <View
                  style={[
                    sheet.likersDivider,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "#f1f5f9",
                    },
                  ]}
                />
                {shownLikers.map((liker) => {
                  const initial = liker.name.charAt(0).toUpperCase();
                  return (
                    <View key={liker.id} style={sheet.likerRow}>
                      {liker.profilePhotoUrl ? (
                        <Image
                          source={{ uri: liker.profilePhotoUrl }}
                          style={sheet.likerAvatar}
                        />
                      ) : (
                        <View
                          style={[
                            sheet.likerAvatarFallback,
                            { backgroundColor: Brand.greenLight },
                          ]}
                        >
                          <Text style={[sheet.likerInitial, { color: Brand.green }]}>
                            {initial}
                          </Text>
                        </View>
                      )}
                      <Text
                        style={[sheet.likerName, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {liker.name}
                      </Text>
                      <Ionicons name="heart" size={11} color="#e11d48" />
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
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

  // Hero card
  heroCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: "hidden",
  },
  heroGradient: {
    backgroundColor: Brand.green,
    padding: 22,
    gap: 10,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  heroBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.3,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontFamily: FontFamily.headingBold,
    marginTop: 2,
  },
  heroDetails: {
    gap: 6,
  },
  heroDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroEmoji: {
    fontSize: 14,
  },
  heroDetailText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontFamily: FontFamily.regular,
  },
  heroCountdown: {
    marginTop: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  heroCountdownText: {
    color: "#ffffff",
    fontSize: 13,
    fontFamily: FontFamily.medium,
  },

  // Open shifts banner
  openShiftsBanner: {
    marginHorizontal: 20,
    marginTop: 20,
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
  likeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  likeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  // Avatar stack (overlapping circles)
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarStackItem: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#ffffff",
    overflow: "hidden",
  },
  avatarStackImage: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  avatarStackFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarStackInitial: {
    fontSize: 9,
    fontFamily: FontFamily.semiBold,
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

  // Shift link
  shiftLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  shiftLinkIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  shiftLinkText: {
    flex: 1,
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
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

  // Likers section
  likersSection: {
    gap: 4,
    marginTop: 14,
  },
  likersDivider: {
    height: 1,
    marginBottom: 10,
  },
  likerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
    paddingHorizontal: 4,
  },
  likerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  likerAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  likerInitial: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
  },
  likerName: {
    flex: 1,
    fontSize: 14,
    fontFamily: FontFamily.medium,
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
});
