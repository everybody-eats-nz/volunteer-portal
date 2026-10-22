import { Ionicons } from "@expo/vector-icons";
import { MenuView, type MenuAction } from "@react-native-menu/menu";
import { formatDistanceToNow } from "date-fns";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import { useRouter, type Href } from "expo-router";
import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ImageViewer } from "@/components/image-viewer";
import { RichText } from "@/components/rich-text";
import { ThemedText } from "@/components/themed-text";
import {
  Brand,
  Colors,
  FontFamily,
  MaxFontScale,
  Palette,
  Radius,
  StatusColors,
  Tones,
  type ToneName,
} from "@/constants/theme";
import { formatNZDateOnly, formatNZT } from "@/lib/dates";
import type { FeedComment, FeedItem, LikeUser } from "@/lib/dummy-data";
import { openExternalLink } from "@/lib/external-links";

import { GuestQuote } from "./guest-quote";
import { journalCategoryLabel } from "./journal-category";

/* ── Feed Item Sheet ── */

/** Android press ripple on the forest-filled call-to-action buttons. */
const CTA_RIPPLE_ON_FILL = "rgba(253, 248, 239, 0.22)";

/**
 * Each feed type's emoji, header label and hue. The hue is the same `Tones`
 * entry as the type's icon tile on the feed row, so the sheet opens in the
 * colour of the row that was tapped, in either scheme.
 */
const SHEET_TYPE_CONFIG: Record<
  FeedItem["type"],
  { emoji: string; label: string; tone: ToneName }
> = {
  announcement: { emoji: "📢", label: "Announcement", tone: "sun" },
  achievement: { emoji: "🏆", label: "Achievement", tone: "amber" },
  photo_post: { emoji: "📸", label: "Photo", tone: "pink" },
  friend_signup: { emoji: "✋", label: "Friend Activity", tone: "blue" },
  shift_recap: { emoji: "🍽️", label: "Shift Recap", tone: "emerald" },
  new_shift: { emoji: "📅", label: "New Shifts", tone: "orange" },
  daily_menu: { emoji: "🍲", label: "Tonight's Menu", tone: "amber" },
  community_event: { emoji: "🎟️", label: "Community Event", tone: "violet" },
  journal_post: { emoji: "📖", label: "From the Journal", tone: "sky" },
};

export function FeedItemSheet({
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
  const scheme = isDark ? "dark" : "light";
  const tones = Tones[scheme];
  const destructive = StatusColors[scheme].destructive;
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
          title: "Reported - pending review",
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
  const typeTone = tones[config.tone];
  const accentColor = typeTone.fg;
  const heroEmoji =
    item.type === "achievement" && item.achievementIcon
      ? item.achievementIcon
      : config.emoji;
  const isPastDailyMenu =
    item.type === "daily_menu" &&
    formatNZDateOnly(item.serviceDate, "yyyy-MM-dd") <
      formatNZT(new Date(), "yyyy-MM-dd");
  const headerLabel = isPastDailyMenu
    ? "Past Menu"
    : item.type === "announcement" && item.visibleAsAdmin
      ? "Admin view"
      : config.label;

  // Hero avatar: the friend who posted, or the admin behind an announcement.
  const heroAvatarUrl =
    item.type === "announcement"
      ? item.authorPhotoUrl
      : (item.type === "achievement" ||
            item.type === "photo_post" ||
            item.type === "friend_signup") &&
          item.isFriend
        ? item.profilePhotoUrl
        : undefined;

  // Build title/body
  let title = "";
  let body = "";
  if (item.type === "announcement") {
    title = item.title;
    body = item.body;
  } else if (item.type === "achievement") {
    title = `Ka pai! ${item.userName} earned "${item.achievementName}"`;
    body = item.description;
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
    title = item.location;
    body = formatNZT(new Date(item.date), "EEEE d MMMM");
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
    title = `Menu for ${formatNZDateOnly(item.serviceDate, "EEEE d MMM")} at ${
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
      const valid = items.filter((m): m is NonNullable<typeof m> =>
        Boolean(m?.name)
      );
      if (valid.length === 0) return null;
      const isSingle = valid.length === 1;
      const lines = valid.map((m) => {
        const prefix = isSingle ? "" : "- ";
        return m.description
          ? `${prefix}**${m.name}** - ${m.description}`
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
  } else if (item.type === "community_event") {
    title = item.title;
    body = item.description ?? "";
  } else if (item.type === "journal_post") {
    title = item.title;
    body = item.summary ?? "";
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
        style={sheet.page}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[sheet.page, { backgroundColor: colors.background }]}
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
                { backgroundColor: typeTone.bg },
              ]}
            >
              {/* Handle bar */}
              <View
                style={[
                  sheet.handleBar,
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
                  color={colors.textSecondary}
                />
              </Pressable>

              {/* Hero icon or friend avatar */}
              {heroAvatarUrl ? (
                <View style={sheet.heroAvatarWrapper}>
                  <Image
                    source={{ uri: heroAvatarUrl }}
                    style={sheet.heroAvatar}
                  />
                  <View
                    style={[
                      sheet.heroAvatarBadge,
                      {
                        backgroundColor: colors.card,
                        borderColor: isDark ? colors.card : typeTone.bg,
                      },
                    ]}
                  >
                    <Text
                      style={sheet.heroAvatarBadgeEmoji}
                      maxFontSizeMultiplier={MaxFontScale.compact}
                    >
                      {heroEmoji}
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
                <ThemedText
                  style={[sheet.heroLabelText, { color: accentColor }]}
                  maxFontSizeMultiplier={MaxFontScale.compact}
                >
                  {headerLabel}
                </ThemedText>
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

              {/* Body text — use Markdown renderer for announcements and menus.
                  Skip entirely when empty (e.g. a CMS event without a short
                  description) so it doesn't reserve a blank line. */}
              {body.length === 0 ? null : item.type === "announcement" ||
                item.type === "daily_menu" ? (
                <RichText
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
                </RichText>
              ) : (
                <Text style={[sheet.body, { color: colors.textSecondary }]}>
                  {body}
                </Text>
              )}

              {/* Recaps lead with the night's numbers; the date is already
                  the subtitle, so they skip the meta pills. */}
              {item.type === "shift_recap" ? (
                <View
                  style={[sheet.recapStats, { borderTopColor: colors.border }]}
                >
                  <RecapStat
                    value={item.mealsServed}
                    noun="meal"
                    suffix=" served"
                    colors={colors}
                  />
                  <View
                    style={[
                      sheet.recapStatDivider,
                      { backgroundColor: colors.border },
                    ]}
                  />
                  <RecapStat
                    value={item.volunteerCount}
                    noun="volunteer"
                    colors={colors}
                  />
                </View>
              ) : (
                <View style={sheet.metaRow}>
                  {item.type === "announcement" && (
                    <MetaPill icon="person" colors={colors} isDark={isDark}>
                      {item.author}
                    </MetaPill>
                  )}
                  {item.type === "photo_post" && (
                    <>
                      <MetaPill icon="location" colors={colors} isDark={isDark}>
                        {item.location}
                      </MetaPill>
                      <MetaPill icon="calendar" colors={colors} isDark={isDark}>
                        {formatNZT(new Date(item.shiftDate), "d MMM")}{" "}
                        {item.period}
                      </MetaPill>
                    </>
                  )}
                  {item.type === "community_event" && (
                    <>
                      {item.location ? (
                        <MetaPill icon="location" colors={colors} isDark={isDark}>
                          {item.location}
                        </MetaPill>
                      ) : null}
                      <MetaPill icon="calendar" colors={colors} isDark={isDark}>
                        {item.pinned
                          ? "Today"
                          : formatNZT(new Date(item.eventDate), "EEE d MMM")}
                        {item.displayTime ? ` · ${item.displayTime}` : ""}
                      </MetaPill>
                      {item.priceLabel ? (
                        <MetaPill icon="pricetag" colors={colors} isDark={isDark}>
                          {item.priceLabel}
                        </MetaPill>
                      ) : null}
                    </>
                  )}
                  {item.type === "journal_post" && (
                    <>
                      <MetaPill icon="bookmark" colors={colors} isDark={isDark}>
                        {journalCategoryLabel(item.category)}
                      </MetaPill>
                      {item.author ? (
                        <MetaPill icon="person" colors={colors} isDark={isDark}>
                          {item.author}
                        </MetaPill>
                      ) : null}
                    </>
                  )}
                  <MetaPill icon="time" colors={colors} isDark={isDark}>
                    {timeAgo}
                  </MetaPill>
                </View>
              )}
            </View>

            {/* ── Guest notes from pay-at-table (shift recap) ── */}
            {item.type === "shift_recap" &&
            item.dinerFeedback &&
            item.dinerFeedback.length > 0 ? (
              <View
                style={[
                  sheet.guestCard,
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
                  From our guests
                </Text>
                {item.dinerFeedback.map((note, idx) => (
                  <View
                    key={note.id}
                    style={[
                      sheet.guestRow,
                      {
                        borderTopWidth:
                          idx === 0 ? 0 : StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                      },
                    ]}
                  >
                    <GuestQuote note={note} colors={colors} />
                  </View>
                ))}
              </View>
            ) : null}

            {/* ── Achievement criteria card ── */}
            {item.type === "achievement" && item.criteria ? (
              <View
                style={[
                  sheet.criteriaCard,
                  {
                    backgroundColor: colors.card,
                    shadowColor: isDark ? "#000" : "#64748b",
                  },
                ]}
              >
                <View style={sheet.criteriaHeader}>
                  <View
                    style={[
                      sheet.criteriaSectionAccent,
                      { backgroundColor: accentColor },
                    ]}
                  />
                  <Text
                    style={[
                      sheet.criteriaSectionLabel,
                      { color: accentColor },
                    ]}
                  >
                    {item.userName === "You"
                      ? "You completed"
                      : `${item.userName} completed`}
                  </Text>
                </View>
                <View style={sheet.criteriaRow}>
                  <View
                    style={[
                      sheet.criteriaBadge,
                      {
                        backgroundColor: isDark
                          ? "rgba(134,239,172,0.14)"
                          : Brand.greenLight,
                      },
                    ]}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.tint}
                    />
                  </View>
                  <Text
                    style={[sheet.criteriaText, { color: colors.text }]}
                  >
                    {item.criteria}
                  </Text>
                </View>
              </View>
            ) : null}

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
                              { color: colors.tint },
                            ]}
                            maxFontSizeMultiplier={MaxFontScale.compact}
                          >
                            {formatNZT(start, "EEE").toUpperCase()}
                          </Text>
                          <Text
                            style={[
                              sheet.shiftListDayNum,
                              { color: colors.tint },
                            ]}
                            maxFontSizeMultiplier={MaxFontScale.compact}
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
                    android_ripple={{ color: colors.border, foreground: true }}
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
                        { color: colors.tint },
                      ]}
                    >
                      {item.count > item.preview.length
                        ? `Browse all ${item.count} shifts`
                        : "Browse shifts"}
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={16}
                      color={colors.tint}
                    />
                  </Pressable>
                </View>
              )}

            {/* ── Daily menu CTA: browse shifts on that service day (only if today or upcoming) ── */}
            {item.type === "daily_menu" &&
              formatNZDateOnly(item.serviceDate, "yyyy-MM-dd") >=
                formatNZT(new Date(), "yyyy-MM-dd") && (
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    onClose();
                    const dateKey = formatNZDateOnly(
                      item.serviceDate,
                      "yyyy-MM-dd"
                    );
                    router.push(`/(tabs)/shifts?date=${dateKey}` as Href);
                  }}
                  android_ripple={{ color: CTA_RIPPLE_ON_FILL, foreground: true }}
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
                  <Text
                    style={[
                      sheet.shiftListCTAText,
                      { color: Palette.cream50 },
                    ]}
                  >
                    See shifts for this day
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={Palette.cream50}
                  />
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
                  android_ripple={{ color: CTA_RIPPLE_ON_FILL, foreground: true }}
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
                  <Text
                    style={[
                      sheet.shiftListCTAText,
                      { color: Palette.cream50 },
                    ]}
                  >
                    Sign up for this shift
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={Palette.cream50}
                  />
                </Pressable>
              )}

            {/* ── Hero image (announcements + CMS content) ── */}
            {(item.type === "announcement" ||
              item.type === "community_event" ||
              item.type === "journal_post") &&
              item.imageUrl && (
                <Pressable
                  onPress={() => openSheetViewer([item.imageUrl!], 0)}
                  accessibilityLabel="View image"
                  accessibilityRole="imagebutton"
                >
                  <ExpoImage
                    source={{ uri: item.imageUrl }}
                    // Event images are portrait posters (4:5 / 9:16) - show
                    // them in a 4:5 frame instead of a shallow strip that
                    // crops away the poster's content.
                    style={[
                      item.type === "community_event"
                        ? sheet.posterImage
                        : sheet.photoSingle,
                      {
                        borderRadius: 12,
                        marginBottom: 12,
                        backgroundColor: colors.border,
                      },
                    ]}
                    contentFit="cover"
                    transition={200}
                    cachePolicy="memory-disk"
                  />
                </Pressable>
              )}

            {/* ── Community event CTAs: tickets + marketing site ── */}
            {item.type === "community_event" && (
              <View style={sheet.linkCTAGroup}>
                {item.ticketUrl ? (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      openExternalLink(item.ticketUrl!);
                    }}
                    android_ripple={{ color: CTA_RIPPLE_ON_FILL, foreground: true }}
                    style={({ pressed }) => [
                      sheet.shiftListCTA,
                      {
                        backgroundColor: Brand.green,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Get tickets"
                  >
                    <Text
                      style={[
                        sheet.shiftListCTAText,
                        { color: Palette.cream50 },
                      ]}
                    >
                      Get tickets
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={16}
                      color={Palette.cream50}
                    />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    openExternalLink(item.url);
                  }}
                  android_ripple={{ color: colors.border, foreground: true }}
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
                  accessibilityLabel="View event on everybodyeats.nz"
                >
                  <Text
                    style={[
                      sheet.shiftListCTAText,
                      { color: colors.tint },
                    ]}
                  >
                    View on everybodyeats.nz
                  </Text>
                  <Ionicons
                    name="open-outline"
                    size={16}
                    color={colors.tint}
                  />
                </Pressable>
              </View>
            )}

            {/* ── Journal post CTA: read the full story ── */}
            {item.type === "journal_post" && (
              <View style={sheet.linkCTAGroup}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    openExternalLink(item.url);
                  }}
                  android_ripple={{ color: CTA_RIPPLE_ON_FILL, foreground: true }}
                  style={({ pressed }) => [
                    sheet.shiftListCTA,
                    {
                      backgroundColor: Brand.green,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Read the full story on everybodyeats.nz"
                >
                  <Text
                    style={[
                      sheet.shiftListCTAText,
                      { color: Palette.cream50 },
                    ]}
                  >
                    Read the full story
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={Palette.cream50}
                  />
                </Pressable>
              </View>
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
                  android_ripple={{
                    color: "rgba(225, 29, 72, 0.16)",
                    foreground: true,
                  }}
                  style={({ pressed }) => [
                    sheet.likeButton,
                    {
                      backgroundColor: liked
                        ? "rgba(225, 29, 72, 0.10)"
                        : isDark
                        ? "rgba(255,255,255,0.05)"
                        : colors.surfaceSoft,
                      transform: [
                        {
                          scale: pressed && Platform.OS === "ios" ? 0.92 : 1,
                        },
                      ],
                    },
                  ]}
                  accessibilityLabel="Like"
                  accessibilityRole="button"
                  accessibilityState={{ selected: liked }}
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
                        <Pressable
                          key={liker.id}
                          onPress={() => onOpenUserProfile(liker.id)}
                          accessibilityLabel={`View ${liker.name}'s profile`}
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            sheet.socialAvatarRing,
                            {
                              zIndex: shownLikers.length - i,
                              marginLeft: i === 0 ? 0 : -10,
                              borderColor: colors.card,
                              opacity: pressed ? 0.75 : 1,
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
                                { backgroundColor: tones.forest.bg },
                              ]}
                            >
                              <Text
                                style={[
                                  sheet.socialAvatarInitial,
                                  { color: tones.forest.fg },
                                ]}
                                maxFontSizeMultiplier={MaxFontScale.compact}
                              >
                                {initial}
                              </Text>
                            </View>
                          )}
                        </Pressable>
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
                                : colors.surfaceSoft,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              sheet.socialAvatarInitial,
                              { color: colors.textSecondary },
                            ]}
                            maxFontSizeMultiplier={MaxFontScale.compact}
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
                      : colors.surfaceSoft,
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
                                { backgroundColor: tones.forest.bg },
                              ]}
                            >
                              <Text
                                style={[
                                  sheet.commentAvatarInitial,
                                  { color: tones.forest.fg },
                                ]}
                                maxFontSizeMultiplier={MaxFontScale.compact}
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
                                      : colors.surfaceSoft,
                                    borderColor: colors.border,
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
                                        ? colors.surfaceSunk
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
                                          : Palette.cream50,
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
                    borderTopColor: colors.border,
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
                        : colors.surfaceSoft,
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
                  // 36pt circle; the slop takes the target to 44pt.
                  hitSlop={4}
                  style={({ pressed }) => [
                    sheet.commentSendButton,
                    {
                      backgroundColor: commentText.trim()
                        ? Brand.green
                        : colors.surfaceSunk,
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
                      commentText.trim()
                        ? Palette.cream50
                        : colors.textSecondary
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
                      : colors.surfaceSoft,
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
                  android_ripple={{ color: destructive.bg, foreground: true }}
                  style={({ pressed }) => [
                    sheet.moderateActionBtn,
                    {
                      backgroundColor: destructive.bg,
                      opacity: pressed && Platform.OS === "ios" ? 0.7 : 1,
                    },
                  ]}
                  accessibilityLabel="Report or block this post"
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="flag-outline"
                    size={13}
                    color={destructive.fg}
                  />
                  <ThemedText
                    style={[
                      sheet.moderateActionBtnText,
                      { color: destructive.fg },
                    ]}
                    maxFontSizeMultiplier={MaxFontScale.compact}
                  >
                    Report / Block
                  </ThemedText>
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

/** A small icon + text fact under the sheet's title (author, place, time). */
function MetaPill({
  icon,
  colors,
  isDark,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  children: ReactNode;
}) {
  return (
    <View
      style={[
        sheet.metaPill,
        {
          backgroundColor: isDark
            ? "rgba(255,255,255,0.05)"
            : colors.surfaceSoft,
        },
      ]}
    >
      <Ionicons name={icon} size={11} color={colors.textSecondary} />
      <Text
        style={[sheet.metaPillText, { color: colors.textSecondary }]}
        maxFontSizeMultiplier={MaxFontScale.compact}
      >
        {children}
      </Text>
    </View>
  );
}

/** One of the recap sheet's headline numbers. */
function RecapStat({
  value,
  noun,
  suffix = "",
  colors,
}: {
  value: number;
  noun: string;
  /** Trailing words after the pluralised noun, e.g. " served". */
  suffix?: string;
  colors: (typeof Colors)["light"];
}) {
  const label = `${noun}${value === 1 ? "" : "s"}${suffix}`;
  return (
    <View
      style={sheet.recapStat}
      accessible
      accessibilityLabel={`${value} ${label}`}
    >
      <Text style={[sheet.recapStatValue, { color: colors.text }]}>
        {value.toLocaleString("en-NZ")}
      </Text>
      <Text style={[sheet.recapStatLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

/* ── Sheet detail styles ── */

const sheet = StyleSheet.create({
  // Native pageSheet wrapper + grab handle
  page: {
    flex: 1,
  },
  handleBar: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    alignSelf: "center",
  },


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
    lineHeight: 14,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  // Content card
  contentCard: {
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: Radius.card,
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

  // Shift recap: headline numbers + guest notes
  recapStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  recapStat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  recapStatValue: {
    fontSize: 40,
    lineHeight: 46,
    fontFamily: FontFamily.display,
    letterSpacing: -0.5,
  },
  recapStatLabel: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
  },
  recapStatDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
  },
  guestCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: Radius.card,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  guestRow: {
    paddingVertical: 16,
  },

  // Achievement criteria card (shown in achievement sheet)
  criteriaCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: Radius.card,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  criteriaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  criteriaSectionAccent: {
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  criteriaSectionLabel: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  criteriaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  criteriaBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  criteriaText: {
    flex: 1,
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.1,
  },

  // Social card
  socialCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: Radius.card,
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
    overflow: "hidden",
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
    borderRadius: Radius.card,
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
    borderRadius: Radius.card,
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
    // Clips the Android ripple to the rounded button.
    overflow: "hidden",
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
  linkCTAGroup: {
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 2,
  },
  photoSingle: {
    width: "100%",
    height: 220,
  },
  posterImage: {
    width: "100%",
    aspectRatio: 4 / 5,
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
  // A 44pt target whose negative margins keep the ellipsis where the old
  // 28pt box drew it.
  commentMoreBtn: {
    marginTop: -10,
    marginRight: -14,
  },
  commentMoreBtnInner: {
    width: 44,
    height: 44,
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
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  moderateActionBtnText: {
    fontSize: 12,
    lineHeight: 16,
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
