import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { RichText } from "@/components/rich-text";
import { ThemedText } from "@/components/themed-text";
import {
  Colors,
  FontFamily,
  MaxFontScale,
  Tones,
  type Tone,
  type ToneName,
} from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { announcementCategoryPill } from "@/lib/announcement-category";
import { formatNZDateOnly, formatNZT } from "@/lib/dates";
import type { FeedItem } from "@/lib/dummy-data";
import {
  nzDaysUntil,
  nzDaysUntilDateOnly,
  upcomingLabel,
} from "@/lib/feed-ranking";

import { GuestQuote } from "./guest-quote";
import { journalCategoryLabel } from "./journal-category";

/* ── Feed Card ── */

/** Rose for a like, the same in both schemes (it reads on paper and on dark). */
const LIKED_COLOR = "#e11d48";

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
      // The heart and count draw ~23pt tall; the slop takes the target to 44pt.
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      android_ripple={{ color: "rgba(225, 29, 72, 0.16)", borderless: true }}
      style={({ pressed }) => [
        styles.likeButton,
        { opacity: pressed && Platform.OS === "ios" ? 0.5 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Like, ${count} ${count === 1 ? "like" : "likes"}`}
      accessibilityState={{ selected: liked }}
    >
      <Ionicons
        name={liked ? "heart" : "heart-outline"}
        size={15}
        color={liked ? LIKED_COLOR : color}
      />
      {count > 0 && (
        <ThemedText
          style={[styles.likeCount, { color: liked ? LIKED_COLOR : color }]}
          maxFontSizeMultiplier={MaxFontScale.compact}
        >
          {count}
        </ThemedText>
      )}
    </Pressable>
  );
}

/** A small uppercase label above a feed row's title ("Tonight", "Urgent"). */
function FeedPill({
  tone,
  label,
  accessibilityLabel,
}: {
  tone: Tone;
  label: string;
  accessibilityLabel?: string;
}) {
  return (
    <View style={[styles.feedPill, { backgroundColor: tone.bg }]}>
      <ThemedText
        accessibilityLabel={accessibilityLabel}
        style={[styles.feedPillText, { color: tone.fg }]}
        maxFontSizeMultiplier={MaxFontScale.compact}
      >
        {label}
      </ThemedText>
    </View>
  );
}

/** The emoji tile that leads a feed row with no person behind it. */
function FeedIconTile({ emoji, tone }: { emoji: string; tone: Tone }) {
  return (
    <View style={[styles.feedIcon, { backgroundColor: tone.bg }]}>
      <Text
        style={styles.feedIconEmoji}
        maxFontSizeMultiplier={MaxFontScale.compact}
      >
        {emoji}
      </Text>
    </View>
  );
}

/* ── Friend Avatar with Badge ── */

function FeedAvatar({
  profilePhotoUrl,
  userName,
  emoji,
  tone,
  userId,
}: {
  profilePhotoUrl?: string;
  userName: string;
  emoji: string;
  /** The row's hue, used for the emoji badge (matches the icon tiles). */
  tone: ToneName;
  /** When provided, tapping the avatar opens that volunteer's profile. */
  userId?: string;
}) {
  const router = useRouter();
  const scheme = useColorScheme();
  const tones = Tones[scheme];
  const initial = userName.charAt(0).toUpperCase();

  const avatar = (
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
            { backgroundColor: tones.forest.bg },
          ]}
        >
          <Text
            style={[styles.feedAvatarInitial, { color: tones.forest.fg }]}
            maxFontSizeMultiplier={MaxFontScale.compact}
          >
            {initial}
          </Text>
        </View>
      )}
      <View
        style={[
          styles.feedAvatarBadge,
          {
            backgroundColor: tones[tone].bg,
            // Cuts the badge out of the avatar against the page behind it.
            borderColor: Colors[scheme].background,
          },
        ]}
      >
        <Text
          style={styles.feedAvatarBadgeEmoji}
          maxFontSizeMultiplier={MaxFontScale.compact}
        >
          {emoji}
        </Text>
      </View>
    </View>
  );

  if (!userId) return avatar;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        router.push(`/user/${userId}` as Href);
      }}
      hitSlop={6}
      accessibilityLabel={`View ${userName}'s profile`}
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      {avatar}
    </Pressable>
  );
}

/** "1 meal" / "1,240 meals" - recap counts read as plain facts. */
function countLabel(count: number, noun: string): string {
  return `${count.toLocaleString("en-NZ")} ${noun}${count === 1 ? "" : "s"}`;
}

export function FeedCard({
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
  // (achievement, friend_signup, shift_recap, new_shift, daily_menu,
  // community_event, journal_post) have no author-written content to
  // moderate — but comments on them are still reportable via the sheet.
  const canReport = item.type === "photo_post" || item.type === "announcement";
  const scheme = useColorScheme();
  const tones = Tones[scheme];
  // Track hero image failures so a missing/404 image doesn't leave the
  // 160px image slot reserved (a tall blank gap above the title).
  const [heroImageFailed, setHeroImageFailed] = useState(false);
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
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          android_ripple={{ color: colors.border, borderless: true }}
          style={({ pressed }) => [
            styles.commentButton,
            { opacity: pressed && Platform.OS === "ios" ? 0.5 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${commentCount} ${
            commentCount === 1 ? "comment" : "comments"
          }`}
        >
          <Ionicons
            name="chatbubble-outline"
            size={15}
            color={colors.textSecondary}
          />
          <ThemedText
            style={[styles.commentCount, { color: colors.textSecondary }]}
            maxFontSizeMultiplier={MaxFontScale.compact}
          >
            {commentCount}
          </ThemedText>
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
      const categoryPill = announcementCategoryPill(item.category);
      const iconAndBody = (
        <>
          {item.authorPhotoUrl ? (
            <FeedAvatar
              profilePhotoUrl={item.authorPhotoUrl}
              userName={item.author}
              emoji="📢"
              tone="sun"
            />
          ) : (
            <FeedIconTile emoji="📢" tone={tones.sun} />
          )}
          <View style={styles.feedBody}>
            {(categoryPill || item.visibleAsAdmin) && (
              <View style={styles.announcementPills}>
                {categoryPill && (
                  <FeedPill
                    tone={tones[categoryPill.tone]}
                    label={categoryPill.label}
                  />
                )}
                {item.visibleAsAdmin && (
                  <FeedPill
                    tone={tones.slate}
                    label="Admin view"
                    accessibilityLabel="Shown to you as an admin. This announcement went to a different audience."
                  />
                )}
              </View>
            )}
            <Text style={[styles.feedTitle, { color: colors.text }]}>
              {item.title}
            </Text>
            <RichText style={markdownStyle}>{item.body}</RichText>
            <View style={styles.feedFooter}>
              <Text
                style={[
                  styles.feedMetaText,
                  { flex: 1, color: colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {item.author} · {timeAgo}
              </Text>
              {socialButtons}
            </View>
          </View>
        </>
      );

      const showImage = !!item.imageUrl && !heroImageFailed;
      return (
        <>
          {showImage && (
            <Pressable
              onPress={() => onOpenImages([item.imageUrl!], 0)}
              style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
              accessibilityLabel="View announcement image"
              accessibilityRole="imagebutton"
            >
              <ExpoImage
                source={{ uri: item.imageUrl }}
                style={[
                  styles.announcementImage,
                  { backgroundColor: colors.border },
                ]}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
                onError={() => setHeroImageFailed(true)}
              />
            </Pressable>
          )}
          {showImage ? (
            <View style={styles.announcementRow}>{iconAndBody}</View>
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
              tone="amber"
              userId={item.userId}
            />
          ) : (
            <FeedIconTile emoji="🏆" tone={tones.amber} />
          )}
          <View style={styles.feedBody}>
            <Text style={[styles.feedTitle, { color: colors.text }]}>
              Ka pai! {item.userName} earned &quot;{item.achievementName}&quot;
            </Text>
            <RichText style={markdownStyle}>{item.description}</RichText>
            {item.criteria ? (
              <View
                style={[
                  styles.feedAchievementCriteria,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.feedAchievementCriteriaBadge,
                    { backgroundColor: tones.amber.bg },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={tones.amber.fg}
                  />
                </View>
                <Text
                  style={[
                    styles.feedAchievementCriteriaText,
                    { color: colors.text },
                  ]}
                >
                  {item.criteria}
                </Text>
              </View>
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

    if (item.type === "photo_post") {
      return (
        <>
          {item.isFriend ? (
            <FeedAvatar
              profilePhotoUrl={item.profilePhotoUrl}
              userName={item.userName}
              emoji="📸"
              tone="pink"
              userId={item.userId}
            />
          ) : (
            <FeedIconTile emoji="📸" tone={tones.pink} />
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
            <RichText style={markdownStyle}>{item.caption}</RichText>
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
                    maxFontSizeMultiplier={MaxFontScale.compact}
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
            tone="blue"
            userId={item.userId}
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
      const guestNotes = item.dinerFeedback ?? [];
      return (
        <>
          <FeedIconTile emoji="🍽️" tone={tones.emerald} />
          <View style={styles.feedBody}>
            <Text style={[styles.feedTitle, { color: colors.text }]}>
              {countLabel(item.mealsServed, "meal")} served at {item.location}
            </Text>
            <Text
              style={[styles.feedDescription, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {formatNZT(new Date(item.date), "EEEE d MMM")} ·{" "}
              {countLabel(item.volunteerCount, "volunteer")}
            </Text>
            {guestNotes.length > 0 && (
              <GuestQuote
                note={guestNotes[0]}
                moreCount={guestNotes.length - 1}
                colors={colors}
                preview
              />
            )}
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
          <FeedIconTile emoji="📅" tone={tones.orange} />
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
      const dateText = formatNZDateOnly(item.serviceDate, "EEEE d MMM");
      // Menus resurface at the top of the feed on service day (see
      // lib/feed-ranking.ts) — the pill explains why this one is up here.
      const isTonight =
        nzDaysUntilDateOnly(item.serviceDate, new Date()) === 0;
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
          <FeedIconTile emoji="🍲" tone={tones.amber} />
          <View style={styles.feedBody}>
            {isTonight && (
              <FeedPill
                tone={tones.violet}
                label="Tonight"
                accessibilityLabel="Tonight's menu"
              />
            )}
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

    if (item.type === "community_event") {
      const isToday = item.pinned === true;
      // Countdown pill for the lead-in week — the visible reason this card
      // sits above older posts, and a little hype while it's at it.
      const countdown = isToday
        ? null
        : upcomingLabel(nzDaysUntil(item.eventDate, new Date()));
      const eventDateText = isToday
        ? "Today"
        : formatNZT(new Date(item.eventDate), "EEEE d MMM");
      const metaParts = [
        item.location ? `📍 ${item.location}` : null,
        eventDateText,
        item.displayTime,
      ].filter(Boolean);
      const showThumb = !!item.imageUrl && !heroImageFailed;
      return (
        <>
          <FeedIconTile emoji="🎟️" tone={tones.violet} />
          <View style={styles.feedBody}>
            <View style={styles.feedThumbRow}>
              <View style={styles.feedThumbText}>
                {isToday && (
                  <FeedPill tone={tones.violet} label="Happening today" />
                )}
                {countdown && (
                  <FeedPill
                    tone={tones.amber}
                    label={countdown}
                    accessibilityLabel={`Happening ${countdown.toLowerCase()}`}
                  />
                )}
                <Text style={[styles.feedTitle, { color: colors.text }]}>
                  {item.title}
                </Text>
                <Text
                  style={[styles.feedDescription, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {metaParts.join(" · ")}
                </Text>
                {item.description ? (
                  <Text
                    style={[
                      styles.feedDescription,
                      { color: colors.textSecondary },
                    ]}
                    numberOfLines={2}
                  >
                    {item.description}
                  </Text>
                ) : null}
              </View>
              {showThumb && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onOpenImages([item.imageUrl!], 0);
                  }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                  accessibilityLabel="View event poster"
                  accessibilityRole="imagebutton"
                >
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={[styles.feedThumb, { backgroundColor: colors.border }]}
                    resizeMode="cover"
                    onError={() => setHeroImageFailed(true)}
                  />
                </Pressable>
              )}
            </View>
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

    if (item.type === "journal_post") {
      const showThumb = !!item.imageUrl && !heroImageFailed;
      return (
        <>
          <FeedIconTile emoji="📖" tone={tones.sky} />
          <View style={styles.feedBody}>
            <View style={styles.feedThumbRow}>
              <View style={styles.feedThumbText}>
                <Text style={[styles.feedTitle, { color: colors.text }]}>
                  {item.title}
                </Text>
                {item.summary ? (
                  <Text
                    style={[
                      styles.feedDescription,
                      { color: colors.textSecondary },
                    ]}
                    numberOfLines={3}
                  >
                    {item.summary}
                  </Text>
                ) : null}
              </View>
              {showThumb && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onOpenImages([item.imageUrl!], 0);
                  }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
                  accessibilityLabel="View journal image"
                  accessibilityRole="imagebutton"
                >
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={[styles.feedThumb, { backgroundColor: colors.border }]}
                    resizeMode="cover"
                    onError={() => setHeroImageFailed(true)}
                  />
                </Pressable>
              )}
            </View>
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
                  {journalCategoryLabel(item.category)}
                  {item.author ? ` · ${item.author}` : ""}
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
    }

    return null;
  };

  const hasHeroImage =
    item.type === "announcement" && !!item.imageUrl && !heroImageFailed;

  return (
    <Pressable
      onPress={onShowSheet}
      style={({ pressed }) => [
        styles.feedCard,
        borderStyle,
        hasHeroImage && styles.feedCardColumn,
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
          // The flag draws at 14pt; the slop takes the target to 44pt.
          hitSlop={15}
          android_ripple={{ color: colors.border, borderless: true }}
          style={({ pressed }) => [
            styles.reportBtn,
            hasHeroImage && { top: REPORT_BTN_TOP_WITH_IMAGE },
            { opacity: pressed && Platform.OS === "ios" ? 0.5 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Report or block this post"
          accessibilityHint={
            isReported ? "You have already reported this post" : undefined
          }
        >
          <Ionicons
            name={isReported ? "flag" : "flag-outline"}
            size={14}
            color={isReported ? tones.orange.fg : colors.textSecondary}
          />
        </Pressable>
      )}
    </Pressable>
  );
}

/** Vertical padding on every feed card. */
const FEED_CARD_PADDING_Y = 14;
/** Reserved height of an announcement's hero image, and its gap to the body. */
const ANNOUNCEMENT_IMAGE_HEIGHT = 160;
const ANNOUNCEMENT_IMAGE_GAP = 12;
/**
 * Where the report control sits on an announcement that leads with a hero
 * image: level with the title rather than floating over the picture.
 */
const REPORT_BTN_TOP_WITH_IMAGE =
  FEED_CARD_PADDING_Y + ANNOUNCEMENT_IMAGE_HEIGHT + ANNOUNCEMENT_IMAGE_GAP;

export const styles = StyleSheet.create({
  feedCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: FEED_CARD_PADDING_Y,
    gap: 12,
  },
  feedCardColumn: {
    flexDirection: "column",
    // Stretch, not the row's flex-start: shrink-wrapped children leave the
    // full-width hero image with no width and pull the footer off the edge.
    alignItems: "stretch",
    gap: 0,
  },
  reportBtn: {
    position: "absolute",
    top: FEED_CARD_PADDING_Y,
    right: 0,
    zIndex: 10,
  },
  announcementPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 6,
  },
  announcementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  announcementImage: {
    width: "100%",
    height: ANNOUNCEMENT_IMAGE_HEIGHT,
    borderRadius: 10,
    marginBottom: ANNOUNCEMENT_IMAGE_GAP,
  },
  // Text beside a thumbnail. The footer sits below this row so its like and
  // comment counts still reach the card's right edge.
  feedThumbRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  feedThumbText: {
    flex: 1,
    gap: 3,
  },
  feedThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    marginTop: 2,
  },
  feedPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 4,
  },
  feedPillText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FontFamily.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  feedAchievementCriteria: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 6,
  },
  feedAchievementCriteriaBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  feedAchievementCriteriaText: {
    flex: 1,
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
    lineHeight: 18,
    letterSpacing: -0.1,
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
    lineHeight: 16,
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
    lineHeight: 16,
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
});
