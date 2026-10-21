import { Ionicons } from "@expo/vector-icons";
import { differenceInDays, startOfDay } from "date-fns";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Eyebrow } from "@/components/ui/eyebrow";
import { Brand, FontFamily, MaxFontScale, Palette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { formatNZT } from "@/lib/dates";
import { getShiftThemeByName, type Shift } from "@/lib/dummy-data";

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
  /** Android press ripple over a shift chip. */
  chipRipple: string;
  ctaBorder: string;
  ctaText: string;
  ctaArrowBg: string;
  ctaArrowIcon: string;
  /* See-all end-cap — deliberately off-brand from the green/cream shift
     chips so it reads as an opening rather than another shift. */
  seeAllBg: string;
  seeAllBorder: string;
  seeAllTitle: string;
  seeAllHint: string;
  seeAllArrowBg: string;
  seeAllArrowIcon: string;
  seeAllAccent: string;
  seeAllRipple: string;
};

const NEED_PALETTE_LIGHT: NeedPalette = {
  cardBg: Palette.cream100,
  cardBorder: "rgba(29, 83, 55, 0.10)",
  glow: "rgba(248, 251, 105, 0.35)",
  shadow: Palette.forest700,
  eyebrow: Brand.green,
  displayText: Brand.green,
  supportText: "rgba(26, 20, 16, 0.72)",
  chipBg: Brand.green,
  chipDate: Brand.accent,
  chipName: Brand.warmWhite,
  chipLocation: "rgba(253, 248, 239, 0.70)",
  chipNeedsBg: Brand.accent,
  chipNeedsText: Brand.nearBlack,
  chipRipple: "rgba(253, 248, 239, 0.22)",
  ctaBorder: "rgba(29, 83, 55, 0.18)",
  ctaText: Brand.green,
  ctaArrowBg: Brand.green,
  ctaArrowIcon: Brand.warmWhite,
  seeAllBg: Palette.cream200,
  seeAllBorder: "rgba(29, 83, 55, 0.14)",
  seeAllTitle: Brand.green,
  seeAllHint: "rgba(29, 83, 55, 0.62)",
  seeAllArrowBg: Brand.green,
  seeAllArrowIcon: Brand.accent,
  seeAllAccent: Brand.accent,
  seeAllRipple: "rgba(29, 83, 55, 0.12)",
};

const NEED_PALETTE_DARK: NeedPalette = {
  // Deep warm forest — reads as a dark notice board behind paper chips
  cardBg: Palette.forest700,
  cardBorder: "rgba(248, 251, 105, 0.18)",
  glow: "rgba(248, 251, 105, 0.22)",
  shadow: "#000000",
  eyebrow: Brand.accent,
  displayText: Palette.cream50,
  supportText: "rgba(253, 248, 239, 0.72)",
  // Chips are muted cream — dimmer than paper so they don't glow against dark
  chipBg: Palette.cream200,
  chipDate: Brand.green,
  chipName: Brand.nearBlack,
  chipLocation: "rgba(26, 20, 16, 0.62)",
  chipNeedsBg: Brand.green,
  chipNeedsText: Brand.accent,
  chipRipple: "rgba(26, 20, 16, 0.12)",
  ctaBorder: "rgba(248, 251, 105, 0.22)",
  ctaText: Brand.accent,
  ctaArrowBg: Brand.accent,
  ctaArrowIcon: Brand.green,
  seeAllBg: Palette.forest600,
  seeAllBorder: "rgba(248, 251, 105, 0.28)",
  seeAllTitle: Brand.accent,
  seeAllHint: "rgba(248, 251, 105, 0.62)",
  seeAllArrowBg: Brand.accent,
  seeAllArrowIcon: Brand.green,
  seeAllAccent: Brand.accent,
  seeAllRipple: "rgba(248, 251, 105, 0.16)",
};

export function VolunteersNeededCard({
  shifts,
  marginTop,
  collapsible = false,
  onShiftPress,
  onBrowseDay,
  onBrowseAll,
}: {
  shifts: Shift[];
  marginTop: number;
  /** When true, start collapsed with a tap-to-expand slim header. */
  collapsible?: boolean;
  onShiftPress: (id: string) => void;
  /** Navigate to the shifts tab, scoped to this day (YYYY-MM-DD NZ time). */
  onBrowseDay: (dateKey: string) => void;
  /** Navigate to the shifts tab with no date filter. */
  onBrowseAll: () => void;
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
        new Date(a.start).getTime() - new Date(b.start).getTime() ||
        b.open - a.open
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
                } still open in the next 7 days`
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
              {totalSpots} more {totalSpots === 1 ? "spot" : "spots"} open in
              the next 7 days
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
              <SeeAllShiftsChip palette={palette} onPress={onBrowseAll} />
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
        <Eyebrow color={palette.eyebrow}>Help needed soon</Eyebrow>
        <Text style={needStyles.handsEmoji}>🙌</Text>
      </View>

      {/* Display number — unit nested inside the number's Text so RN lays
          them out on the same text baseline (flex-end aligns boxes, not
          baselines, which is why sizes of 56 / 22 drift apart otherwise). */}
      <Text style={[needStyles.displayNumber, { color: palette.displayText }]}>
        {totalSpots}
        <Text style={needStyles.displayUnit}>
          {" "}
          {totalSpots === 1 ? "spot" : "spots"}
        </Text>
      </Text>

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
        <SeeAllShiftsChip palette={palette} onPress={onBrowseAll} />
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
      android_ripple={{ color: palette.chipRipple, foreground: true }}
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
            <Text
              style={[needStyles.chipDate, { color: palette.chipDate }]}
              maxFontSizeMultiplier={MaxFontScale.compact}
            >
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
              maxFontSizeMultiplier={MaxFontScale.compact}
            >
              {startTime}
            </Text>
          </View>

          <Text
            style={needStyles.chipEmoji}
            maxFontSizeMultiplier={MaxFontScale.compact}
          >
            {theme.emoji}
          </Text>

          <Text
            style={[needStyles.chipName, { color: palette.chipName }]}
            numberOfLines={2}
            maxFontSizeMultiplier={MaxFontScale.compact}
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
              maxFontSizeMultiplier={MaxFontScale.compact}
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
              maxFontSizeMultiplier={MaxFontScale.compact}
            >
              Needs {shift.open} more
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Trailing end-cap of the shortage carousel — visually distinct from the
 *  shift chips (warm paper on green, or accent-on-deep-green in dark) so it
 *  reads as an invitation to keep going rather than another shift. */
function SeeAllShiftsChip({
  palette,
  onPress,
}: {
  palette: NeedPalette;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: palette.seeAllRipple, foreground: true }}
      style={({ pressed }) => [
        needStyles.seeAllChip,
        {
          backgroundColor: palette.seeAllBg,
          borderColor: palette.seeAllBorder,
        },
        { transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel="See all shifts"
    >
      {/* Ticker-tape corner accent — tiny dot cluster in the top-right
          hints at "more" without competing with the title. */}
      <View pointerEvents="none" style={needStyles.seeAllDots}>
        <View
          style={[
            needStyles.seeAllDot,
            { backgroundColor: palette.seeAllAccent },
          ]}
        />
        <View
          style={[
            needStyles.seeAllDot,
            { backgroundColor: palette.seeAllAccent, opacity: 0.55 },
          ]}
        />
        <View
          style={[
            needStyles.seeAllDot,
            { backgroundColor: palette.seeAllAccent, opacity: 0.25 },
          ]}
        />
      </View>

      <View style={needStyles.seeAllInner}>
        <Text
          style={[needStyles.seeAllEyebrow, { color: palette.seeAllHint }]}
          maxFontSizeMultiplier={MaxFontScale.compact}
        >
          More mahi
        </Text>

        <Text
          style={[needStyles.seeAllTitle, { color: palette.seeAllTitle }]}
          numberOfLines={2}
          maxFontSizeMultiplier={MaxFontScale.compact}
        >
          See all{"\n"}shifts
        </Text>

        <View style={needStyles.seeAllBottomRow}>
          <Text
            style={[needStyles.seeAllHint, { color: palette.seeAllHint }]}
            numberOfLines={2}
            maxFontSizeMultiplier={MaxFontScale.compact}
          >
            Every shift matters
          </Text>
          <View
            style={[
              needStyles.seeAllArrow,
              {
                backgroundColor: palette.seeAllArrowBg,
                shadowColor: palette.seeAllArrowBg,
              },
            ]}
          >
            <Ionicons
              name="arrow-forward"
              size={20}
              color={palette.seeAllArrowIcon}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const needStyles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    borderRadius: 28,
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
  handsEmoji: {
    fontSize: 22,
  },
  displayNumber: {
    fontSize: 56,
    lineHeight: 62,
    fontFamily: FontFamily.display,
    letterSpacing: -1,
    paddingHorizontal: 22,
    marginTop: 12,
  },
  displayUnit: {
    fontSize: 22,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.2,
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
  // Width is fixed so the carousel reads as a row of tiles; the height is a
  // floor, so larger text grows the chip instead of being clipped. The scroll
  // row stretches every chip to the tallest one.
  chip: {
    width: 172,
    minHeight: 170,
    borderRadius: 20,
    // Clips the Android ripple to the rounded tile.
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
  seeAllChip: {
    width: 172,
    minHeight: 170,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: "hidden",
    position: "relative",
  },
  seeAllDots: {
    position: "absolute",
    top: 14,
    right: 14,
    flexDirection: "row",
    gap: 4,
  },
  seeAllDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  seeAllInner: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  seeAllEyebrow: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  seeAllTitle: {
    fontSize: 22,
    lineHeight: 24,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.4,
    marginTop: -2,
  },
  seeAllBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  seeAllHint: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.1,
  },
  seeAllArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
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
  // coming up. Slim header is always visible; tapping expands the chips + CTA.
  collapsibleCard: {
    marginHorizontal: 20,
    borderRadius: 24,
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
