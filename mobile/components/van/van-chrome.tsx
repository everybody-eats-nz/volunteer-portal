import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

/**
 * The chrome the driver flows sit in.
 *
 * A driver is standing at a van, often one-handed, often in the dark. The
 * flows are full-bleed paper with a single back affordance and a step count —
 * no tab bar, no scroll, nothing to hunt for.
 */

export function DriveFlowScreen({
  children,
  testID,
}: {
  children: React.ReactNode;
  testID?: string;
}) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={testID}
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      {children}
    </View>
  );
}

export function FlowHeader({
  title,
  subtitle,
  onBack,
  step,
  stepCount,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  step?: number;
  stepCount?: number;
}) {
  const colors = Colors[useColorScheme()];

  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        style={({ pressed }) => [
          styles.back,
          { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>

      <View style={styles.headerBody}>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.headerSubtitle, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {step && stepCount ? (
        <View
          style={styles.steps}
          accessibilityRole="progressbar"
          accessibilityLabel={`Step ${step} of ${stepCount}`}
        >
          {Array.from({ length: stepCount }, (_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                {
                  backgroundColor: i < step ? colors.tint : colors.border,
                  width: i === step - 1 ? 18 : 6,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 26,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBody: { flex: 1 },
  headerTitle: { fontFamily: FontFamily.semiBold, fontSize: 16.5 },
  headerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    marginTop: 1,
    fontVariant: ["tabular-nums"],
  },
  steps: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepDot: { height: 6, borderRadius: 999 },
});
