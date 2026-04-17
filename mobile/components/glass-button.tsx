import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { Brand } from "@/constants/theme";

type GlassButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  isDark: boolean;
  /** Translucent overlay color used on iOS (over the glass/blur). */
  tintColor?: string;
  /** Solid background color for the Android fallback. Defaults to Brand.green. */
  androidBg?: string;
  /** Extra style applied to the outer Pressable. */
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  children: React.ReactNode;
};

/**
 * iOS liquid-glass button (with BlurView fallback for older iOS) and a
 * solid-color fallback on Android.
 */
export function GlassButton({
  onPress,
  disabled,
  isDark,
  tintColor,
  androidBg,
  style,
  accessibilityLabel,
  children,
}: GlassButtonProps) {
  const useNativeGlass = Platform.OS === "ios" && isLiquidGlassAvailable();

  if (useNativeGlass) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }, style]}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
      >
        <GlassView
          glassEffectStyle="clear"
          style={[
            styles.button,
            tintColor ? { backgroundColor: tintColor } : undefined,
          ]}
        >
          {children}
        </GlassView>
      </Pressable>
    );
  }

  if (Platform.OS === "ios") {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          { overflow: "hidden", opacity: pressed ? 0.85 : 1 },
          style,
        ]}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
      >
        <BlurView
          intensity={isDark ? 50 : 70}
          tint={isDark ? "dark" : "light"}
          style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: 16,
              backgroundColor: tintColor
                ? tintColor
                : isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(255,255,255,0.25)",
            },
          ]}
        />
        {children}
      </Pressable>
    );
  }

  // Android — solid button
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: androidBg ?? Brand.green,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 16,
    minHeight: 56,
    overflow: "hidden",
  },
});
