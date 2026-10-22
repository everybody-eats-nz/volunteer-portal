import { Ionicons } from "@expo/vector-icons";
import { differenceInHours, differenceInMinutes } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Eyebrow } from "@/components/ui/eyebrow";
import { ThemedText } from "@/components/themed-text";
import {
  FontFamily,
  MaxFontScale,
  Palette,
  StatusColors,
} from "@/constants/theme";
import type { PeriodFriend } from "@/hooks/use-shifts";
import { formatNZT } from "@/lib/dates";
import { waitlistCountLabel } from "@/lib/waitlist";

/* ── Next Shift Hero ── */

type ShiftStatusKey = "CONFIRMED" | "PENDING" | "WAITLISTED";

/* The hero is always a dark panel, so each status takes the filled pill from
   the dark StatusColors; the gradients, glow and rings are panel art. */
const HERO_STATUS = StatusColors.dark;

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
    /** 0.72 keeps ≥4.5:1 on the lightest gradient stop of every status. */
    mutedText: string;
    chevron: string;
    eyebrow: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  CONFIRMED: {
    gradient: [Palette.forest700, Palette.forest500, Palette.forest800],
    glow: "rgba(248, 251, 105, 0.22)",
    ring: "rgba(253, 248, 239, 0.08)",
    pillBg: HERO_STATUS.confirmed.solid,
    pillText: HERO_STATUS.confirmed.onSolid,
    accent: HERO_STATUS.confirmed.solid,
    heroText: Palette.cream50,
    bodyText: "rgba(253, 248, 239, 0.92)",
    mutedText: "rgba(253, 248, 239, 0.72)",
    chevron: "rgba(253, 248, 239, 0.45)",
    eyebrow: "Your next shift",
    label: "Confirmed",
    icon: "checkmark-circle",
  },
  PENDING: {
    gradient: ["#3a2808", "#6b4912", "#2a1d05"],
    glow: "rgba(251, 191, 36, 0.24)",
    ring: "rgba(255, 255, 255, 0.06)",
    pillBg: HERO_STATUS.pending.solid,
    pillText: HERO_STATUS.pending.onSolid,
    accent: HERO_STATUS.pending.solid,
    heroText: "#fdf6e3",
    bodyText: "rgba(253, 246, 227, 0.92)",
    mutedText: "rgba(253, 246, 227, 0.72)",
    chevron: "rgba(255, 255, 255, 0.45)",
    eyebrow: "Awaiting approval",
    label: "Pending",
    icon: "time",
  },
  WAITLISTED: {
    gradient: ["#1a2332", "#334155", "#0f172a"],
    glow: "rgba(148, 163, 184, 0.22)",
    ring: "rgba(255, 255, 255, 0.06)",
    pillBg: HERO_STATUS.waitlisted.solid,
    pillText: HERO_STATUS.waitlisted.onSolid,
    accent: HERO_STATUS.waitlisted.solid,
    heroText: "#f1f5f9",
    bodyText: "rgba(241, 245, 249, 0.92)",
    mutedText: "rgba(241, 245, 249, 0.72)",
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
export function getShiftPeriodKey(start: Date): string {
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

export function NextShiftHero({
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
    /** Volunteers waiting for a place — shown when this is a waitlist place. */
    waitlistCount?: number;
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
            <ThemedText
              style={[heroStyles.statusPillText, { color: palette.pillText }]}
              maxFontSizeMultiplier={MaxFontScale.compact}
            >
              {palette.label}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.chevron} />
        </View>

        {/* Hero time block */}
        <View style={heroStyles.heroBlock}>
          <Eyebrow color={palette.accent}>{palette.eyebrow}</Eyebrow>
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
          {/* On a waitlist place, how many are waiting is the thing you need
              to know — otherwise holding standby is a guess */}
          {statusKey === "WAITLISTED" && (shift.waitlistCount ?? 0) > 0 && (
            <View style={heroStyles.metaRow}>
              <Ionicons name="list-outline" size={13} color={palette.bodyText} />
              <Text
                style={[heroStyles.metaText, { color: palette.bodyText }]}
                numberOfLines={1}
              >
                {waitlistCountLabel(shift.waitlistCount ?? 0)}
              </Text>
            </View>
          )}
        </View>

        {/* Friends on this period */}
        {friends.length > 0 && (
          <View
            style={[
              heroStyles.friendsRow,
              { borderTopColor: "rgba(253, 248, 239, 0.10)" },
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
              { borderTopColor: "rgba(253, 248, 239, 0.10)" },
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
              <Text
                style={heroStyles.friendInitial}
                maxFontSizeMultiplier={MaxFontScale.compact}
              >
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
            <Text
              style={heroStyles.friendOverflowText}
              maxFontSizeMultiplier={MaxFontScale.compact}
            >
              +{overflow}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const heroStyles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: Palette.forest700,
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
    lineHeight: 14,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.4,
  },
  heroBlock: {
    marginTop: 22,
    alignItems: "flex-start",
  },
  heroTime: {
    marginTop: 6,
    fontSize: 46,
    lineHeight: 52,
    fontFamily: FontFamily.display,
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
    // Lets numberOfLines actually ellipsise: without flexShrink a Text in a
    // row overflows the card instead of truncating at large text sizes.
    flexShrink: 1,
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
    borderColor: "rgba(253, 248, 239, 0.20)",
  },
  friendAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(253, 248, 239, 0.14)",
  },
  friendInitial: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    color: Palette.cream50,
  },
  friendOverflowPill: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(253, 248, 239, 0.20)",
  },
  friendOverflowText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    color: Palette.cream50,
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
