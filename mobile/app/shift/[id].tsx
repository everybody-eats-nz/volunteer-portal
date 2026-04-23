import { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Share,
  Linking,
  View,
  Text,
  Platform,
  ActivityIndicator,
  ActivityIndicator as RNActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { differenceInMinutes } from "date-fns";
import { formatNZT } from "@/lib/dates";

import { ThemedText } from "@/components/themed-text";
import { Colors, Brand, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useShiftDetail, type PeriodFriend } from "@/hooks/use-shift-detail";
import { api, ApiError } from "@/lib/api";
import {
  addShiftToCalendar,
  isCalendarSyncEnabled,
  removeShiftFromCalendar,
} from "@/lib/calendar-sync";
import { ShiftSignupSheet } from "@/components/shift-signup-sheet";
import { GlassButton } from "@/components/glass-button";
import { getShiftThemeByName, getLocationMapsUrl } from "@/lib/dummy-data";

/* ── Music Queue Type ── */

type QueueItem = {
  id: string;
  title: string;
  artist: string;
  requestedBy: string;
  votes: number;
};

const PLACEHOLDER_QUEUE: QueueItem[] = [
  {
    id: "1",
    title: "Here Comes the Sun",
    artist: "The Beatles",
    requestedBy: "Sarah",
    votes: 3,
  },
  {
    id: "2",
    title: "Three Little Birds",
    artist: "Bob Marley",
    requestedBy: "James",
    votes: 2,
  },
  {
    id: "3",
    title: "Don't Stop Me Now",
    artist: "Queen",
    requestedBy: "Mia",
    votes: 1,
  },
];

/* ── Duration Helper ── */

function getDuration(start: string, end: string): string {
  const mins = differenceInMinutes(new Date(end), new Date(start));
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

/* ── Main Screen ── */

export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const {
    shift,
    signups: shiftSignups,
    crew: shiftCrew,
    periodFriends,
    isLoading,
    error,
    refresh,
  } = useShiftDetail(id);
  const isMyShift = shift?.status != null;
  const [checkedIn, setCheckedIn] = useState(false);
  const [signupSheetVisible, setSignupSheetVisible] = useState(false);
  const [signupSheetWaitlist, setSignupSheetWaitlist] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [musicSearch, setMusicSearch] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>(PLACEHOLDER_QUEUE);
  const [photos, setPhotos] = useState<string[]>([]);
  const [votedSongs, setVotedSongs] = useState<Set<string>>(new Set());

  const openSignupSheet = useCallback((waitlist = false) => {
    setSignupSheetWaitlist(waitlist);
    setSignupSheetVisible(true);
  }, []);

  const handleSignupSuccess = useCallback(
    async (result: { id: string; status: string; autoApproved: boolean }) => {
      if (result.status === "CONFIRMED") {
        Alert.alert(
          "Ka pai! 🎉",
          "You're confirmed for this shift. See you there!"
        );
      } else if (result.status === "WAITLISTED") {
        Alert.alert(
          "On the waitlist 📋",
          "You've been added to the waitlist. We'll notify you if a spot opens up."
        );
      } else {
        Alert.alert(
          "Signed up! ✨",
          "Your signup is pending approval. You'll be notified once it's confirmed."
        );
      }
      if (
        shift &&
        (result.status === "CONFIRMED" || result.status === "PENDING") &&
        (await isCalendarSyncEnabled())
      ) {
        addShiftToCalendar(shift).catch(() => {
          // Best-effort: calendar sync runs again on next refresh.
        });
      }
      await refresh();
    },
    [refresh, shift]
  );

  const handleCancel = useCallback(async () => {
    if (!shift) return;
    Alert.alert(
      "Cancel signup?",
      "Are you sure you want to cancel your signup for this shift?",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Yes, cancel",
          style: "destructive",
          onPress: async () => {
            setCancelLoading(true);
            try {
              await api(`/api/mobile/shifts/${shift.id}/signup`, {
                method: "DELETE",
              });
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              removeShiftFromCalendar(shift.id).catch(() => {
                // Best-effort: the next reconcile will clean up anyway.
              });
              Alert.alert("Canceled", "Your signup has been canceled.");
              await refresh();
            } catch (err) {
              const message =
                err instanceof ApiError ? err.message : "Something went wrong.";
              Alert.alert("Cancel failed", message);
            } finally {
              setCancelLoading(false);
            }
          },
        },
      ]
    );
  }, [shift, refresh]);

  // Split period friends into "on your shift" vs "same session, different role"
  const yourShiftFriendIds = useMemo(
    () => new Set(shiftSignups.filter((su) => su.isFriend).map((su) => su.id)),
    [shiftSignups]
  );
  const thisShiftName = shift?.shiftType.name;
  const friendsOnYourShift = useMemo(
    () =>
      periodFriends.filter(
        (f) => yourShiftFriendIds.has(f.id) || f.shiftTypeName === thisShiftName
      ),
    [periodFriends, yourShiftFriendIds, thisShiftName]
  );
  const friendsInSession = useMemo(
    () =>
      periodFriends.filter(
        (f) =>
          !yourShiftFriendIds.has(f.id) && f.shiftTypeName !== thisShiftName
      ),
    [periodFriends, yourShiftFriendIds, thisShiftName]
  );

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "", headerTransparent: true }} />
        <View style={[s.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  if (!shift) {
    return (
      <>
        <Stack.Screen options={{ title: "", headerTransparent: true }} />
        <View style={[s.centered, { backgroundColor: colors.background }]}>
          <View
            style={[
              s.notFoundIcon,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9",
              },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={32}
              color={colors.textSecondary}
            />
          </View>
          <ThemedText type="subtitle" style={{ marginTop: 12 }}>
            {error ?? "Shift not found"}
          </ThemedText>
          <ThemedText
            type="caption"
            style={{ color: colors.textSecondary, marginTop: 4 }}
          >
            This shift may have been removed
          </ThemedText>
          <Pressable
            onPress={() => router.back()}
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

  const date = new Date(shift.start);
  const endDate = new Date(shift.end);
  const spotsLeft = shift.capacity - shift.signedUp;
  const isFull = spotsLeft <= 0;
  const isUrgent = !isFull && spotsLeft <= 2;
  const theme = getShiftThemeByName(shift.shiftType.name);
  const accent = isDark ? theme.colorDark : theme.color;
  const duration = getDuration(shift.start, shift.end);
  const isPast = endDate.getTime() < Date.now();
  const isCompleted = isMyShift && shift.status === "CONFIRMED" && isPast;

  const handleCheckIn = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCheckedIn(true);
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow photo access to share shift photos."
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow camera access to take shift photos."
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const handleAddPhoto = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Add Photo", "How would you like to add a photo?", [
      { text: "Take Photo", onPress: handleTakePhoto },
      { text: "Choose from Library", onPress: handlePickPhoto },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleAddSong = () => {
    if (!musicSearch.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQueue((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        title: musicSearch.trim(),
        artist: "Searching...",
        requestedBy: "You",
        votes: 0,
      },
    ]);
    setMusicSearch("");
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const dateStr = formatNZT(date, "EEEE d MMMM");
    const timeStr = `${formatNZT(date, "h:mm a")} – ${formatNZT(
      endDate,
      "h:mm a"
    )}`;
    try {
      await Share.share({
        message: `🍽️ Volunteer with Everybody Eats!\n\n${
          shift.shiftType.name
        } — ${dateStr}\n🕐 ${timeStr}\n📍 ${shift.location}\n\n${
          spotsLeft > 0
            ? `${spotsLeft} spots left — sign up and join the whānau!`
            : "This shift is full, but check back for cancellations."
        }\n\nhttps://volunteers.everybodyeats.nz/shifts/${shift.id}`,
      });
    } catch {
      // User cancelled share
    }
  };

  const handleVote = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVotedSongs((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
        setQueue((q) =>
          q.map((i) => (i.id === itemId ? { ...i, votes: i.votes - 1 } : i))
        );
      } else {
        next.add(itemId);
        setQueue((q) =>
          q.map((i) => (i.id === itemId ? { ...i, votes: i.votes + 1 } : i))
        );
      }
      return next;
    });
  };

  const showFloatingCta = !isMyShift;
  const floatingCtaReserve = 96 + Math.max(insets.bottom, 12);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? colors.background : Brand.warmWhite,
      }}
    >
      <Stack.Screen
        options={{
          title: "",
          headerShown: true,
          headerTransparent: true,
          headerTintColor: "#fffdf7",
          headerRight: () => (
            <Ionicons
              name="share-outline"
              size={22}
              color="#fffdf7"
              onPress={handleShare}
            />
          ),
        }}
      />
      <ScrollView
        style={[
          s.container,
          { backgroundColor: isDark ? colors.background : Brand.warmWhite },
        ]}
        contentContainerStyle={[
          s.content,
          showFloatingCta && { paddingBottom: floatingCtaReserve + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ HERO ═══ */}
        <View style={s.hero}>
          {theme.heroImage && (
            <Image
              source={{ uri: theme.heroImage }}
              style={s.heroImage}
              contentFit="cover"
            />
          )}

          {/* Layered gradient — faint top, atmospheric middle, solid-green pour at base */}
          <LinearGradient
            colors={[
              "rgba(14,58,35,0.25)",
              "rgba(14,58,35,0.55)",
              "rgba(14,58,35,0.88)",
              Brand.green,
            ]}
            locations={[0, 0.45, 0.82, 1]}
            style={s.heroGradient}
          />

          <View style={s.heroBody}>
            {/* Eyebrow */}
            <View style={s.heroOverlineRow}>
              <View style={s.heroOverlineRule} />
              <Text style={s.heroOverline}>
                {isCompleted
                  ? "Completed · Ngā mihi"
                  : isMyShift
                  ? "You're in the whānau"
                  : "Ngā mahi · A shift"}
              </Text>
              <View style={s.heroOverlineRule} />
            </View>

            {/* Display title — oversized Fraunces */}
            <Text
              style={s.heroTitle}
              numberOfLines={3}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {shift.shiftType.name}
            </Text>

            {/* Description pulled tight under title */}
            {shift.shiftType.description ? (
              <Text style={s.heroDescription} numberOfLines={2}>
                {shift.shiftType.description}
              </Text>
            ) : null}

            {/* Editorial 3-column meta row */}
            <View style={s.heroMetaRow}>
              <View style={s.heroMetaCol}>
                <Text style={s.heroMetaLabel}>
                  {formatNZT(date, "EEEE").toUpperCase()}
                </Text>
                <Text style={s.heroMetaValue}>{formatNZT(date, "d MMM")}</Text>
              </View>
              <View style={s.heroMetaRule} />
              <View style={s.heroMetaCol}>
                <Text style={s.heroMetaLabel}>KICK-OFF</Text>
                <Text style={s.heroMetaValue}>
                  {formatNZT(date, "h:mm").toLowerCase()}
                  <Text style={s.heroMetaValueSmall}>
                    {formatNZT(date, "a").toLowerCase()}
                  </Text>
                </Text>
              </View>
              <View style={s.heroMetaRule} />
              <Pressable
                onPress={() =>
                  Linking.openURL(getLocationMapsUrl(shift.location))
                }
                hitSlop={6}
                style={({ pressed }) => [
                  s.heroMetaCol,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
                accessibilityLabel={`Open ${shift.location} in Maps`}
                accessibilityRole="link"
              >
                <Text style={s.heroMetaLabel}>WHERE</Text>
                <Text
                  style={[s.heroMetaValue, s.heroMetaLink]}
                  numberOfLines={1}
                >
                  {shift.location}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ═══ Status strip — hanging card bridging hero & content ═══ */}
        <View style={s.statusStripWrap}>
          <View
            style={[
              s.statusStrip,
              { backgroundColor: isDark ? "#1a1d21" : "#ffffff" },
            ]}
          >
            {isCompleted ? (
              <View style={s.statusConfirmed}>
                <View
                  style={[
                    s.statusConfirmedBadge,
                    { backgroundColor: Brand.green },
                  ]}
                >
                  <Ionicons
                    name="checkmark-done"
                    size={14}
                    color={Brand.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[s.statusConfirmedTitle, { color: colors.text }]}
                  >
                    Shift completed
                  </Text>
                  <Text
                    style={[
                      s.statusConfirmedMeta,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {formatNZT(date, "EEE d MMM")} · {duration} contributed
                  </Text>
                </View>
                <View
                  style={[
                    s.statusPastChip,
                    {
                      backgroundColor: isDark
                        ? "rgba(248,251,105,0.12)"
                        : "#f1ede4",
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.statusPastChipText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    PAST
                  </Text>
                </View>
              </View>
            ) : isMyShift ? (
              <View style={s.statusConfirmed}>
                <View style={s.statusConfirmedBadge}>
                  <Ionicons name="checkmark" size={12} color={Brand.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[s.statusConfirmedTitle, { color: colors.text }]}
                  >
                    You&apos;re signed up
                  </Text>
                  <Text
                    style={[
                      s.statusConfirmedMeta,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {formatNZT(date, "EEE h:mma")} —{" "}
                    {formatNZT(endDate, "h:mma").toLowerCase()} · {duration}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={s.statusBrowsing}>
                <View style={s.statusBrowsingLeft}>
                  <Text
                    style={[s.statusCapacityNumber, { color: colors.text }]}
                  >
                    {shift.signedUp}
                    <Text
                      style={[
                        s.statusCapacitySlash,
                        { color: colors.textSecondary },
                      ]}
                    >
                      /{shift.capacity}
                    </Text>
                  </Text>
                  <Text
                    style={[
                      s.statusCapacityLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Volunteers
                  </Text>
                </View>
                <View style={s.statusDivider} />
                <View style={s.statusBrowsingMid}>
                  <Text
                    style={[
                      s.statusSpotsNumber,
                      {
                        color: isFull
                          ? colors.destructive
                          : isUrgent
                          ? "#c2410c"
                          : colors.text,
                      },
                    ]}
                  >
                    {isFull ? "Full" : spotsLeft}
                  </Text>
                  <Text
                    style={[
                      s.statusCapacityLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {isFull
                      ? "Join waitlist"
                      : isUrgent
                      ? "Spots left"
                      : "Open spots"}
                  </Text>
                </View>
                <View style={s.statusDivider} />
                <View style={s.statusBrowsingMid}>
                  <Text style={[s.statusSpotsNumber, { color: colors.text }]}>
                    {duration}
                  </Text>
                  <Text
                    style={[
                      s.statusCapacityLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Duration
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ═══ Friends this session ═══ */}
        {(friendsOnYourShift.length > 0 || friendsInSession.length > 0) &&
          !checkedIn && (
            <FriendsSection
              onYourShift={friendsOnYourShift}
              sameSession={friendsInSession}
              colors={colors}
              isDark={isDark}
            />
          )}

        {/* ═══ Check-in CTA ═══ */}
        {isMyShift && shift.status === "CONFIRMED" && !checkedIn && !isCompleted && (
          <View style={s.ctaWrap}>
            <GlassButton
              onPress={handleCheckIn}
              isDark={isDark}
              tintColor="rgba(14,58,35,0.55)"
              androidBg={Brand.green}
              accessibilityLabel="Check in to shift"
            >
              <Ionicons name="checkmark-circle" size={18} color="#fffdf7" />
              <Text style={s.glassCtaText}>Check in to your shift</Text>
            </GlassButton>
          </View>
        )}

        {/* ═══ Checked-in banner ═══ */}
        {checkedIn && (
          <View
            style={[
              s.checkedBanner,
              { backgroundColor: isDark ? "rgba(34,197,94,0.1)" : "#f0fdf4" },
            ]}
          >
            <View style={s.checkedBannerIcon}>
              <Ionicons name="checkmark" size={22} color={Brand.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  s.checkedBannerTitle,
                  { color: isDark ? "#86efac" : Brand.green },
                ]}
              >
                Ka pai! You&apos;re checked in
              </Text>
              <Text
                style={[
                  s.checkedBannerSubtitle,
                  { color: isDark ? "#86efac" : Brand.green },
                ]}
              >
                Have a brilliant shift.
              </Text>
            </View>
          </View>
        )}

        {/* ═══ Crew (post check-in) ═══ */}
        {checkedIn && (
          <CrewSection
            crew={shiftCrew}
            friendSignupIds={yourShiftFriendIds}
            colors={colors}
            isDark={isDark}
          />
        )}

        {/* ═══ Shift Photos (post check-in) ═══ */}
        {checkedIn && (
          <Section
            label="THE MOMENTS"
            title="Shift photos"
            caption="Share a snap from today's mahi"
            colors={colors}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.photoScroll}
            >
              <Pressable
                onPress={handleAddPhoto}
                style={({ pressed }) => [
                  s.addPhotoButton,
                  {
                    borderColor: isDark ? "rgba(255,255,255,0.1)" : "#e4ddd0",
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "#fdfaf2",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="camera-outline" size={24} color={accent} />
                <Text style={[s.addPhotoText, { color: accent }]}>Add</Text>
              </Pressable>
              {photos.map((uri, index) => (
                <View key={uri} style={s.photoThumb}>
                  <Image
                    source={{ uri }}
                    style={s.photoImage}
                    contentFit="cover"
                  />
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPhotos((prev) => prev.filter((_, i) => i !== index));
                    }}
                    style={({ pressed }) => [
                      s.photoRemove,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Ionicons name="close-circle" size={22} color="#ffffff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </Section>
        )}

        {/* ═══ Music Queue (post check-in) ═══ */}
        {checkedIn && (
          <Section
            label="ON ROTATION"
            title="Music queue"
            caption="Request songs for the BOH speaker"
            colors={colors}
          >
            <View style={s.musicRow}>
              <View
                style={[
                  s.musicInputWrap,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.04)"
                      : "#fdfaf2",
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e4ddd0",
                  },
                ]}
              >
                <Ionicons
                  name="search"
                  size={16}
                  color={colors.textSecondary}
                />
                <TextInput
                  style={[
                    s.musicInput,
                    { color: colors.text, fontFamily: FontFamily.regular },
                  ]}
                  value={musicSearch}
                  onChangeText={setMusicSearch}
                  placeholder="Add a song to the queue..."
                  placeholderTextColor={colors.textSecondary}
                  onSubmitEditing={handleAddSong}
                  returnKeyType="send"
                />
              </View>
              <Pressable
                onPress={handleAddSong}
                disabled={!musicSearch.trim()}
                style={({ pressed }) => [
                  s.addSongButton,
                  {
                    backgroundColor: musicSearch.trim()
                      ? Brand.green
                      : isDark
                      ? "rgba(255,255,255,0.06)"
                      : "#e4ddd0",
                    opacity: pressed && musicSearch.trim() ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons
                  name="add"
                  size={22}
                  color={
                    musicSearch.trim() ? Brand.accent : colors.textSecondary
                  }
                />
              </Pressable>
            </View>

            {queue.map((item, index) => (
              <View
                key={item.id}
                style={[
                  s.queueItem,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "#fdfaf2",
                  },
                ]}
              >
                <Text
                  style={[s.queueRankText, { color: colors.textSecondary }]}
                >
                  {String(index + 1).padStart(2, "0")}
                </Text>
                <View style={s.songInfo}>
                  <Text
                    style={[s.songTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text style={[s.songMeta, { color: colors.textSecondary }]}>
                    {item.artist} · {item.requestedBy}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleVote(item.id)}
                  style={({ pressed }) => [
                    s.voteButton,
                    {
                      borderColor: votedSongs.has(item.id)
                        ? accent
                        : isDark
                        ? "rgba(255,255,255,0.08)"
                        : "#e4ddd0",
                      backgroundColor: votedSongs.has(item.id)
                        ? isDark
                          ? theme.bgDark
                          : theme.bgLight
                        : "transparent",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={votedSongs.has(item.id) ? "heart" : "heart-outline"}
                    size={14}
                    color={
                      votedSongs.has(item.id) ? accent : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      s.voteCount,
                      { color: votedSongs.has(item.id) ? accent : colors.text },
                    ]}
                  >
                    {item.votes}
                  </Text>
                </Pressable>
              </View>
            ))}
          </Section>
        )}

        {/* ═══ Cancel signup ═══ */}
        {isMyShift && !checkedIn && !isCompleted && (
          <Pressable
            onPress={handleCancel}
            disabled={cancelLoading}
            style={({ pressed }) => [
              s.cancelButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
            accessibilityLabel="Cancel shift signup"
          >
            {cancelLoading ? (
              <RNActivityIndicator size="small" color={colors.destructive} />
            ) : (
              <Text style={[s.cancelText, { color: colors.destructive }]}>
                Cancel this signup
              </Text>
            )}
          </Pressable>
        )}
      </ScrollView>

      {/* ═══ Floating CTA — liquid glass action pinned to bottom ═══ */}
      {showFloatingCta && (
        <View
          style={[
            s.floatingCta,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
          pointerEvents="box-none"
        >
          {isPast ? (
            <View
              style={[
                s.pastPill,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={18}
                color={colors.textSecondary}
              />
              <Text style={[s.pastPillText, { color: colors.textSecondary }]}>
                This shift was in the past
              </Text>
            </View>
          ) : spotsLeft > 0 ? (
            <GlassButton
              onPress={() => openSignupSheet(false)}
              isDark={isDark}
              tintColor="rgba(14,58,35,0.8)"
              androidBg={Brand.green}
              accessibilityLabel="Sign up for shift"
            >
              <Text style={s.glassCtaText}>Join this shift</Text>
              <Ionicons name="arrow-forward" size={18} color="#fffdf7" />
            </GlassButton>
          ) : (
            <GlassButton
              onPress={() => openSignupSheet(true)}
              isDark={isDark}
              tintColor="rgba(194,65,12,0.8)"
              androidBg={isDark ? "#92400e" : "#c2410c"}
              accessibilityLabel="Join shift waitlist"
            >
              <Ionicons name="list-outline" size={18} color="#fffdf7" />
              <Text style={s.glassCtaText}>Join the waitlist</Text>
            </GlassButton>
          )}
        </View>
      )}

      {/* ═══ Signup Sheet ═══ */}
      {shift && (
        <ShiftSignupSheet
          visible={signupSheetVisible}
          onClose={() => setSignupSheetVisible(false)}
          onSuccess={handleSignupSuccess}
          shift={shift}
          isWaitlist={signupSheetWaitlist}
          formatDate={formatNZT}
        />
      )}
    </View>
  );
}

/* ═════════════════════════════════════════════════════════
   FRIENDS SECTION — horizontal "ensemble" cards
   ═════════════════════════════════════════════════════════ */

function FriendsSection({
  onYourShift,
  sameSession,
  colors,
  isDark,
}: {
  onYourShift: PeriodFriend[];
  sameSession: PeriodFriend[];
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  const total = onYourShift.length + sameSession.length;

  return (
    <View style={s.section}>
      <SectionHeader
        label=""
        title={`${total} friend${total !== 1 ? "s" : ""} on this shift`}
        caption={""}
        colors={colors}
      />

      {onYourShift.length > 0 && (
        <View style={s.friendsGroup}>
          <View style={s.friendsGroupHead}>
            <Text
              style={[s.friendsGroupLabel, { color: colors.textSecondary }]}
            >
              SAME ROLE
            </Text>
            <Text
              style={[s.friendsGroupCount, { color: colors.textSecondary }]}
            >
              {String(onYourShift.length).padStart(2, "0")}
            </Text>
          </View>
          <View style={s.friendsList}>
            {onYourShift.map((f) => (
              <FriendRow
                key={f.id}
                friend={f}
                isDark={isDark}
                colors={colors}
                alongside
              />
            ))}
          </View>
        </View>
      )}

      {sameSession.length > 0 && (
        <View style={s.friendsGroup}>
          <View style={s.friendsGroupHead}>
            <Text
              style={[s.friendsGroupLabel, { color: colors.textSecondary }]}
            >
              SAME SHIFT
            </Text>
            <Text
              style={[s.friendsGroupCount, { color: colors.textSecondary }]}
            >
              {String(sameSession.length).padStart(2, "0")}
            </Text>
          </View>
          <View style={s.friendsList}>
            {sameSession.map((f) => (
              <FriendRow
                key={f.id}
                friend={f}
                isDark={isDark}
                colors={colors}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function FriendStackAvatar({
  friend,
  index,
  isDark,
}: {
  friend: PeriodFriend;
  index: number;
  isDark: boolean;
}) {
  const initial = friend.name.charAt(0).toUpperCase();
  const roleTheme = friend.shiftTypeName
    ? getShiftThemeByName(friend.shiftTypeName)
    : null;
  const roleBg = roleTheme
    ? isDark
      ? roleTheme.bgDark
      : roleTheme.bgLight
    : isDark
    ? "rgba(14,58,35,0.3)"
    : "#e8f5e8";
  const roleInk = roleTheme
    ? isDark
      ? roleTheme.colorDark
      : roleTheme.color
    : Brand.green;

  const borderColor = isDark ? "#0f1114" : Brand.warmWhite;

  return (
    <View
      style={[
        s.friendsStackItem,
        {
          marginLeft: index === 0 ? 0 : -12,
          borderColor,
          zIndex: 10 - index,
        },
      ]}
    >
      {friend.profilePhotoUrl ? (
        <Image
          source={{ uri: friend.profilePhotoUrl }}
          style={s.friendsStackImg}
          contentFit="cover"
        />
      ) : (
        <View style={[s.friendsStackFallback, { backgroundColor: roleBg }]}>
          <Text style={[s.friendsStackInitial, { color: roleInk }]}>
            {initial}
          </Text>
        </View>
      )}
    </View>
  );
}

function FriendRow({
  friend,
  isDark,
  colors,
  alongside = false,
}: {
  friend: PeriodFriend;
  isDark: boolean;
  colors: (typeof Colors)["light"];
  alongside?: boolean;
}) {
  const initial = friend.name.charAt(0).toUpperCase();
  const roleTheme = friend.shiftTypeName
    ? getShiftThemeByName(friend.shiftTypeName)
    : null;
  const roleAccent = roleTheme
    ? isDark
      ? roleTheme.colorDark
      : roleTheme.color
    : Brand.green;
  const roleBg = roleTheme
    ? isDark
      ? roleTheme.bgDark
      : roleTheme.bgLight
    : isDark
    ? "rgba(14,58,35,0.3)"
    : "#e8f5e8";

  return (
    <View style={s.friendRow}>
      {/* Avatar with role tint */}
      <View style={s.friendRowAvatar}>
        {friend.profilePhotoUrl ? (
          <Image
            source={{ uri: friend.profilePhotoUrl }}
            style={s.friendRowAvatarImg}
            contentFit="cover"
          />
        ) : (
          <View
            style={[s.friendRowAvatarFallback, { backgroundColor: roleBg }]}
          >
            <Text style={[s.friendRowInitial, { color: roleAccent }]}>
              {initial}
            </Text>
          </View>
        )}
      </View>

      {/* Name + role */}
      <View style={s.friendRowBody}>
        <Text
          style={[s.friendRowName, { color: colors.text }]}
          numberOfLines={1}
        >
          {friend.name}
        </Text>
        {friend.shiftTypeName && (
          <View style={s.friendRowRole}>
            <View
              style={[s.friendRowRoleDot, { backgroundColor: roleAccent }]}
            />
            <Text
              style={[s.friendRowRoleText, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {friend.shiftTypeName}
            </Text>
          </View>
        )}
      </View>

      {/* Right-edge marker */}
      {alongside ? (
        <View style={[s.friendRowMarker, { backgroundColor: Brand.accent }]}>
          <Ionicons name="checkmark" size={12} color={Brand.green} />
        </View>
      ) : (
        roleTheme && (
          <View
            style={[
              s.friendRowEmojiChip,
              { backgroundColor: roleBg, borderColor: roleAccent + "33" },
            ]}
          >
            <Text style={s.friendRowEmoji}>{roleTheme.emoji}</Text>
          </View>
        )
      )}
    </View>
  );
}

/* ═════════════════════════════════════════════════════════
   GENERIC SECTION SHELL
   ═════════════════════════════════════════════════════════ */

function SectionHeader({
  label,
  title,
  caption,
  colors,
}: {
  label?: string;
  title: string;
  caption?: string;
  colors: (typeof Colors)["light"];
}) {
  return (
    <View style={s.sectionHeaderBlock}>
      {label ? (
        <View style={s.sectionOverlineRow}>
          <View
            style={[s.sectionOverlineDot, { backgroundColor: Brand.accent }]}
          />
          <Text style={[s.sectionOverline, { color: colors.textSecondary }]}>
            {label}
          </Text>
        </View>
      ) : null}
      <Text style={[s.sectionTitle, { color: colors.text }]}>{title}</Text>
      {caption ? (
        <Text style={[s.sectionCaption, { color: colors.textSecondary }]}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

function Section({
  label,
  title,
  caption,
  colors,
  children,
}: {
  label: string;
  title: string;
  caption?: string;
  colors: (typeof Colors)["light"];
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <SectionHeader
        label={label}
        title={title}
        caption={caption}
        colors={colors}
      />
      {children}
    </View>
  );
}

/* ═════════════════════════════════════════════════════════
   CREW SECTION (post check-in)
   ═════════════════════════════════════════════════════════ */

const GRADE_COLORS: Record<string, string> = {
  GREEN: "#22c55e",
  YELLOW: "#eab308",
  PINK: "#ec4899",
};

function CrewSection({
  crew,
  friendSignupIds,
  colors,
  isDark,
}: {
  crew: {
    id: string;
    name: string;
    role: string;
    grade: string;
    checkedIn: boolean;
    isYou?: boolean;
  }[];
  friendSignupIds: Set<string>;
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  if (!crew || crew.length === 0) return null;

  const checkedInCount = crew.filter((m) => m.checkedIn).length;

  function getDisplayName(member: (typeof crew)[0]): string {
    if (member.isYou) return member.name;
    if (friendSignupIds.has(member.id)) return member.name;
    return member.name.split(" ")[0];
  }

  return (
    <View style={s.section}>
      <SectionHeader
        label="THE CREW"
        title="Shift whānau"
        caption={`${checkedInCount} of ${crew.length} checked in`}
        colors={colors}
      />

      {crew.map((member) => {
        const gradeColor = GRADE_COLORS[member.grade];
        const isFriend = friendSignupIds.has(member.id);
        const displayName = getDisplayName(member);
        return (
          <View
            key={member.id}
            style={[
              s.memberRow,
              {
                backgroundColor: member.checkedIn
                  ? isDark
                    ? "rgba(34,197,94,0.06)"
                    : "#f0fdf4"
                  : isDark
                  ? "rgba(255,255,255,0.02)"
                  : "#fdfaf2",
              },
            ]}
          >
            <View
              style={[s.memberAvatar, { backgroundColor: gradeColor + "18" }]}
            >
              <Text style={[s.memberInitial, { color: gradeColor }]}>
                {member.name.charAt(0)}
              </Text>
              <View style={[s.gradeRing, { borderColor: gradeColor }]} />
            </View>
            <View style={s.memberInfo}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={[s.memberName, { color: colors.text }]}>
                  {displayName}
                  {member.isYou && (
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontFamily: FontFamily.regular,
                      }}
                    >
                      {" "}
                      (you)
                    </Text>
                  )}
                </Text>
                {isFriend && !member.isYou && (
                  <View
                    style={[
                      s.friendTag,
                      {
                        backgroundColor: isDark
                          ? "rgba(22,163,74,0.12)"
                          : "#dcfce7",
                      },
                    ]}
                  >
                    <Ionicons
                      name="heart"
                      size={8}
                      color={isDark ? "#86efac" : "#16a34a"}
                    />
                  </View>
                )}
              </View>
              <Text style={[s.memberRole, { color: colors.textSecondary }]}>
                {member.role}
              </Text>
            </View>
            {member.checkedIn ? (
              <View
                style={[
                  s.checkedInDot,
                  {
                    backgroundColor: isDark ? "rgba(34,197,94,0.2)" : "#dcfce7",
                  },
                ]}
              >
                <Ionicons
                  name="checkmark"
                  size={12}
                  color={isDark ? "#86efac" : "#16a34a"}
                />
              </View>
            ) : (
              <View
                style={[
                  s.awaitingDot,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.04)"
                      : "#f1ede4",
                  },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={12}
                  color={colors.textSecondary}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/* ═════════════════════════════════════════════════════════
   STYLES
   ═════════════════════════════════════════════════════════ */

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 48, gap: 20 },
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
    borderRadius: 14,
  },
  backButtonText: {
    color: "#fffdf7",
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },

  /* ── HERO ── */
  hero: {
    minHeight: 460,
    paddingTop: 140,
    paddingBottom: 48,
    overflow: "hidden",
    backgroundColor: Brand.green,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBody: {
    position: "relative",
    paddingHorizontal: 24,
    gap: 14,
  },
  heroOverlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroOverlineRule: {
    width: 18,
    height: 1,
    backgroundColor: "rgba(248,251,105,0.6)",
  },
  heroOverline: {
    color: Brand.accent,
    fontSize: 10.5,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#fffdf7",
    fontSize: 40,
    lineHeight: 44,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.8,
    marginTop: 2,
  },
  heroDescription: {
    color: "rgba(255,253,247,0.78)",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FontFamily.regular,
    marginTop: -2,
    maxWidth: 420,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 14,
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,253,247,0.25)",
  },
  heroMetaCol: {
    flex: 1,
    gap: 3,
  },
  heroMetaLabel: {
    color: "rgba(248,251,105,0.8)",
    fontSize: 9.5,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1.8,
  },
  heroMetaValue: {
    color: "#fffdf7",
    fontSize: 17,
    lineHeight: 21,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.2,
  },
  heroMetaValueSmall: {
    fontSize: 12,
    letterSpacing: 0,
  },
  heroMetaLink: {
    textDecorationLine: "underline",
    textDecorationColor: "rgba(255,253,247,0.35)",
  },
  heroMetaRule: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,253,247,0.25)",
  },

  /* ── STATUS STRIP (bridges hero + content) ── */
  statusStripWrap: {
    paddingHorizontal: 16,
    marginTop: -46,
    marginBottom: -4,
  },
  statusStrip: {
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  statusConfirmed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  statusConfirmedBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Brand.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  statusConfirmedTitle: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
  statusConfirmedMeta: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    marginTop: 2,
  },
  statusPastChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPastChipText: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    letterSpacing: 1.2,
  },
  statusBrowsing: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBrowsingLeft: {
    flex: 1,
    gap: 2,
    alignItems: "center",
  },
  statusBrowsingMid: {
    flex: 1,
    gap: 2,
    alignItems: "center",
  },
  statusDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: "rgba(128,128,128,0.22)",
    marginHorizontal: 4,
  },
  statusCapacityNumber: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.8,
  },
  statusCapacitySlash: {
    fontSize: 16,
    fontFamily: FontFamily.heading,
  },
  statusSpotsNumber: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.4,
  },
  statusCapacityLabel: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  /* ── NOTES ── */
  notesText: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: FontFamily.regular,
  },

  /* ── SECTION SHELL ── */
  section: {
    paddingHorizontal: 20,
    gap: 14,
  },
  sectionHeaderBlock: {
    gap: 4,
  },
  sectionOverlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionOverlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionOverline: {
    fontSize: 10.5,
    fontFamily: FontFamily.bold,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.4,
  },
  sectionCaption: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FontFamily.regular,
  },

  /* ── FRIENDS ── */
  friendsStackRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 2,
  },
  friendsStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  friendsStackItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    overflow: "hidden",
  },
  friendsStackImg: {
    width: "100%",
    height: "100%",
  },
  friendsStackFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  friendsStackInitial: {
    fontSize: 15,
    fontFamily: FontFamily.headingBold,
  },
  friendsStackMore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    marginLeft: -12,
    alignItems: "center",
    justifyContent: "center",
  },
  friendsStackMoreText: {
    fontSize: 12,
    fontFamily: FontFamily.bold,
  },

  friendsGroup: {
    gap: 6,
    marginTop: 10,
  },
  friendsGroupHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  friendsGroupRule: {
    width: 12,
    height: 1,
    backgroundColor: "rgba(128,128,128,0.4)",
  },
  friendsGroupLabel: {
    flex: 1,
    fontSize: 10,
    fontFamily: FontFamily.bold,
    letterSpacing: 1.8,
  },
  friendsGroupCount: {
    fontSize: 12,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.3,
  },
  friendsList: {
    gap: 2,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 10,
  },
  friendRowAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
  },
  friendRowAvatarImg: {
    width: "100%",
    height: "100%",
  },
  friendRowAvatarFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  friendRowInitial: {
    fontSize: 18,
    fontFamily: FontFamily.headingBold,
  },
  friendRowBody: {
    flex: 1,
    gap: 3,
  },
  friendRowName: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.2,
  },
  friendRowRole: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  friendRowRoleDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  friendRowRoleText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    fontFamily: FontFamily.medium,
  },
  friendRowMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  friendRowEmojiChip: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  friendRowEmoji: {
    fontSize: 18,
  },

  /* ── GLASS CTA ── */
  ctaWrap: {
    paddingHorizontal: 20,
  },
  glassCtaText: {
    color: "#fffdf7",
    fontFamily: FontFamily.bold,
    fontSize: 16,
    letterSpacing: -0.1,
  },

  /* ── FLOATING CTA ── */
  floatingCta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  pastPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pastPillText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    letterSpacing: -0.1,
  },

  /* ── CHECKED-IN BANNER ── */
  checkedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.2)",
  },
  checkedBannerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Brand.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  checkedBannerTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  checkedBannerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    opacity: 0.75,
    marginTop: 1,
  },

  /* ── CANCEL LINK ── */
  cancelButton: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    textDecorationLine: "underline",
  },

  /* ── CREW ── */
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    gap: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  memberInitial: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
  },
  gradeRing: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    opacity: 0.3,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
  memberRole: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
  checkedInDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  awaitingDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  friendTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },

  /* ── PHOTOS ── */
  photoScroll: { gap: 10, paddingVertical: 2 },
  addPhotoButton: {
    width: 108,
    height: 108,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addPhotoText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.3,
  },
  photoThumb: {
    width: 108,
    height: 108,
    borderRadius: 16,
    overflow: "hidden",
  },
  photoImage: { width: "100%", height: "100%" },
  photoRemove: { position: "absolute", top: 4, right: 4 },

  /* ── MUSIC QUEUE ── */
  musicRow: {
    flexDirection: "row",
    gap: 8,
  },
  musicInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    minHeight: 46,
  },
  musicInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  addSongButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    gap: 14,
  },
  queueRankText: {
    fontSize: 20,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.5,
    width: 28,
  },
  songInfo: { flex: 1, gap: 2 },
  songTitle: {
    fontSize: 14.5,
    fontFamily: FontFamily.semiBold,
  },
  songMeta: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },
  voteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 34,
  },
  voteCount: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
  },
});
