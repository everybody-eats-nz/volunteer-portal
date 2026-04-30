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

import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { fetchTeamThread } from "@/lib/messages";

/* ─── Editorial palette ─────────────────────────────────────── */

type PaperTint = {
  paper: string;
  ink: string;
  inkSoft: string;
  rule: string;
  accent: string;
  eyebrow: string;
};

function usePaperTint(
  isDark: boolean,
  colors: (typeof Colors)["light"]
): PaperTint {
  return {
    paper: colors.background,
    ink: isDark ? colors.text : Brand.green,
    inkSoft: isDark ? colors.textSecondary : "#4a5a4f",
    rule: isDark ? "rgba(232,245,232,0.12)" : "rgba(14,58,35,0.14)",
    accent: Brand.accent,
    eyebrow: isDark ? Brand.greenLight : Brand.green,
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

  const [unread, setUnread] = useState(false);
  const [hoursLabel, setHoursLabel] = useState<string | null>(null);
  const [openNow, setOpenNow] = useState<boolean | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchTeamThread();
      setUnread(data.thread.unread);
      if (data.hours) {
        setOpenNow(data.hours.isOpenNow);
        if (data.hours.isOpenNow) {
          setHoursLabel("Team is online · usually replies quickly");
        } else if (data.hours.nextOpenLabel) {
          setHoursLabel(data.hours.nextOpenLabel);
        } else {
          setHoursLabel(null);
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
        <Text style={[styles.eyebrow, { color: paperTint.eyebrow }]}>
          EVERYBODY EATS HELP
        </Text>

        <View style={styles.heroBlock}>
          <Text style={styles.heroLine}>
            <Text style={[styles.hero, { color: paperTint.ink }]}>Kia ora</Text>
            <Text style={[styles.hero, { color: paperTint.accent }]}>.</Text>
          </Text>
          <Text style={[styles.heroSubtitle, { color: paperTint.inkSoft }]}>
            How can we help today?
          </Text>
        </View>

        <View style={[styles.hairline, { backgroundColor: paperTint.rule }]} />

        <Text
          style={[
            styles.eyebrow,
            { color: paperTint.eyebrow, marginTop: 28, marginBottom: 4 },
          ]}
        >
          PICK A CHANNEL
        </Text>

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
            statusDotColor={
              openNow == null
                ? null
                : openNow
                ? "#22c55e"
                : paperTint.inkSoft
            }
            unread={unread}
          />
        </View>

        <View style={styles.welcomeFooter}>
          <View
            style={[
              styles.hairline,
              { backgroundColor: paperTint.rule, marginBottom: 14 },
            ]}
          />
          <Text style={[styles.eyebrowCentered, { color: colors.textSecondary }]}>
            NGĀ MIHI · WE&apos;RE HERE TO HELP
          </Text>
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
  unread = false,
}: {
  emoji: string;
  title: string;
  description: string;
  onPress: () => void;
  paperTint: PaperTint;
  colors: (typeof Colors)["light"];
  firstRow?: boolean;
  statusDotColor?: string | null;
  unread?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      style={({ pressed }) => [
        styles.optionRow,
        {
          borderBottomColor: paperTint.rule,
          borderBottomWidth: StyleSheet.hairlineWidth,
          opacity: pressed ? 0.6 : 1,
        },
        firstRow && {
          borderTopColor: paperTint.rule,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={styles.optionEmojiWrap}>
        <Text style={styles.optionEmoji}>{emoji}</Text>
      </View>
      <View style={styles.optionBody}>
        <View style={styles.optionTitleRow}>
          <Text style={[styles.optionTitle, { color: colors.text }]}>
            {title}
          </Text>
          {unread && (
            <View style={[styles.unreadDot, { backgroundColor: "#22c55e" }]} />
          )}
        </View>
        <Text
          style={[styles.optionDescription, { color: paperTint.inkSoft }]}
          numberOfLines={2}
        >
          {description}
        </Text>
        {statusDotColor && (
          <View style={styles.statusRow}>
            <View
              style={[styles.statusInlineDot, { backgroundColor: statusDotColor }]}
            />
          </View>
        )}
      </View>
      <Ionicons
        name="arrow-forward"
        size={16}
        color={paperTint.eyebrow}
        style={styles.optionArrow}
      />
    </Pressable>
  );
}

/* ─── Styles ────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },
  eyebrow: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 20,
  },
  eyebrowCentered: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10.5,
    letterSpacing: 1.8,
    textAlign: "center",
  },
  heroBlock: { marginBottom: 28 },
  heroLine: { marginBottom: 18 },
  hero: {
    fontFamily: FontFamily.headingBold,
    fontSize: 64,
    lineHeight: 66,
    letterSpacing: -1.2,
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
    paddingVertical: 22,
    gap: 14,
  },
  optionEmojiWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  optionArrow: { marginLeft: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  statusInlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  welcomeFooter: { marginTop: 44 },
});
