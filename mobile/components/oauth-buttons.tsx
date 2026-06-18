import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { OAuthProvider } from "@/hooks/use-oauth-sign-in";

/**
 * Apple + Google sign-in circles, shared by the auth screens. OAuth doubles as
 * sign-up, so the register screen renders these too.
 */
export function OAuthButtons({
  busyProvider,
  googleReady,
  disabled,
  onApple,
  onGoogle,
  isDark,
}: {
  busyProvider: OAuthProvider | null;
  googleReady: boolean;
  disabled: boolean;
  onApple: () => void;
  onGoogle: () => void;
  isDark: boolean;
}) {
  return (
    <View style={styles.row}>
      {Platform.OS === "ios" && (
        <OAuthCircle
          provider="apple"
          isBusy={busyProvider === "apple"}
          disabled={disabled}
          onPress={onApple}
          isDark={isDark}
        />
      )}
      <OAuthCircle
        provider="google"
        isBusy={busyProvider === "google"}
        disabled={disabled || !googleReady}
        onPress={onGoogle}
        isDark={isDark}
      />
    </View>
  );
}

function OAuthCircle({
  provider,
  isBusy,
  disabled,
  onPress,
  isDark,
}: {
  provider: OAuthProvider;
  isBusy: boolean;
  disabled: boolean;
  onPress: () => void;
  isDark: boolean;
}) {
  const style =
    provider === "apple"
      ? {
          bg: isDark ? "#f5f5f7" : "#0b0d10",
          border: "transparent",
          icon: isDark ? "#0b0d10" : "#ffffff",
          label: "Apple",
        }
      : {
          bg: "#ffffff",
          border: "rgba(0,0,0,0.08)",
          icon: "#0b0d10",
          label: "Google",
        };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Sign up with ${style.label}`}
      accessibilityState={{ busy: isBusy, disabled }}
      style={({ pressed }) => [
        styles.circle,
        {
          backgroundColor: style.bg,
          borderColor: style.border,
          opacity: disabled && !isBusy ? 0.6 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      {isBusy ? (
        <Ionicons name="ellipsis-horizontal" size={22} color={style.icon} />
      ) : provider === "apple" ? (
        <Ionicons name="logo-apple" size={26} color={style.icon} />
      ) : (
        <Ionicons name="logo-google" size={26} color="#4285F4" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
