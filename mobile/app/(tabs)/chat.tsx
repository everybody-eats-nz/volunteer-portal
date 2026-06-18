import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Eyebrow } from "@/components/ui/eyebrow";
import { Brand, Colors, FontFamily, Palette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTeamUnreadCount } from "@/hooks/use-team-unread";
import { fetchTeamThread } from "@/lib/messages";

/* ─── Editorial palette ─────────────────────────────────────── */

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

function usePaperTint(
  isDark: boolean,
  colors: (typeof Colors)["light"]
): PaperTint {
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

/* ─── Help landing ──────────────────────────────────────────── */

export default function HelpScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const paperTint = usePaperTint(isDark, colors);
  const router = useRouter();

  const [hoursLabel, setHoursLabel] = useState<string | null>(null);
  const [openNow, setOpenNow] = useState<boolean | null>(null);
  const [latestAdminMessage, setLatestAdminMessage] = useState<string | null>(
    null
  );
  const teamUnreadCount = useTeamUnreadCount();

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchTeamThread();
      const lastAdmin = [...data.messages]
        .reverse()
        .find((m) => m.senderRole === "ADMIN");
      setLatestAdminMessage(
        data.thread.unread && lastAdmin ? lastAdmin.body : null
      );
      if (data.hours) {
        setOpenNow(data.hours.isOpenNow);
        if (data.hours.isOpenNow) {
          setHoursLabel("Online · usually replies quickly");
        } else if (data.hours.nextOpenLabel) {
          setHoursLabel(
            `Currently offline · ${data.hours.nextOpenLabel.toLowerCase()}`
          );
        } else {
          setHoursLabel("Currently offline · we'll reply when we're around");
        }
      } else {
        setOpenNow(null);
        setHoursLabel(null);
      }
    } catch {
      // Quiet failure — landing screen still functions without status data.
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Refresh on focus so the unread dot clears after the thread is read.
  useFocusEffect(
    useCallback(() => {
      void loadStatus();
    }, [loadStatus])
  );

  const goToAi = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/help/ai");
  };
  const goToTeam = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/help/team");
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
          Everybody Eats help
        </Eyebrow>

        <View style={styles.heroBlock}>
          <Text style={styles.heroLine}>
            <Text style={[styles.hero, { color: paperTint.ink }]}>Kia </Text>
            <Text style={[styles.hero, styles.heroAccent, { color: paperTint.ink }]}>
              ora
            </Text>
          </Text>
          <Text style={[styles.heroSubtitle, { color: paperTint.inkSoft }]}>
            How can we help today?
          </Text>
        </View>

        <View style={[styles.hairline, { backgroundColor: paperTint.rule }]} />

        <View style={styles.channelEyebrow}>
          <Eyebrow color={paperTint.eyebrow}>Pick a channel</Eyebrow>
        </View>

        <View style={styles.optionList}>
          <OptionRow
            emoji="🌿"
            title="Ask the AI assistant"
            description="Instant answers, day or night"
            onPress={goToAi}
            paperTint={paperTint}
            colors={colors}
            firstRow
          />
          <OptionRow
            emoji="💬"
            title="Message the team"
            description={
              hoursLabel ?? "Real humans · we'll reply when we're around"
            }
            onPress={goToTeam}
            paperTint={paperTint}
            colors={colors}
            statusDotColor={openNow ? "#22c55e" : null}
            unreadCount={teamUnreadCount}
            preview={latestAdminMessage}
          />
        </View>

        <View style={styles.welcomeFooter}>
          <View
            style={[
              styles.hairline,
              { backgroundColor: paperTint.rule, marginBottom: 14 },
            ]}
          />
          <View style={styles.footerEyebrow}>
            <Eyebrow color={colors.textSecondary} rule={false}>
              Ngā mihi · we&apos;re here to help
            </Eyebrow>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Option row ────────────────────────────────────────────── */

function OptionRow({
  emoji,
  title,
  description,
  onPress,
  paperTint,
  colors,
  firstRow = false,
  statusDotColor,
  unreadCount = 0,
  preview,
}: {
  emoji: string;
  title: string;
  description: string;
  onPress: () => void;
  paperTint: PaperTint;
  colors: (typeof Colors)["light"];
  firstRow?: boolean;
  statusDotColor?: string | null;
  unreadCount?: number;
  preview?: string | null;
}) {
  const hasUnread = unreadCount > 0;
  const previewText = hasUnread && preview ? preview.replace(/\s+/g, " ").trim() : null;
  const countLabel = unreadCount > 99 ? "99+" : String(unreadCount);
  const a11yLabel = hasUnread
    ? `${title}. ${unreadCount} unread ${unreadCount === 1 ? "message" : "messages"}.${previewText ? ` Latest: ${previewText}` : ""}`
    : `${title}. ${description}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
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
      <View
        style={[
          styles.optionEmojiWrap,
          { backgroundColor: paperTint.accent },
        ]}
      >
        <Text style={styles.optionEmoji}>{emoji}</Text>
      </View>
      <View style={styles.optionBody}>
        <View style={styles.optionTitleRow}>
          <Text style={[styles.optionTitle, { color: colors.text }]}>
            {title}
          </Text>
          {hasUnread && (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadPillText}>
                {countLabel} new
              </Text>
            </View>
          )}
        </View>
        {previewText ? (
          <Text
            style={[styles.optionPreview, { color: colors.text }]}
            numberOfLines={2}
          >
            <Text style={[styles.optionPreviewQuote, { color: Brand.green }]}>
              {"“"}
            </Text>
            {previewText}
            <Text style={[styles.optionPreviewQuote, { color: Brand.green }]}>
              {"”"}
            </Text>
          </Text>
        ) : (
          <View style={styles.descriptionRow}>
            {statusDotColor && !hasUnread && (
              <View
                style={[
                  styles.statusInlineDot,
                  { backgroundColor: statusDotColor },
                ]}
              />
            )}
            <Text
              style={[
                styles.optionDescription,
                { color: paperTint.inkSoft, flex: 1 },
              ]}
              numberOfLines={2}
            >
              {description}
            </Text>
          </View>
        )}
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
  scrollContent: { paddingHorizontal: 24 },
  eyebrowSpacing: {
    marginBottom: 20,
  },
  channelEyebrow: {
    marginTop: 28,
    marginBottom: 16,
  },
  footerEyebrow: {
    alignSelf: "center",
  },
  heroBlock: { marginBottom: 28 },
  heroLine: { marginBottom: 18 },
  hero: {
    fontFamily: FontFamily.display,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1,
  },
  heroAccent: {
    fontFamily: FontFamily.displayItalic,
  },
  heroSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 17,
    lineHeight: 26,
    maxWidth: 320,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
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
  optionRowSpacing: {
    marginTop: 12,
  },
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
  optionTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 17,
    lineHeight: 22,
  },
  optionDescription: {
    fontFamily: FontFamily.regular,
    fontSize: 13.5,
    lineHeight: 18,
  },
  optionArrow: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  unreadPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Brand.green,
  },
  unreadPillText: {
    color: Palette.cream50,
    fontFamily: FontFamily.semiBold,
    fontSize: 10.5,
    letterSpacing: 0.4,
  },
  optionPreview: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  optionPreviewQuote: {
    fontFamily: FontFamily.headingBold,
    fontSize: 16,
  },
  descriptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusInlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  welcomeFooter: { marginTop: 44 },
});
