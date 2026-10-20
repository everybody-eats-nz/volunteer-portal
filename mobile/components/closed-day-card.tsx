import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";

import { Brand, Colors, FontFamily, Palette } from "@/constants/theme";
import { formatNZT } from "@/lib/dates";

type Closure = { location: string; theme: string };

/**
 * Shown in place of the day's shifts when the restaurant is closed: why it's
 * closed, and a way straight on to the next day with shifts. The hatched band
 * across the top is the same "shutter pulled down" mark the web calendar uses
 * for closed days.
 */
export function ClosedDayCard({
  closures,
  nextShiftDate,
  onSelectNext,
  isDark,
}: {
  /** One per closed restaurant in view (usually one). */
  closures: Closure[];
  /** The next day after this one with shifts to show, if any. */
  nextShiftDate: Date | null;
  onSelectNext: (date: Date) => void;
  isDark: boolean;
}) {
  const colors = Colors[isDark ? "dark" : "light"];
  const stripe = isDark ? "rgba(253, 248, 239, 0.10)" : "rgba(29, 83, 55, 0.10)";
  const bandBg = isDark ? "rgba(253, 248, 239, 0.03)" : "rgba(29, 83, 55, 0.03)";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      testID="shifts-closed-day"
    >
      <View style={[styles.band, { backgroundColor: bandBg }]}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            {/* Seamless 45 degree hatch: the main diagonal plus the two
                corner stubs that join it to the neighbouring tiles */}
            <Pattern
              id="closed-hatch"
              width={7}
              height={7}
              patternUnits="userSpaceOnUse"
            >
              <Path
                d="M-1,1 l2,-2 M0,7 l7,-7 M6,8 l2,-2"
                stroke={stripe}
                strokeWidth={1.25}
              />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#closed-hatch)" />
        </Svg>
      </View>

      <View
        style={[
          styles.iconChip,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Ionicons name="storefront-outline" size={22} color={colors.text} />
      </View>

      <View style={styles.body}>
        {closures.map(({ location, theme }) =>
          theme ? (
            <View key={location} style={styles.closure}>
              <Text style={[styles.lead, { color: colors.textSecondary }]}>
                {location} is closed
              </Text>
              <Text style={[styles.reason, { color: colors.text }]}>
                {theme}
              </Text>
            </View>
          ) : (
            <View key={location} style={styles.closure}>
              <Text style={[styles.reason, { color: colors.text }]}>
                {location} is closed
              </Text>
            </View>
          )
        )}

        {nextShiftDate && (
          <Pressable
            onPress={() => onSelectNext(nextShiftDate)}
            style={({ pressed }) => [
              styles.nextButton,
              {
                backgroundColor: isDark
                  ? "rgba(155, 189, 160, 0.16)"
                  : Brand.greenLight,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`See shifts on ${formatNZT(
              nextShiftDate,
              "EEEE d MMMM"
            )}`}
            testID="shifts-closed-day-next"
          >
            <Text
              style={[
                styles.nextText,
                { color: isDark ? Palette.forest100 : Brand.green },
              ]}
            >
              Next shifts {formatNZT(nextShiftDate, "EEE d MMM")}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={16}
              color={isDark ? Palette.forest100 : Brand.green}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const BAND_HEIGHT = 56;
const CHIP_SIZE = 48;

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    marginHorizontal: 20,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    alignItems: "center",
  },
  band: {
    alignSelf: "stretch",
    height: BAND_HEIGHT,
  },
  iconChip: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    // Sits on the band's bottom edge, half over the hatching
    marginTop: -CHIP_SIZE / 2,
  },
  body: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 18,
  },
  closure: {
    alignItems: "center",
    gap: 4,
  },
  lead: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    textAlign: "center",
  },
  reason: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: FontFamily.display,
    textAlign: "center",
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  nextText: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
});
