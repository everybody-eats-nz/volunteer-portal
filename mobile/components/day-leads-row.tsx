import { StyleSheet, Text, View } from "react-native";

import { Brand, Colors, FontFamily } from "@/constants/theme";
import type { DayLeads } from "@/hooks/use-shifts";

const ROLES = [
  { key: "chef", label: "Chef", emoji: "🧑‍🍳" },
  { key: "fohManager", label: "FOH Manager", emoji: "🛎️" },
] as const;

/**
 * The Chef and FOH Manager running a day, by first name, side by side in one
 * soft panel. `strip` sits under the Shifts tab's date header; `card` is the
 * shift screen's version on a card surface. Renders nothing when neither role
 * has anyone.
 */
export function DayLeadsRow({
  leads,
  variant,
  isDark,
  location,
  testID = "day-leads",
}: {
  leads: DayLeads | null | undefined;
  variant: "strip" | "card";
  isDark: boolean;
  /** Restaurant name, shown when several restaurants' leads are listed */
  location?: string;
  testID?: string;
}) {
  if (!leads) return null;
  const colors = Colors[isDark ? "dark" : "light"];
  const roles = ROLES.filter((role) => leads[role.key]);
  if (roles.length === 0) return null;

  const surface =
    variant === "card"
      ? colors.card
      : isDark
        ? "rgba(253,248,239,0.05)"
        : "rgba(29, 83, 55, 0.05)";
  const badge = isDark ? "rgba(253,248,239,0.08)" : Brand.greenLight;
  const rule = isDark ? "rgba(253,248,239,0.1)" : "rgba(29, 83, 55, 0.12)";

  return (
    <View
      style={[styles.panel, { backgroundColor: surface }]}
      testID={testID}
      accessible
      accessibilityLabel={[
        location,
        ...roles.map((role) => `${role.label}: ${leads[role.key]}`),
      ]
        .filter(Boolean)
        .join(", ")}
    >
      {location ? (
        <Text style={[styles.location, { color: colors.textSecondary }]}>
          {location}
        </Text>
      ) : null}
      <View style={styles.roles}>
        {roles.map((role, index) => (
          <View key={role.key} style={styles.roleWrap}>
            {index > 0 && (
              <View style={[styles.rule, { backgroundColor: rule }]} />
            )}
            <View style={styles.role}>
              <View style={[styles.badge, { backgroundColor: badge }]}>
                <Text style={styles.emoji}>{role.emoji}</Text>
              </View>
              <View style={styles.roleText}>
                <Text
                  style={[styles.label, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {role.label}
                </Text>
                <Text
                  style={[styles.name, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {leads[role.key]}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  location: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.2,
  },
  roles: {
    flexDirection: "row",
    alignItems: "center",
  },
  roleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  rule: {
    width: StyleSheet.hairlineWidth * 2,
    alignSelf: "stretch",
    marginRight: 14,
  },
  role: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 18,
  },
  roleText: {
    flex: 1,
    gap: 1,
  },
  label: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
  },
  name: {
    fontSize: 17,
    fontFamily: FontFamily.heading,
    letterSpacing: 0.1,
  },
});
