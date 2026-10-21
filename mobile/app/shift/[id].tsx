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
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { isLiquidGlassAvailable } from "expo-glass-effect";
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
import {
  useShiftDetail,
  type PeriodFriend,
  type ShiftEvent,
} from "@/hooks/use-shift-detail";
import {
  countUnnamedVolunteers,
  normalizeSignupStatus,
  type SignupStatus,
} from "@/lib/signup-status";
import { openExternalLink } from "@/lib/external-links";
import {
  waitlistCountLabel,
  yourWaitlistStandingSentence,
} from "@/lib/waitlist";
import { useHomeShifts } from "@/hooks/use-shifts";
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
import { DayLeadsRow } from "@/components/day-leads-row";
import { WaitlistOfferCard } from "@/components/waitlist-offer-card";
import { GlassButton } from "@/components/glass-button";
import { StatusBarScrim } from "@/components/ui/status-bar-scrim";
import { getShiftThemeByName, getLocationMapsUrl } from "@/lib/dummy-data";
import { getShiftDescription } from "@/lib/shift-description";
import { posthog } from "@/lib/posthog";
import { goBackOrHome } from "@/lib/navigation";

type ThemeColors = (typeof Colors)["light"];

/** Height of the cover photo. The content sheet overlaps its bottom edge. */
const COVER_HEIGHT = 300;
const SHEET_OVERLAP = 28;
/** Above this many spots one segment per spot gets too thin to read. */
const MAX_SEAT_SEGMENTS = 24;

/* ── Duration Helper ── */

function getDuration(start: string, end: string): string {
  const mins = differenceInMinutes(new Date(end), new Date(start));
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

/** "5:30–8:30pm", or "11:30am–2pm" when the range crosses midday. */
function formatTimeRange(start: Date, end: Date): string {
  const time = (d: Date) =>
    formatNZT(d, formatNZT(d, "mm") === "00" ? "h" : "h:mm");
  const startPeriod = formatNZT(start, "a").toLowerCase();
  const endPeriod = formatNZT(end, "a").toLowerCase();
  return `${time(start)}${
    startPeriod === endPeriod ? "" : startPeriod
  }–${time(end)}${endPeriod}`;
}

/* ── Your signup status ──
   One place for how each signup state reads and looks, so the status panel
   and the cancel action never disagree about what the volunteer's spot
   actually is. Tones match the shift list and home hero (forest = confirmed,
   amber = awaiting an admin, slate = waitlist). */

const MY_STATUS: Record<
  SignupStatus,
  {
    title: string;
    /** What happens next, in the volunteer's terms. */
    meta: string | null;
    icon: keyof typeof Ionicons.glyphMap;
    badgeBg: string;
    badgeBgDark: string;
    iconColor: string;
    iconColorDark: string;
    cancelLabel: string;
    cancelPrompt: string;
    cancelBody: string;
  }
> = {
  CONFIRMED: {
    title: "You're going",
    meta: null,
    icon: "checkmark",
    badgeBg: Brand.accent,
    badgeBgDark: Brand.accent,
    iconColor: Brand.green,
    iconColorDark: Brand.green,
    cancelLabel: "Cancel my signup",
    cancelPrompt: "Cancel signup?",
    cancelBody: "Are you sure you want to cancel your signup for this shift?",
  },
  PENDING: {
    title: "Waiting on approval",
    meta: "We'll let you know once it's confirmed.",
    icon: "time",
    badgeBg: "#fef3c7",
    badgeBgDark: "rgba(245, 158, 11, 0.18)",
    iconColor: "#92400e",
    iconColorDark: "#fbbf24",
    cancelLabel: "Withdraw my request",
    cancelPrompt: "Withdraw request?",
    cancelBody: "Are you sure you want to withdraw your request for this shift?",
  },
  WAITLISTED: {
    title: "You're on the waitlist",
    meta: null,
    icon: "list",
    badgeBg: "#f1f5f9",
    badgeBgDark: "rgba(100, 116, 139, 0.25)",
    iconColor: "#475569",
    iconColorDark: "#cbd5e1",
    cancelLabel: "Leave the waitlist",
    cancelPrompt: "Leave the waitlist?",
    cancelBody: "Are you sure you want to leave the waitlist for this shift?",
  },
};

/* ── Main Screen ── */

export default function ShiftDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const {
    shift,
    signups: shiftSignups,
    waitlistCount,
    waitlistOfferExpiresAt,
    waitlistOfferExpiresLabel,
    events,
    dayLeads,
    periodFriends,
    eligibility,
    isLoading,
    error,
    refresh,
  } = useShiftDetail(id);
  // Cached from the shifts list (react-query) — used to mirror the web's
  // pre-emptive "one Day + one Evening shift per day" conflict gate. Uses the
  // home-scoped query: it carries the same complete `myShifts`, and reaching
  // this screen from home shouldn't trigger the Shifts tab's much larger fetch.
  const { myShifts } = useHomeShifts();
  const isMyShift = shift?.status != null;
  // What the volunteer actually holds: a confirmed spot, a request an admin
  // hasn't approved yet, or a waitlist place. Only CONFIRMED is a spot.
  const myStatus: SignupStatus | null = shift?.status
    ? normalizeSignupStatus(shift.status)
    : null;
  const statusUi = myStatus ? MY_STATUS[myStatus] : null;
  const conflictingShift = useMemo(
    () => (shift && !isMyShift ? findConflictingShift(shift, myShifts) : null),
    [shift, isMyShift, myShifts]
  );
  const [signupSheetVisible, setSignupSheetVisible] = useState(false);
  const [signupSheetWaitlist, setSignupSheetWaitlist] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  // Once the cover photo has scrolled away the header controls sit on paper,
  // so they (and the status bar) switch from light-on-photo to page colours.
  const [pastCover, setPastCover] = useState(false);
  const coverScrollThreshold = COVER_HEIGHT - SHEET_OVERLAP - insets.top - 44;
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = e.nativeEvent.contentOffset.y > coverScrollThreshold;
      setPastCover((prev) => (prev === next ? prev : next));
    },
    [coverScrollThreshold]
  );

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
    const copy = statusUi ?? MY_STATUS.CONFIRMED;
    Alert.alert(
      copy.cancelPrompt,
      copy.cancelBody,
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
              Alert.alert(
                "Canceled",
                myStatus === "PENDING"
                  ? "Your request has been withdrawn."
                  : myStatus === "WAITLISTED"
                  ? "You've been taken off the waitlist."
                  : "Your signup has been canceled."
              );
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
  }, [shift, refresh, statusUi, myStatus]);

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
  // Only confirmed volunteers are on the shift; the rest are still waiting on
  // an admin, so the two groups are counted and listed separately.
  const onShiftConfirmed = useMemo(
    () => visibleOnYourShift.filter((f) => f.status === "CONFIRMED"),
    [visibleOnYourShift]
  );
  const onShiftPending = useMemo(
    () => visibleOnYourShift.filter((f) => f.status === "PENDING"),
    [visibleOnYourShift]
  );
  // Counts of volunteers on this shift who aren't visible to the current user
  // (i.e. PRIVATE / FRIENDS_ONLY non-friends). shiftSignups includes "You" if
  // the current user is signed up, so subtract that too. Waitlisted signups
  // are left out of both counts - they don't have a place on the shift.
  const signupStatuses = useMemo(
    () => shiftSignups.map((su) => normalizeSignupStatus(su.status)),
    [shiftSignups]
  );
  const otherVolunteersCount = countUnnamedVolunteers({
    status: "CONFIRMED",
    signupStatuses,
    myStatus,
    namedCount: onShiftConfirmed.length,
  });
  const otherPendingCount = countUnnamedVolunteers({
    status: "PENDING",
    signupStatuses,
    myStatus,
    namedCount: onShiftPending.length,
  });

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
            style={[s.notFoundIcon, { backgroundColor: colors.surfaceSoft }]}
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
            It may have been removed.
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

  const date = new Date(shift.start);
  const endDate = new Date(shift.end);
  const spotsLeft = shift.capacity - shift.signedUp;
  const theme = getShiftThemeByName(shift.shiftType.name);
  const duration = getDuration(shift.start, shift.end);
  const isPast = endDate.getTime() < Date.now();
  const isCompleted = isMyShift && shift.status === "CONFIRMED" && isPast;
  const description = getShiftDescription(
    shift.notes,
    shift.shiftType.description
  );
  const hasOffer = Boolean(waitlistOfferExpiresAt) && !isPast;
  const hasTeam =
    Boolean(dayLeads && (dayLeads.chef || dayLeads.fohManager)) ||
    visibleOnYourShift.length > 0 ||
    friendsInSession.length > 0 ||
    otherVolunteersCount > 0 ||
    otherPendingCount > 0;
  // A past shift you weren't on has nothing left to decide, so it gets no
  // status panel; the bottom pill already says it has passed.
  const showStatus = !hasOffer && (isMyShift || !isPast);

  // On iOS 26 the header controls sit in liquid glass, which keeps the
  // system's own label colour over any photo; elsewhere they need light
  // glyphs until the photo has scrolled away.
  const headerTint =
    pastCover || isLiquidGlassAvailable() ? colors.text : Palette.cream50;

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
        } - ${dateStr}\n🕐 ${timeStr}\n📍 ${shift.location}\n\n${
          spotsLeft > 0
            ? `${spotsLeft} spots left - sign up and join the whānau!`
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: "",
          headerShown: true,
          headerTransparent: true,
          headerTintColor: headerTint,
          headerRight: () => (
            <Pressable
              onPress={handleShare}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Share this shift"
            >
              <Ionicons name="share-outline" size={22} color={headerTint} />
            </Pressable>
          ),
        }}
      />
      <StatusBar style={pastCover ? "auto" : "light"} />
      <ScrollView
        style={s.container}
        contentContainerStyle={[
          s.content,
          showFloatingCta && { paddingBottom: floatingCtaReserve + 16 },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ Cover ═══ */}
        <View style={s.cover}>
          <Image
            source={
              typeof theme.heroImage === "string"
                ? { uri: theme.heroImage }
                : theme.heroImage
            }
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
          {/* Keeps the status bar and header controls legible on bright photos */}
          <LinearGradient
            colors={["rgba(14,42,28,0.55)", "rgba(14,42,28,0)"]}
            style={s.coverScrim}
          />
        </View>

        <View style={[s.sheet, { backgroundColor: colors.background }]}>
          {/* ═══ What and when ═══ */}
          <View style={s.intro}>
            <Text
              style={[s.title, { color: colors.text }]}
              accessibilityRole="header"
            >
              {shift.shiftType.name}
            </Text>
            <View style={s.facts}>
              <FactRow icon="calendar-clear-outline" colors={colors}>
                <Text style={[s.factText, { color: colors.text }]}>
                  {formatNZT(date, "EEEE d MMMM")}
                </Text>
              </FactRow>
              <FactRow icon="time-outline" colors={colors}>
                <Text style={[s.factText, { color: colors.text }]}>
                  {formatTimeRange(date, endDate)}
                  <Text style={{ color: colors.textSecondary }}>
                    {"  "}
                    {duration}
                  </Text>
                </Text>
              </FactRow>
              <Pressable
                onPress={() =>
                  Linking.openURL(getLocationMapsUrl(shift.location))
                }
                hitSlop={{ top: 10, bottom: 10 }}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                accessibilityRole="link"
                accessibilityLabel={shift.location}
                accessibilityHint="Opens in Maps"
              >
                <FactRow icon="location-outline" colors={colors}>
                  <Text
                    style={[s.factText, s.factLink, { color: colors.tint }]}
                    numberOfLines={1}
                  >
                    {shift.location}
                  </Text>
                  <Ionicons
                    name="open-outline"
                    size={14}
                    color={colors.tint}
                  />
                </FactRow>
              </Pressable>
            </View>
          </View>

          {/* ═══ Can I go / where I stand ═══
              A waitlist offer replaces the panel: it is the volunteer's status,
              and the only thing on this screen with a deadline. */}
          {hasOffer && (
            <WaitlistOfferCard
              shiftId={shift.id}
              deadlineLabel={waitlistOfferExpiresLabel}
              onAnswered={refresh}
            />
          )}
          {showStatus && (
            <View style={[s.panel, { backgroundColor: colors.card }]}>
              {isCompleted ? (
                <MyStatusRow
                  icon="checkmark-done"
                  badgeBg={Brand.green}
                  iconColor={Brand.accent}
                  title="Ngā mihi!"
                  meta={`You gave ${duration} to this shift.`}
                  colors={colors}
                />
              ) : statusUi ? (
                <MyStatusRow
                  icon={statusUi.icon}
                  badgeBg={isDark ? statusUi.badgeBgDark : statusUi.badgeBg}
                  iconColor={isDark ? statusUi.iconColorDark : statusUi.iconColor}
                  title={statusUi.title}
                  meta={
                    isPast
                      ? "This shift has passed."
                      : myStatus === "WAITLISTED"
                      ? yourWaitlistStandingSentence(waitlistCount)
                      : statusUi.meta
                  }
                  colors={colors}
                />
              ) : (
                <SpotsMeter
                  capacity={shift.capacity}
                  signedUp={shift.signedUp}
                  waitlistCount={waitlistCount}
                  colors={colors}
                  isDark={isDark}
                />
              )}
            </View>
          )}

          {/* ═══ What it involves ═══ */}
          {description ? (
            <Text style={[s.description, { color: colors.text }]}>
              {description}
            </Text>
          ) : null}

          {/* ═══ Who's on ═══ */}
          {hasTeam && (
            <TeamSection
              dayLeads={dayLeads}
              onYourShift={onShiftConfirmed}
              pendingOnYourShift={onShiftPending}
              sameSession={friendsInSession}
              otherCount={otherVolunteersCount}
              otherPendingCount={otherPendingCount}
              colors={colors}
              isDark={isDark}
            />
          )}

          {/* ═══ Marketing events at this restaurant on the shift's day ═══ */}
          {events.length > 0 && (
            <EventsSection events={events} colors={colors} />
          )}

          {/* ═══ Cancel signup ═══ */}
          {isMyShift && !isCompleted && !isPast && (
            <Pressable
              onPress={handleCancel}
              disabled={cancelLoading}
              style={({ pressed }) => [
                s.cancelButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={statusUi?.cancelLabel ?? "Cancel my signup"}
            >
              {cancelLoading ? (
                <ActivityIndicator size="small" color={colors.destructive} />
              ) : (
                <Text style={[s.cancelText, { color: colors.destructive }]}>
                  {statusUi?.cancelLabel ?? "Cancel my signup"}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </ScrollView>

      {pastCover && <StatusBarScrim />}

      {/* ═══ Floating CTA — liquid glass action pinned to bottom ═══ */}
      {showFloatingCta && (
        <View
          style={[
            s.floatingCta,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
          pointerEvents="box-none"
        >
          {/* `eligibility.profileComplete` is intentionally not gated here:
              an incomplete profile is surfaced inside the signup sheet, where
              the message links straight to /profile/edit so the user can fix
              it in one tap. Email verification and parental consent aren't
              self-resolvable in-app, so they block up front instead. */}
          {isPast ? (
            <BlockedPill
              icon="time-outline"
              label="This shift has passed"
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
          waitlistCount={waitlistCount}
          formatDate={formatNZT}
          profileIncomplete={eligibility ? !eligibility.profileComplete : false}
          missingProfileFields={eligibility?.missingProfileFields}
          guardianRequired={eligibility?.guardianRequired ?? false}
        />
      )}
    </View>
  );
}

/* ═════════════════════════════════════════════════════════
   FACT ROW — one line of the what/when block, led by an icon
   ═════════════════════════════════════════════════════════ */

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
      {children}
    </View>
  );
}

/* ═════════════════════════════════════════════════════════
   SPOTS METER — one segment per spot, with the open spots lit up. The
   restaurant needs volunteers most when a shift is empty, so the meter is
   loudest then and quietens as it fills; a nearly full shift is never shown
   as urgent.
   ═════════════════════════════════════════════════════════ */

function SpotsMeter({
  capacity,
  signedUp,
  waitlistCount,
  colors,
  isDark,
}: {
  capacity: number;
  signedUp: number;
  waitlistCount: number;
  colors: ThemeColors;
  isDark: boolean;
}) {
  const open = Math.max(capacity - signedUp, 0);
  const isFull = open === 0;
  const filled = Math.min(signedUp, capacity);
  const takenColor = isDark
    ? "rgba(253,248,239,0.12)"
    : "rgba(29,83,55,0.12)";

  const headline = isFull
    ? "Full"
    : `${open} ${open === 1 ? "spot" : "spots"} open`;
  const detail = isFull
    ? waitlistCount > 0
      ? waitlistCountLabel(waitlistCount)
      : "Waitlist open"
    : `${filled} of ${capacity} filled`;

  return (
    <View
      style={s.meter}
      accessible
      accessibilityLabel={`${headline}, ${detail}`}
    >
      <View style={s.meterHead}>
        <Text
          style={[
            s.meterHeadline,
            { color: isFull ? colors.text : colors.tint },
          ]}
        >
          {headline}
        </Text>
        <Text style={[s.meterDetail, { color: colors.textSecondary }]}>
          {detail}
        </Text>
      </View>
      {capacity > 0 && capacity <= MAX_SEAT_SEGMENTS ? (
        <View style={s.seats}>
          {Array.from({ length: capacity }, (_, i) => (
            <View
              key={i}
              style={[
                s.seat,
                { backgroundColor: i < open ? colors.tint : takenColor },
              ]}
            />
          ))}
        </View>
      ) : capacity > 0 ? (
        <View style={[s.bar, { backgroundColor: takenColor }]}>
          <View
            style={[
              s.barFill,
              {
                backgroundColor: colors.tint,
                width: `${(open / capacity) * 100}%`,
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

function MyStatusRow({
  icon,
  badgeBg,
  iconColor,
  title,
  meta,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  badgeBg: string;
  iconColor: string;
  title: string;
  meta: string | null;
  colors: ThemeColors;
}) {
  return (
    <View style={s.myStatus}>
      <View style={[s.myStatusBadge, { backgroundColor: badgeBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.myStatusTitle, { color: colors.text }]}>{title}</Text>
        {meta ? (
          <Text style={[s.myStatusMeta, { color: colors.textSecondary }]}>
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* ═════════════════════════════════════════════════════════
   TEAM — who's running the day and who's on this shift
   ═════════════════════════════════════════════════════════ */

function TeamSection({
  dayLeads,
  onYourShift,
  pendingOnYourShift,
  sameSession,
  otherCount,
  otherPendingCount,
  colors,
  isDark,
}: {
  dayLeads: React.ComponentProps<typeof DayLeadsRow>["leads"];
  /** Confirmed volunteers on this shift, visible to the current user. */
  onYourShift: PeriodFriend[];
  /** Visible volunteers on this shift still waiting on an admin. */
  pendingOnYourShift: PeriodFriend[];
  sameSession: PeriodFriend[];
  otherCount: number;
  otherPendingCount: number;
  colors: ThemeColors;
  isDark: boolean;
}) {
  const totalGoing = onYourShift.length + otherCount;
  const totalPending = pendingOnYourShift.length + otherPendingCount;

  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text
          style={[s.sectionTitle, { color: colors.text }]}
          accessibilityRole="header"
        >
          Who&apos;s on
        </Text>
        {totalGoing > 0 && (
          <Text style={[s.sectionMeta, { color: colors.textSecondary }]}>
            {totalGoing} going
          </Text>
        )}
      </View>

      <DayLeadsRow
        leads={dayLeads}
        variant="card"
        isDark={isDark}
        testID="shift-day-leads"
      />

      {totalGoing > 0 && (
        <PeopleGroup
          people={onYourShift}
          othersCount={otherCount}
          colors={colors}
          isDark={isDark}
        />
      )}

      {/* Requests an admin hasn't approved yet - held apart from the people
          going so nobody reads a pending signup as a confirmed spot. */}
      {totalPending > 0 && (
        <View style={s.subgroup}>
          <Text style={[s.subgroupLabel, { color: colors.textSecondary }]}>
            Awaiting approval
          </Text>
          <PeopleGroup
            people={pendingOnYourShift}
            othersCount={otherPendingCount}
            colors={colors}
            isDark={isDark}
          />
        </View>
      )}

      {sameSession.length > 0 && (
        <View style={s.subgroup}>
          <Text style={[s.subgroupLabel, { color: colors.textSecondary }]}>
            On other roles that session
          </Text>
          <PeopleGroup
            people={sameSession}
            othersCount={0}
            showRole
            colors={colors}
            isDark={isDark}
          />
        </View>
      )}
    </View>
  );
}

/** A grouped list of people, closed off with a count of anyone not named. */
function PeopleGroup({
  people,
  othersCount,
  showRole = false,
  colors,
  isDark,
}: {
  people: PeriodFriend[];
  othersCount: number;
  showRole?: boolean;
  colors: ThemeColors;
  isDark: boolean;
}) {
  const others =
    people.length > 0
      ? `${othersCount} more ${othersCount === 1 ? "volunteer" : "volunteers"}`
      : `${othersCount} ${othersCount === 1 ? "volunteer" : "volunteers"}`;

  return (
    <View style={[s.group, { backgroundColor: colors.card }]}>
      {people.map((person, index) => (
        <View key={person.id}>
          {index > 0 && (
            <View style={[s.groupRule, { backgroundColor: colors.border }]} />
          )}
          <PersonRow
            person={person}
            showRole={showRole}
            colors={colors}
            isDark={isDark}
          />
        </View>
      ))}
      {othersCount > 0 && (
        <View>
          {people.length > 0 && (
            <View style={[s.groupRule, { backgroundColor: colors.border }]} />
          )}
          <View style={s.personRow}>
            <View
              style={[s.avatar, s.avatarFallback, { backgroundColor: colors.surfaceSoft }]}
            >
              <Ionicons name="people" size={17} color={colors.icon} />
            </View>
            <Text style={[s.othersText, { color: colors.textSecondary }]}>
              {others}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function PersonRow({
  person,
  showRole,
  colors,
  isDark,
}: {
  person: PeriodFriend;
  showRole: boolean;
  colors: ThemeColors;
  isDark: boolean;
}) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        router.push(`/user/${person.id}` as Href);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${person.name}${person.isFriend ? ", friend" : ""}${
        showRole && person.shiftTypeName ? `, ${person.shiftTypeName}` : ""
      }. View profile`}
      style={({ pressed }) => [s.personRow, { opacity: pressed ? 0.7 : 1 }]}
    >
      {person.profilePhotoUrl ? (
        <Image
          source={{ uri: person.profilePhotoUrl }}
          style={s.avatar}
          contentFit="cover"
        />
      ) : (
        <View
          style={[
            s.avatar,
            s.avatarFallback,
            { backgroundColor: isDark ? colors.primaryLight : Brand.greenLight },
          ]}
        >
          <Text style={[s.avatarInitial, { color: colors.tint }]}>
            {person.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={s.personBody}>
        <View style={s.personNameRow}>
          <Text
            style={[s.personName, { color: colors.text }]}
            numberOfLines={1}
          >
            {person.name}
          </Text>
          {person.isFriend && (
            <Ionicons
              name="heart"
              size={13}
              color={isDark ? Brand.accent : Palette.forest400}
            />
          )}
        </View>
        {showRole && person.shiftTypeName ? (
          <Text
            style={[s.personRole, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {person.shiftTypeName}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.tabIconDefault}
      />
    </Pressable>
  );
}

/* ═════════════════════════════════════════════════════════
   EVENTS — what else is on at the restaurant that day
   ═════════════════════════════════════════════════════════ */

function EventsSection({
  events,
  colors,
}: {
  events: ShiftEvent[];
  colors: ThemeColors;
}) {
  return (
    <View style={s.section}>
      <Text
        style={[s.sectionTitle, { color: colors.text }]}
        accessibilityRole="header"
      >
        Also on that day
      </Text>
      {events.map((event) => (
        <Pressable
          key={event.id}
          onPress={() => {
            Haptics.selectionAsync();
            openExternalLink(event.url);
          }}
          style={({ pressed }) => [
            s.eventCard,
            { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="link"
          accessibilityLabel={`${event.name}. Details and tickets on everybodyeats.nz`}
        >
          {event.imageUrl ? (
            <Image
              source={{ uri: event.imageUrl }}
              style={s.eventImage}
              contentFit="cover"
            />
          ) : null}
          <View style={s.eventBody}>
            <Text
              style={[s.eventName, { color: colors.text }]}
              numberOfLines={2}
            >
              {event.name}
            </Text>
            <Text style={[s.eventMeta, { color: colors.textSecondary }]}>
              {event.displayTime ??
                formatNZT(new Date(event.date), "h:mma").toLowerCase()}
              {event.priceLabel ? `, ${event.priceLabel}` : ""}
            </Text>
            <View style={s.eventLinkRow}>
              <Text style={[s.eventLink, { color: colors.tint }]}>
                Details & tickets
              </Text>
              <Ionicons name="open-outline" size={13} color={colors.tint} />
            </View>
          </View>
        </Pressable>
      ))}
    </View>
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
  colors: ThemeColors;
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
    <View style={[s.blockedPill, { backgroundColor, borderColor }]}>
      <Ionicons name={icon} size={18} color={textColor} />
      <Text style={[s.blockedPillText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

/* ═════════════════════════════════════════════════════════
   STYLES
   ═════════════════════════════════════════════════════════ */

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 48 },
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

  /* ── Cover + sheet ── */
  cover: {
    height: COVER_HEIGHT,
    backgroundColor: Palette.forest700,
  },
  coverScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  sheet: {
    marginTop: -SHEET_OVERLAP,
    borderTopLeftRadius: SHEET_OVERLAP,
    borderTopRightRadius: SHEET_OVERLAP,
    paddingTop: 26,
    paddingHorizontal: 20,
    gap: 28,
  },

  /* ── What and when ── */
  intro: { gap: 16 },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: FontFamily.display,
    letterSpacing: -0.8,
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
  factLink: { fontFamily: FontFamily.semiBold },

  /* ── Status panel ── */
  panel: {
    borderRadius: 20,
    padding: 16,
  },
  meter: { gap: 12 },
  meterHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  meterHeadline: {
    fontSize: 22,
    lineHeight: 26,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.3,
  },
  meterDetail: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
  },
  seats: {
    flexDirection: "row",
    gap: 4,
  },
  seat: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  bar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  myStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  myStatusBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  myStatusTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.2,
  },
  myStatusMeta: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily.regular,
  },

  /* ── Description ── */
  description: {
    fontSize: 16,
    lineHeight: 25,
    fontFamily: FontFamily.regular,
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
    fontSize: 22,
    lineHeight: 28,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.3,
  },
  sectionMeta: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
  },
  subgroup: { gap: 8, marginTop: 4 },
  subgroupLabel: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    paddingHorizontal: 14,
  },

  /* ── People ── */
  group: {
    borderRadius: 18,
    overflow: "hidden",
  },
  groupRule: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 16,
    fontFamily: FontFamily.headingBold,
  },
  personBody: { flex: 1, gap: 2 },
  personNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  personName: {
    flexShrink: 1,
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
  },
  personRole: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
  othersText: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFamily.medium,
  },

  /* ── Events ── */
  eventCard: {
    flexDirection: "row",
    borderRadius: 18,
    overflow: "hidden",
  },
  // Event images are portrait posters (4:5 / 9:16): a 4:5 thumbnail keeps the
  // poster recognisable without the poster taking over the screen.
  eventImage: {
    width: 88,
    aspectRatio: 4 / 5,
  },
  eventBody: {
    flex: 1,
    padding: 14,
    gap: 4,
    justifyContent: "center",
  },
  eventName: {
    fontSize: 16,
    lineHeight: 21,
    fontFamily: FontFamily.semiBold,
  },
  eventMeta: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
  },
  eventLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  eventLink: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },

  /* ── Floating CTA ── */
  glassCtaText: {
    color: Palette.cream50,
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    letterSpacing: -0.1,
  },
  floatingCta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  blockedPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  blockedPillText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    letterSpacing: -0.1,
  },

  /* ── Cancel ── */
  cancelButton: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },
});
