import { useState, useCallback, useEffect, useMemo } from "react";
import {
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Share,
  Linking,
  View,
  Text,
  ActivityIndicator,
  ActivityIndicator as RNActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  useLocalSearchParams,
  useRouter,
  Stack,
  type Href,
} from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { differenceInMinutes } from "date-fns";
import { formatNZT } from "@/lib/dates";

import { ThemedText } from "@/components/themed-text";
import { Colors, Brand, FontFamily, Palette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useShiftDetail, type PeriodFriend } from "@/hooks/use-shift-detail";
import { useShifts } from "@/hooks/use-shifts";
import {
  findConflictingShift,
  getShiftPeriodLabel,
} from "@/lib/shift-eligibility";
import { api, ApiError } from "@/lib/api";
import {
  addShiftToCalendar,
  isCalendarSyncEnabled,
  removeShiftFromCalendar,
} from "@/lib/calendar-sync";
import { ShiftSignupSheet } from "@/components/shift-signup-sheet";
import { GlassButton } from "@/components/glass-button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getShiftThemeByName, getLocationMapsUrl } from "@/lib/dummy-data";
import { posthog } from "@/lib/posthog";

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
    periodFriends,
    eligibility,
    isLoading,
    error,
    refresh,
  } = useShiftDetail(id);
  // Cached from the shifts list (react-query) — used to mirror the web's
  // pre-emptive "one Day + one Evening shift per day" conflict gate.
  const { myShifts } = useShifts();
  const isMyShift = shift?.status != null;
  const conflictingShift = useMemo(
    () => (shift && !isMyShift ? findConflictingShift(shift, myShifts) : null),
    [shift, isMyShift, myShifts]
  );
  const [signupSheetVisible, setSignupSheetVisible] = useState(false);
  const [signupSheetWaitlist, setSignupSheetWaitlist] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    if (!shift || isLoading) return;
    posthog?.capture("shift_viewed", {
      shift_id: shift.id,
      shift_type: shift.shiftType.name,
      location: shift.location,
      spots_left: shift.capacity - shift.signedUp,
      is_full: shift.signedUp >= shift.capacity,
      is_my_shift: shift.status != null,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift?.id]);

  const openSignupSheet = useCallback((waitlist = false) => {
    setSignupSheetWaitlist(waitlist);
    setSignupSheetVisible(true);
    posthog?.capture("shift_signup_started", {
      shift_id: shift?.id ?? null,
      shift_type: shift?.shiftType.name ?? null,
      is_waitlist: waitlist,
    });
  }, [shift]);

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
      if (result.status === "WAITLISTED") {
        posthog?.capture("shift_waitlist_joined", {
          shift_id: shift?.id ?? null,
          shift_type: shift?.shiftType.name ?? null,
        });
      } else {
        posthog?.capture("shift_signup_completed", {
          shift_id: shift?.id ?? null,
          shift_type: shift?.shiftType.name ?? null,
          status: result.status,
          auto_approved: result.autoApproved,
        });
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
              posthog?.capture("shift_signup_cancelled", {
                shift_id: shift.id,
                shift_type: shift.shiftType.name,
              });
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

  // Split period friends into "on your shift" vs "same session, different role".
  // The shift detail signups list contains every active signup (friends, public,
  // and strangers), so intersecting it with periodFriends correctly identifies
  // which periodFriends are on this exact shift — including PUBLIC users.
  const thisShiftSignupIds = useMemo(
    () => new Set(shiftSignups.map((su) => su.id)),
    [shiftSignups]
  );
  const thisShiftName = shift?.shiftType.name;
  const visibleOnYourShift = useMemo(
    () =>
      periodFriends.filter(
        (f) => thisShiftSignupIds.has(f.id) || f.shiftTypeName === thisShiftName
      ),
    [periodFriends, thisShiftSignupIds, thisShiftName]
  );
  const friendsInSession = useMemo(
    () =>
      periodFriends.filter(
        (f) =>
          !thisShiftSignupIds.has(f.id) && f.shiftTypeName !== thisShiftName
      ),
    [periodFriends, thisShiftSignupIds, thisShiftName]
  );
  // Count of volunteers on this shift who aren't visible to the current user
  // (i.e. PRIVATE / FRIENDS_ONLY non-friends). shiftSignups includes "You" if
  // the current user is signed up, so subtract that too.
  const selfInList = isMyShift ? 1 : 0;
  const otherVolunteersCount = Math.max(
    0,
    shiftSignups.length - selfInList - visibleOnYourShift.length
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
                backgroundColor: isDark ? "rgba(255,255,255,0.05)" : colors.surfaceSoft,
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
  const duration = getDuration(shift.start, shift.end);
  const isPast = endDate.getTime() < Date.now();
  const isCompleted = isMyShift && shift.status === "CONFIRMED" && isPast;

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
      posthog?.capture("shift_shared", {
        shift_id: shift.id,
        shift_type: shift.shiftType.name,
        location: shift.location,
      });
    } catch {
      // User cancelled share
    }
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
          headerTintColor: Palette.cream50,
          headerRight: () => (
            <Ionicons
              name="share-outline"
              size={22}
              color={Palette.cream50}
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
              source={
                typeof theme.heroImage === "string"
                  ? { uri: theme.heroImage }
                  : theme.heroImage
              }
              style={s.heroImage}
              contentFit="cover"
            />
          )}

          {/* Layered gradient — faint top, atmospheric middle, solid-green pour at base */}
          <LinearGradient
            colors={[
              "rgba(14,42,28,0.25)",
              "rgba(14,42,28,0.55)",
              "rgba(14,42,28,0.9)",
              Palette.forest700,
            ]}
            locations={[0, 0.45, 0.82, 1]}
            style={s.heroGradient}
          />

          {/* Warm sun glow on the dark forest hero */}
          <View pointerEvents="none" style={s.heroGlow} />

          <View style={s.heroBody}>
            {/* Eyebrow kicker */}
            <Eyebrow color={Palette.sun200}>
              {isCompleted
                ? "Completed · Ngā mihi"
                : isMyShift
                ? "You're in the whānau"
                : "Ngā mahi · A shift"}
            </Eyebrow>

            {/* Display title — light editorial Fraunces */}
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
              { backgroundColor: colors.card },
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
                        : Palette.cream200,
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

        {/* ═══ Volunteers on this shift ═══ */}
        {(visibleOnYourShift.length > 0 ||
          friendsInSession.length > 0 ||
          otherVolunteersCount > 0) && (
          <VolunteersSection
            onYourShift={visibleOnYourShift}
            sameSession={friendsInSession}
            otherCount={otherVolunteersCount}
            colors={colors}
            isDark={isDark}
          />
        )}

        {/* ═══ Cancel signup ═══ */}
        {isMyShift && !isCompleted && (
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
            <BlockedPill
              icon="time-outline"
              label="This shift was in the past"
              tone="neutral"
              colors={colors}
              isDark={isDark}
            />
          ) : eligibility && !eligibility.emailVerified ? (
            <BlockedPill
              icon="mail-unread-outline"
              label="Verify your email to sign up"
              tone="warn"
              colors={colors}
              isDark={isDark}
            />
          ) : eligibility && eligibility.needsParentalConsent ? (
            <BlockedPill
              icon="shield-outline"
              label="Parental consent required to sign up"
              tone="warn"
              colors={colors}
              isDark={isDark}
            />
          ) : conflictingShift ? (
            <BlockedPill
              icon="calendar-outline"
              label={`You already have a ${getShiftPeriodLabel(
                shift.start
              )} shift that day`}
              tone="neutral"
              colors={colors}
              isDark={isDark}
            />
          ) : spotsLeft > 0 ? (
            <GlassButton
              onPress={() => openSignupSheet(false)}
              isDark={isDark}
              tintColor="rgba(29,83,55,0.85)"
              androidBg={Brand.green}
              accessibilityLabel="Sign up for shift"
            >
              <Text style={s.glassCtaText}>Join this shift</Text>
              <Ionicons name="arrow-forward" size={18} color={Palette.cream50} />
            </GlassButton>
          ) : (
            <GlassButton
              onPress={() => openSignupSheet(true)}
              isDark={isDark}
              tintColor="rgba(194,65,12,0.8)"
              androidBg={isDark ? "#92400e" : "#c2410c"}
              accessibilityLabel="Join shift waitlist"
            >
              <Ionicons name="list-outline" size={18} color={Palette.cream50} />
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
   VOLUNTEERS SECTION — who's joining this shift
   ═════════════════════════════════════════════════════════ */

function VolunteersSection({
  onYourShift,
  sameSession,
  otherCount,
  colors,
  isDark,
}: {
  onYourShift: PeriodFriend[];
  sameSession: PeriodFriend[];
  otherCount: number;
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  const totalOnShift = onYourShift.length + otherCount;
  const title =
    totalOnShift > 0
      ? `${totalOnShift} ${totalOnShift === 1 ? "volunteer" : "volunteers"} going`
      : "Volunteers";

  return (
    <View style={s.section}>
      <SectionHeader label="" title={title} caption="" colors={colors} />

      {onYourShift.length > 0 && (
        <View style={s.friendsList}>
          {onYourShift.map((f) => (
            <FriendRow
              key={f.id}
              friend={f}
              isDark={isDark}
              colors={colors}
              showFriendBadge={f.isFriend}
              hideRole
            />
          ))}
        </View>
      )}

      {otherCount > 0 && (
        <View
          style={[
            s.otherVolunteersRow,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.04)"
                : "rgba(29,83,55,0.05)",
            },
          ]}
        >
          <View
            style={[
              s.otherVolunteersBadge,
              {
                backgroundColor: isDark
                  ? "rgba(248,251,105,0.12)"
                  : "rgba(29,83,55,0.09)",
              },
            ]}
          >
            <Ionicons
              name="people-outline"
              size={18}
              color={isDark ? Brand.accent : Brand.green}
            />
          </View>
          <Text
            style={[s.otherVolunteersText, { color: colors.textSecondary }]}
          >
            {onYourShift.length > 0 ? "and " : ""}
            {otherCount} other {otherCount === 1 ? "volunteer" : "volunteers"}
          </Text>
        </View>
      )}

      {sameSession.length > 0 && (
        <View style={s.friendsGroup}>
          <View style={s.friendsGroupHead}>
            <Text
              style={[s.friendsGroupLabel, { color: colors.textSecondary }]}
            >
              ALSO IN THIS SESSION
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
    ? "rgba(29,83,55,0.3)"
    : Palette.forest100;
  const roleInk = roleTheme
    ? isDark
      ? roleTheme.colorDark
      : roleTheme.color
    : Brand.green;

  const borderColor = isDark ? Colors.dark.background : Brand.warmWhite;

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
  showFriendBadge = false,
  hideRole = false,
}: {
  friend: PeriodFriend;
  isDark: boolean;
  colors: (typeof Colors)["light"];
  /** When true, renders the "Friend" indicator on the right of the row. */
  showFriendBadge?: boolean;
  /** Hide the role label & chip (redundant when the row is for the current shift). */
  hideRole?: boolean;
}) {
  const router = useRouter();
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
    ? "rgba(29,83,55,0.3)"
    : Palette.forest100;

  const openProfile = () => {
    Haptics.selectionAsync();
    router.push(`/user/${friend.id}` as Href);
  };

  return (
    <Pressable
      onPress={openProfile}
      accessibilityLabel={`View ${friend.name}'s profile`}
      accessibilityRole="button"
      style={({ pressed }) => [s.friendRow, { opacity: pressed ? 0.7 : 1 }]}
    >
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
        {friend.shiftTypeName && !hideRole && (
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
      {showFriendBadge && friend.isFriend ? (
        <View
          style={[
            s.friendRowFriendChip,
            { backgroundColor: Brand.accent, borderColor: Brand.green + "22" },
          ]}
          accessibilityLabel="Friend"
        >
          <Ionicons name="heart" size={11} color={Brand.green} />
          <Text style={[s.friendRowFriendChipText, { color: Brand.green }]}>
            Friend
          </Text>
        </View>
      ) : (
        !hideRole &&
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
    </Pressable>
  );
}

/* ═════════════════════════════════════════════════════════
   BLOCKED CTA PILL — shown in place of the signup button when the
   user can't sign up (past shift, unverified email, parental consent,
   or a same-period clash). `warn` flags an account issue the user can act on.
   ═════════════════════════════════════════════════════════ */

function BlockedPill({
  icon,
  label,
  tone,
  colors,
  isDark,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone: "neutral" | "warn";
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  const warn = tone === "warn";
  const textColor = warn
    ? isDark
      ? "#fbbf24"
      : "#d97706"
    : colors.textSecondary;
  const backgroundColor = warn
    ? isDark
      ? "rgba(245,158,11,0.12)"
      : "#fffbeb"
    : colors.card;
  const borderColor = warn
    ? isDark
      ? "rgba(245,158,11,0.28)"
      : "#fde68a"
    : colors.border;

  return (
    <View style={[s.pastPill, { backgroundColor, borderColor }]}>
      <Ionicons name={icon} size={18} color={textColor} />
      <Text style={[s.pastPillText, { color: textColor }]}>{label}</Text>
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
    color: Palette.cream50,
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },

  /* ── HERO ── */
  hero: {
    minHeight: 460,
    paddingTop: 140,
    paddingBottom: 48,
    overflow: "hidden",
    backgroundColor: Palette.forest700,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGlow: {
    position: "absolute",
    bottom: -120,
    left: -60,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(248,251,105,0.1)",
  },
  heroBody: {
    position: "relative",
    paddingHorizontal: 24,
    gap: 14,
  },
  heroTitle: {
    color: Palette.cream50,
    fontSize: 44,
    lineHeight: 48,
    fontFamily: FontFamily.display,
    letterSpacing: -1,
    marginTop: 4,
  },
  heroDescription: {
    color: "rgba(253,248,239,0.8)",
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
    borderTopColor: "rgba(253,248,239,0.25)",
  },
  heroMetaCol: {
    flex: 1,
    gap: 3,
  },
  heroMetaLabel: {
    color: "rgba(248,251,105,0.85)",
    fontSize: 9.5,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1.8,
  },
  heroMetaValue: {
    color: Palette.cream50,
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
    textDecorationColor: "rgba(253,248,239,0.35)",
  },
  heroMetaRule: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(253,248,239,0.25)",
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
  friendRowFriendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  friendRowFriendChipText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.4,
  },
  otherVolunteersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginTop: 6,
  },
  otherVolunteersBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  otherVolunteersText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FontFamily.medium,
  },

  /* ── GLASS CTA ── */
  glassCtaText: {
    color: Palette.cream50,
    fontFamily: FontFamily.semiBold,
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

});
