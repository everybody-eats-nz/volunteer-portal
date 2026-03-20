import { Ionicons } from "@expo/vector-icons";
import { differenceInHours, format, formatDistanceToNow } from "date-fns";
import * as Haptics from "expo-haptics";
import { useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import {
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
  AVAILABLE_SHIFTS,
  DUMMY_PROFILE,
  FEED_ITEMS,
  MY_SHIFTS,
  type FeedItem,
} from "@/lib/dummy-data";

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const nextShift = MY_SHIFTS[0];
  const hoursUntilShift = nextShift
    ? differenceInHours(new Date(nextShift.start), new Date())
    : null;

  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());
  const toggleLike = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLikedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content]}
      showsVerticalScrollIndicator={false}
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
          <ThemedText type="title">{DUMMY_PROFILE.firstName}</ThemedText>
        </View>
        <Pressable
          onPress={() => router.push("/(tabs)/profile")}
          style={({ pressed }) => [
            styles.avatarButton,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityLabel="View profile"
        >
          {DUMMY_PROFILE.image ? (
            <Image
              source={{ uri: DUMMY_PROFILE.image }}
              style={styles.avatarImage}
            />
          ) : (
            <View
              style={[styles.avatarFallback, { backgroundColor: Brand.green }]}
            >
              <Text style={styles.avatarText}>
                {DUMMY_PROFILE.firstName.charAt(0)}
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
      {AVAILABLE_SHIFTS.length > 0 && (
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
                {AVAILABLE_SHIFTS.length} shifts are looking for whānau
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
              router={router}
              isLast={index === FEED_ITEMS.length - 1}
              liked={likedItems.has(item.id)}
              onToggleLike={() => toggleLike(item.id)}
            />
          ))}
        </View>
      </View>

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
  color,
}: {
  liked: boolean;
  onPress: () => void;
  color: string;
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
        size={18}
        color={liked ? "#e11d48" : color}
      />
    </Pressable>
  );
}

function FeedCard({
  item,
  colors,
  router,
  isLast,
  liked,
  onToggleLike,
}: {
  item: FeedItem;
  colors: (typeof Colors)["light"];
  router: ReturnType<typeof useRouter>;
  isLast: boolean;
  liked: boolean;
  onToggleLike: () => void;
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

  if (item.type === "announcement") {
    return (
      <View style={[styles.feedCard, borderStyle]}>
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
            <View style={styles.feedMeta}>
              <Text
                style={[styles.feedMetaText, { color: colors.textSecondary }]}
              >
                {item.author}
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
            <LikeButton
              liked={liked}
              onPress={onToggleLike}
              color={colors.textSecondary}
            />
          </View>
        </View>
      </View>
    );
  }

  if (item.type === "new_shift") {
    const spotsLeft = item.shift.capacity - item.shift.signedUp;
    return (
      <View style={[styles.feedCard, borderStyle]}>
        <View style={[styles.feedIcon, { backgroundColor: Brand.greenLight }]}>
          <Text style={styles.feedIconEmoji}>🆕</Text>
        </View>
        <View style={styles.feedBody}>
          <Pressable
            onPress={() => router.push(`/shift/${item.shift.id}` as Href)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={[styles.feedTitle, { color: colors.text }]}>
              New shift available
            </Text>
            <Text
              style={[styles.feedDescription, { color: colors.textSecondary }]}
            >
              {item.shift.shiftType.name} at {item.shift.location} — {spotsLeft}{" "}
              spot{spotsLeft !== 1 ? "s" : ""} left
            </Text>
          </Pressable>
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
            <LikeButton
              liked={liked}
              onPress={onToggleLike}
              color={colors.textSecondary}
            />
          </View>
        </View>
      </View>
    );
  }

  if (item.type === "achievement") {
    return (
      <View style={[styles.feedCard, borderStyle]}>
        <View style={[styles.feedIcon, { backgroundColor: "#fef3c7" }]}>
          <Text style={styles.feedIconEmoji}>🏆</Text>
        </View>
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
            <LikeButton
              liked={liked}
              onPress={onToggleLike}
              color={colors.textSecondary}
            />
          </View>
        </View>
      </View>
    );
  }

  if (item.type === "milestone") {
    return (
      <View style={[styles.feedCard, borderStyle]}>
        <View style={[styles.feedIcon, { backgroundColor: "#dcfce7" }]}>
          <Text style={styles.feedIconEmoji}>🔥</Text>
        </View>
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
            <LikeButton
              liked={liked}
              onPress={onToggleLike}
              color={colors.textSecondary}
            />
          </View>
        </View>
      </View>
    );
  }

  return null;
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
  likeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
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
});
