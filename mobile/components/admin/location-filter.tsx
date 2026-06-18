import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAdminLocations } from "@/hooks/use-admin";
import { useAdminLocationFilter } from "@/lib/admin-location-filter";

/**
 * Shared restaurant filter for the admin section. Reads/writes the
 * `useAdminLocationFilter` store, so the choice is the same on the hub,
 * approvals, and shifts screens. Renders a compact pill that opens a
 * bottom-sheet picker — mirrors the volunteer shifts location picker.
 */
export function AdminLocationFilter() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";

  const { selected, setSelected, hydrate } = useAdminLocationFilter();
  const { data: locations } = useAdminLocations();
  const [open, setOpen] = useState(false);

  // Restore the manager's saved restaurant on first mount. Idempotent — the
  // store guards against re-running, so it's safe on every admin screen.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const label = selected ?? "All restaurants";

  const onPick = (value: string | null) => {
    Haptics.selectionAsync();
    setSelected(value);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setOpen(true);
        }}
        hitSlop={8}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: selected
              ? isDark
                ? "rgba(29,83,55,0.28)"
                : Brand.greenLight
              : isDark
                ? "rgba(253,248,239,0.06)"
                : colors.card,
            borderColor: selected
              ? isDark
                ? "rgba(126,200,154,0.4)"
                : "rgba(29,83,55,0.3)"
              : colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Restaurant filter: ${label}. Tap to change.`}
      >
        <Ionicons
          name="location"
          size={13}
          color={selected ? (isDark ? Brand.greenLight : Brand.green) : colors.textSecondary}
        />
        <Text
          style={[
            styles.pillText,
            { color: selected ? (isDark ? Brand.greenLight : Brand.green) : colors.text },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Ionicons
          name="chevron-down"
          size={13}
          color={selected ? (isDark ? Brand.greenLight : Brand.green) : colors.textSecondary}
        />
      </Pressable>

      <LocationSheet
        visible={open}
        locations={locations ?? []}
        selected={selected}
        onSelect={onPick}
        onClose={() => setOpen(false)}
        isDark={isDark}
        colors={colors}
      />
    </>
  );
}

/* ─── Picker sheet ──────────────────────────────────────────── */

function LocationSheet({
  visible,
  locations,
  selected,
  onSelect,
  onClose,
  isDark,
  colors,
}: {
  visible: boolean;
  locations: string[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  onClose: () => void;
  isDark: boolean;
  colors: (typeof Colors)["light"];
}) {
  const insets = useSafeAreaInsets();
  const items: {
    key: string;
    label: string;
    value: string | null;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: "all", label: "All restaurants", value: null, icon: "globe-outline" },
    ...locations.map((loc) => ({
      key: loc,
      label: loc,
      value: loc,
      icon: "location" as const,
    })),
  ];

  return (
    <Modal
      visible={visible}
      presentationStyle="pageSheet"
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.sheetPage,
          {
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        <View style={styles.sheetHandleWrap}>
          <View
            style={[
              styles.sheetHandle,
              {
                backgroundColor: isDark
                  ? "rgba(253,248,239,0.22)"
                  : "rgba(29,83,55,0.18)",
              },
            ]}
          />
        </View>

        <View style={styles.sheetHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              Filter by restaurant
            </Text>
            <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
              Applies across the admin section
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityLabel="Close"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.sheetClose,
              {
                backgroundColor: isDark
                  ? "rgba(253,248,239,0.08)"
                  : colors.surfaceSunk,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.sheetList}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => {
            const active = item.value === selected;
            return (
              <Pressable
                key={item.key}
                onPress={() => onSelect(item.value)}
                style={({ pressed }) => [
                  styles.sheetItem,
                  {
                    backgroundColor: active
                      ? isDark
                        ? "rgba(29, 83, 55, 0.22)"
                        : Brand.greenLight
                      : pressed
                        ? isDark
                          ? "rgba(253,248,239,0.04)"
                          : colors.surfaceSoft
                        : "transparent",
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={active ? (isDark ? colors.tint : Brand.green) : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.sheetItemText,
                    {
                      color: active ? (isDark ? colors.tint : Brand.green) : colors.text,
                      fontFamily: active ? FontFamily.semiBold : FontFamily.regular,
                    },
                  ]}
                >
                  {item.label}
                </Text>
                {active && (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={isDark ? colors.tint : Brand.green}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 200,
  },
  pillText: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
    maxWidth: 140,
  },
  sheetPage: { flex: 1 },
  sheetHandleWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 4 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: FontFamily.heading,
    letterSpacing: 0.2,
    lineHeight: 26,
  },
  sheetSubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
    marginTop: 2,
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetList: { paddingHorizontal: 12, gap: 2, paddingBottom: 12 },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
  },
  sheetItemText: { flex: 1, fontSize: 15, lineHeight: 20 },
});
