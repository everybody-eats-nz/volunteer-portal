import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import React, { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Eyebrow } from "@/components/ui/eyebrow";
import { Brand, Colors, FontFamily, Palette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  useAdminPending,
  useAdminToday,
  useAdminUnreadCount,
} from "@/hooks/use-admin";
import { useAuth } from "@/lib/auth";

/* ─── Editorial palette (mirrors the Help landing) ──────────────── */

type PaperTint = {
  paper: string;
  ink: string;
  inkSoft: string;
  rule: string;
  accent: string;
  eyebrow: string;
  card: string;
  cardStroke: string;
};

function usePaperTint(isDark: boolean, colors: (typeof Colors)["light"]): PaperTint {
  return {
    paper: colors.background,
    ink: isDark ? colors.text : Brand.green,
    inkSoft: colors.textSecondary,
    rule: isDark ? "rgba(253,248,239,0.12)" : "rgba(29,83,55,0.14)",
    accent: Brand.accent,
    eyebrow: isDark ? Brand.greenLight : Brand.green,
    card: isDark ? colors.surfaceSoft : Palette.cream100,
    cardStroke: isDark ? "rgba(253,248,239,0.10)" : "rgba(29,83,55,0.12)",
  };
}

/* ─── Admin hub ─────────────────────────────────────────────── */

export default function AdminScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const paperTint = usePaperTint(isDark, colors);
  const router = useRouter();
  const { user } = useAuth();

  const unread = useAdminUnreadCount(true);
  const pending = useAdminPending();
  const today = useAdminToday("");

  const refetchAll = useCallback(() => {
    void pending.refetch();
    void today.refetch();
  }, [pending, today]);

  // Keep the hub's live counts fresh when the user returns to it.
  useFocusEffect(
    useCallback(() => {
      refetchAll();
    }, [refetchAll])
  );

  // Non-admins never see the tab, but guard the route directly too.
  if (user && user.role !== "ADMIN") {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: paperTint.paper }]}>
        <Text style={[styles.guardText, { color: paperTint.inkSoft }]}>
          This area is for the Everybody Eats team.
        </Text>
      </View>
    );
  }

  const pendingCount = pending.data?.length ?? 0;
  const shortShifts = (today.data ?? []).filter((s) => s.fillGap > 0).length;
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "team";

  const go = (path: "/admin/messages" | "/admin/shifts/today" | "/admin/approvals") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(path as Href);
  };

  return (
    <View style={[styles.container, { backgroundColor: paperTint.paper }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 48 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Eyebrow color={paperTint.eyebrow} style={styles.eyebrowSpacing}>
          Everybody Eats · Admin
        </Eyebrow>

        <View style={styles.heroBlock}>
          <Text style={styles.heroLine}>
            <Text style={[styles.hero, { color: paperTint.ink }]}>Kia ora, </Text>
            <Text style={[styles.hero, styles.heroAccent, { color: paperTint.ink }]}>
              {firstName}
            </Text>
          </Text>
          <Text style={[styles.heroSubtitle, { color: paperTint.inkSoft }]}>
            Run the floor from your pocket — reply to volunteers, check tonight&apos;s
            roster, clear the approval queue.
          </Text>
        </View>

        <View style={[styles.hairline, { backgroundColor: paperTint.rule }]} />

        <View style={styles.channelEyebrow}>
          <Eyebrow color={paperTint.eyebrow}>What needs you</Eyebrow>
        </View>

        <View style={styles.optionList}>
          <ActionRow
            emoji="💬"
            title="Messages"
            description={
              unread > 0
                ? `${unread} ${unread === 1 ? "thread" : "threads"} awaiting a reply`
                : "Reply to volunteers, all caught up"
            }
            badgeCount={unread}
            badgeTone="primary"
            onPress={() => go("/admin/messages")}
            paperTint={paperTint}
            colors={colors}
            firstRow
          />
          <ActionRow
            emoji="📋"
            title="Approvals"
            description={
              pendingCount > 0
                ? `${pendingCount} signup${pendingCount === 1 ? "" : "s"} waiting on you`
                : "No pending signups right now"
            }
            badgeCount={pendingCount}
            badgeTone="primary"
            onPress={() => go("/admin/approvals")}
            paperTint={paperTint}
            colors={colors}
          />
          <ActionRow
            emoji="🍽️"
            title="Tonight's shifts"
            description={
              shortShifts > 0
                ? `${shortShifts} shift${shortShifts === 1 ? "" : "s"} still short on volunteers`
                : "Roster looks covered for today"
            }
            badgeCount={shortShifts}
            badgeTone="warn"
            onPress={() => go("/admin/shifts/today")}
            paperTint={paperTint}
            colors={colors}
          />
        </View>

        <View style={styles.welcomeFooter}>
          <View style={[styles.hairline, { backgroundColor: paperTint.rule, marginBottom: 14 }]} />
          <View style={styles.footerEyebrow}>
            <Eyebrow color={colors.textSecondary} rule={false}>
              Ngā mihi · thanks for steering the waka
            </Eyebrow>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Action row ────────────────────────────────────────────── */

function ActionRow({
  emoji,
  title,
  description,
  badgeCount = 0,
  badgeTone = "primary",
  onPress,
  paperTint,
  colors,
  firstRow = false,
}: {
  emoji: string;
  title: string;
  description: string;
  badgeCount?: number;
  badgeTone?: "primary" | "warn";
  onPress: () => void;
  paperTint: PaperTint;
  colors: (typeof Colors)["light"];
  firstRow?: boolean;
}) {
  const hasBadge = badgeCount > 0;
  const countLabel = badgeCount > 99 ? "99+" : String(badgeCount);
  const badgeBg = badgeTone === "warn" ? colors.destructive : Brand.green;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        hasBadge ? `${title}. ${badgeCount}. ${description}` : `${title}. ${description}`
      }
      style={({ pressed }) => [
        styles.optionRow,
        {
          backgroundColor: paperTint.card,
          borderColor: paperTint.cardStroke,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
        !firstRow && styles.optionRowSpacing,
      ]}
    >
      <View style={[styles.optionEmojiWrap, { backgroundColor: paperTint.accent }]}>
        <Text style={styles.optionEmoji}>{emoji}</Text>
      </View>
      <View style={styles.optionBody}>
        <View style={styles.optionTitleRow}>
          <Text style={[styles.optionTitle, { color: colors.text }]}>{title}</Text>
          {hasBadge && (
            <View style={[styles.badgePill, { backgroundColor: badgeBg }]}>
              <Text style={styles.badgePillText}>{countLabel}</Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.optionDescription, { color: paperTint.inkSoft }]}
          numberOfLines={2}
        >
          {description}
        </Text>
      </View>
      <View style={[styles.optionArrow, { backgroundColor: Brand.green }]}>
        <Ionicons name="arrow-forward" size={16} color={Palette.cream50} />
      </View>
    </Pressable>
  );
}

/* ─── Styles ────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  guardText: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  scrollContent: { paddingHorizontal: 24 },
  eyebrowSpacing: { marginBottom: 20 },
  channelEyebrow: { marginTop: 28, marginBottom: 16 },
  footerEyebrow: { alignSelf: "center" },
  heroBlock: { marginBottom: 28 },
  heroLine: { marginBottom: 18 },
  hero: {
    fontFamily: FontFamily.display,
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: -1,
  },
  heroAccent: { fontFamily: FontFamily.displayItalic },
  heroSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    lineHeight: 25,
    maxWidth: 340,
  },
  hairline: { height: StyleSheet.hairlineWidth, width: "100%" },
  optionList: { marginTop: 4 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 14,
    borderRadius: 24,
    borderWidth: 1,
  },
  optionRowSpacing: { marginTop: 12 },
  optionEmojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  optionEmoji: { fontSize: 22 },
  optionBody: { flex: 1 },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  optionTitle: { fontFamily: FontFamily.semiBold, fontSize: 17, lineHeight: 22 },
  optionDescription: { fontFamily: FontFamily.regular, fontSize: 13.5, lineHeight: 18 },
  optionArrow: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  badgePill: {
    minWidth: 22,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignItems: "center",
  },
  badgePillText: {
    color: Palette.cream50,
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  welcomeFooter: { marginTop: 44 },
});
