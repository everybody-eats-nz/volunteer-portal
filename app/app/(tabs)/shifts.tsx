import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { AVAILABLE_SHIFTS, MY_SHIFTS, type Shift } from "@/lib/dummy-data";

type Tab = "upcoming" | "browse";

export default function ShiftsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");

  const shifts = activeTab === "upcoming" ? MY_SHIFTS : AVAILABLE_SHIFTS;

  const handleTabChange = (tab: Tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <ThemedText type="title">Mahi 🍽️</ThemedText>
        <ThemedText type="caption" style={{ color: colors.textSecondary }}>
          Your shifts and open opportunities
        </ThemedText>
      </View>

      {/* ── Tab switcher ── */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => handleTabChange("upcoming")}
          style={[styles.tab, activeTab === "upcoming" && styles.tabActive]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "upcoming" ? "#ffffff" : colors.textSecondary,
              },
            ]}
          >
            📅 My Mahi ({MY_SHIFTS.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => handleTabChange("browse")}
          style={[styles.tab, activeTab === "browse" && styles.tabActive]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "browse" ? "#ffffff" : colors.textSecondary,
              },
            ]}
          >
            ✋ Browse
          </Text>
        </Pressable>
      </View>

      {/* ── Empty state ── */}
      {shifts.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>
            {activeTab === "upcoming" ? "🌱" : "🔍"}
          </Text>
          <ThemedText type="subtitle" style={{ textAlign: "center" }}>
            {activeTab === "upcoming"
              ? "No upcoming mahi yet"
              : "No open shifts right now"}
          </ThemedText>
          <ThemedText
            type="caption"
            style={{ color: colors.textSecondary, textAlign: "center" }}
          >
            {activeTab === "upcoming"
              ? "Browse available shifts to sign up"
              : "Check back soon — new mahi is added regularly"}
          </ThemedText>
        </View>
      )}

      {/* ── Shift list ── */}
      <View style={styles.shiftList}>
        {shifts.map((shift) => (
          <ShiftCard
            key={shift.id}
            shift={shift}
            colors={colors}
            showStatus={activeTab === "upcoming"}
          />
        ))}
      </View>

      {/* ── Footer hint ── */}
      {shifts.length > 0 && (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {activeTab === "upcoming"
              ? "Tap a shift for details and check-in 👆"
              : "Tap to sign up and join the whānau 💚"}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

/* ── Shift Card ── */

function ShiftCard({
  shift,
  colors,
  showStatus,
}: {
  shift: Shift;
  colors: (typeof Colors)["light"];
  showStatus?: boolean;
}) {
  const router = useRouter();
  const date = new Date(shift.start);
  const endDate = new Date(shift.end);
  const spotsLeft = shift.capacity - shift.signedUp;
  const isFull = spotsLeft <= 0;
  const isUrgent = !isFull && spotsLeft <= 2;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/shift/${shift.id}` as Href);
      }}
      style={({ pressed }) => [
        styles.card,
        { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
      accessibilityLabel={`${shift.shiftType.name} at ${
        shift.location
      }, ${format(date, "EEEE d MMMM")}`}
    >
      {/* Left date strip */}
      <View
        style={[styles.dateStrip, { backgroundColor: colors.primaryLight }]}
      >
        <Text style={[styles.dateStripDay, { color: Brand.green }]}>
          {format(date, "d")}
        </Text>
        <Text style={[styles.dateStripMonth, { color: Brand.green }]}>
          {format(date, "MMM")}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        {/* Title row */}
        <View style={styles.cardTitleRow}>
          <Text
            style={[styles.shiftTypeName, { color: colors.text }]}
            numberOfLines={1}
          >
            {shift.shiftType.name}
          </Text>
          {showStatus && shift.status && <StatusPill status={shift.status} />}
          {!showStatus && (
            <SpotsPill
              spotsLeft={spotsLeft}
              isFull={isFull}
              isUrgent={isUrgent}
              colors={colors}
            />
          )}
        </View>

        {/* Detail row with emojis */}
        <View style={styles.detailRow}>
          <Text style={styles.detailEmoji}>📍</Text>
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {shift.location}
          </Text>
          <Text style={[styles.detailDot, { color: colors.textSecondary }]}>
            ·
          </Text>
          <Text style={styles.detailEmoji}>🕐</Text>
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {format(date, "h:mm a")} – {format(endDate, "h:mm a")}
          </Text>
        </View>

        {/* Notes */}
        {shift.notes && (
          <View style={styles.noteRow}>
            <Text style={styles.noteEmoji}>💡</Text>
            <Text style={[styles.noteText, { color: "#92400e" }]}>
              {shift.notes}
            </Text>
          </View>
        )}

        {/* Capacity bar */}
        <View style={styles.capacityRow}>
          <View
            style={[styles.capacityBar, { backgroundColor: colors.border }]}
          >
            <View
              style={[
                styles.capacityFill,
                {
                  width: `${Math.min(
                    (shift.signedUp / shift.capacity) * 100,
                    100
                  )}%`,
                  backgroundColor: isFull ? colors.destructive : Brand.green,
                },
              ]}
            />
          </View>
          <Text style={[styles.capacityText, { color: colors.textSecondary }]}>
            {shift.signedUp}/{shift.capacity}
          </Text>
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.textSecondary}
        style={styles.chevron}
      />
    </Pressable>
  );
}

/* ── Status Pill ── */
function StatusPill({ status }: { status: string }) {
  const config: Record<
    string,
    { bg: string; text: string; label: string; emoji: string }
  > = {
    CONFIRMED: {
      bg: "#dcfce7",
      text: "#166534",
      label: "Confirmed",
      emoji: "✅",
    },
    PENDING: { bg: "#fef9c3", text: "#92400e", label: "Pending", emoji: "⏳" },
    WAITLISTED: {
      bg: "#fef9c3",
      text: "#92400e",
      label: "Waitlisted",
      emoji: "📋",
    },
  };
  const c = config[status] ?? config.PENDING;

  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.text }]}>
        {c.emoji} {c.label}
      </Text>
    </View>
  );
}

/* ── Spots Pill ── */
function SpotsPill({
  spotsLeft,
  isFull,
  isUrgent,
  colors,
}: {
  spotsLeft: number;
  isFull: boolean;
  isUrgent: boolean;
  colors: (typeof Colors)["light"];
}) {
  const bg = isFull
    ? colors.destructive + "15"
    : isUrgent
    ? "#fef9c3"
    : Brand.greenLight;
  const textColor = isFull
    ? colors.destructive
    : isUrgent
    ? "#d97706"
    : Brand.green;
  const emoji = isFull ? "😔" : isUrgent ? "🔥" : "👥";

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: textColor }]}>
        {emoji} {isFull ? "Full" : `${spotsLeft} left`}
      </Text>
    </View>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    // paddingBottom is set dynamically via insets.bottom in contentContainerStyle
  },

  // Header
  header: {
    paddingHorizontal: 20,
    gap: 4,
    marginBottom: 16,
  },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    marginHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: Brand.green,
  },
  tabText: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },

  // Shift list
  shiftList: {
    marginTop: 16,
    paddingHorizontal: 20,
    gap: 10,
  },

  // Card
  card: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  dateStrip: {
    width: 54,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  dateStripDay: {
    fontSize: 22,
    fontFamily: FontFamily.bold,
  },
  dateStripMonth: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    textTransform: "uppercase",
  },
  cardContent: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  cardTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  shiftTypeName: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    flex: 1,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailEmoji: {
    fontSize: 11,
  },
  detailText: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },
  detailDot: {
    fontSize: 12,
    marginHorizontal: 2,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  noteEmoji: {
    fontSize: 11,
  },
  noteText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    flex: 1,
  },
  capacityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  capacityBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  capacityFill: {
    height: "100%",
    borderRadius: 2,
  },
  capacityText: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    width: 32,
  },
  chevron: {
    alignSelf: "center",
    marginRight: 12,
  },

  // Pills
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pillText: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 32,
  },
  footerText: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    textAlign: "center",
  },
});
