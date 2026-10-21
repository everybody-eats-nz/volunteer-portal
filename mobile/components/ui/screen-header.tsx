import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { goBackOrHome } from "@/lib/navigation";

/** One back chevron size for every hand-built header. */
export const BACK_CHEVRON_SIZE = 22;
const SIDE = 44;

/**
 * The back affordance for hand-built headers: a 44pt target with the shared
 * chevron size, a button role, and a borderless ripple on Android. `bordered`
 * draws the round hairline the driver flows use.
 */
export function HeaderBackButton({
  onPress = goBackOrHome,
  label = "Back",
  color,
  bordered = false,
  testID,
}: {
  onPress?: () => void;
  label?: string;
  color?: string;
  bordered?: boolean;
  testID?: string;
}) {
  const colors = Colors[useColorScheme()];
  return (
    <Pressable
      onPress={() => onPress()}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      testID={testID}
      android_ripple={{ color: colors.border, borderless: true, radius: SIDE / 2 }}
      style={({ pressed }) => [
        styles.back,
        bordered && [styles.backBordered, { borderColor: colors.border }],
        { opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name="chevron-back" size={BACK_CHEVRON_SIZE} color={color ?? colors.tint} />
    </Pressable>
  );
}

/**
 * The header for screens outside a native stack header (admin, help, van):
 * back chevron on the left, a centred title, an optional trailing slot, and a
 * hairline underneath. It pads itself below the status bar.
 *
 * Pass `center` to replace the title with custom content (a seal, a subtitle
 * row), and `tint` / `titleColor` / `borderColor` when the screen sits on its
 * own paper colour.
 */
export function ScreenHeader({
  title,
  subtitle,
  center,
  right,
  onBack,
  backLabel,
  tint,
  titleColor,
  subtitleColor,
  borderColor,
  bordered = true,
  topInset = true,
  style,
}: {
  title?: string;
  subtitle?: string;
  center?: ReactNode;
  right?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  tint?: string;
  titleColor?: string;
  subtitleColor?: string;
  borderColor?: string;
  bordered?: boolean;
  /** Pad for the status bar. Turn off inside a sheet or when the parent already does. */
  topInset?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: (topInset ? insets.top : 0) + 6,
          borderBottomColor: borderColor ?? colors.border,
          borderBottomWidth: bordered ? StyleSheet.hairlineWidth : 0,
        },
        style,
      ]}
    >
      <View style={styles.side}>
        <HeaderBackButton onPress={onBack} label={backLabel} color={tint} />
      </View>
      <View style={styles.center}>
        {center ?? (
          <>
            {title ? (
              <ThemedText
                accessibilityRole="header"
                numberOfLines={1}
                style={[styles.title, { color: titleColor ?? colors.text }]}
              >
                {title}
              </ThemedText>
            ) : null}
            {subtitle ? (
              <ThemedText
                type="caption"
                numberOfLines={1}
                style={[styles.subtitle, { color: subtitleColor ?? colors.textSecondary }]}
              >
                {subtitle}
              </ThemedText>
            ) : null}
          </>
        )}
      </View>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  side: {
    minWidth: SIDE,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  sideRight: {
    alignItems: "flex-end",
  },
  center: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  back: {
    width: SIDE,
    height: SIDE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: SIDE / 2,
  },
  backBordered: {
    borderWidth: 1,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: 20,
    lineHeight: 26,
  },
  subtitle: {
    marginTop: 1,
  },
});
