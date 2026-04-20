import { Ionicons } from "@expo/vector-icons";
import { differenceInDays } from "date-fns";
import { formatNZT } from "@/lib/dates";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useFriendProfile } from "@/hooks/use-friend-profile";
import { api } from "@/lib/api";
import { getShiftThemeByName } from "@/lib/dummy-data";

/* ─── Screen ────────────────────────────────────────────────── */

export default function FriendProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const { profile: friend, isLoading, error } = useFriendProfile(id);
  const [isBlocking, setIsBlocking] = useState(false);

  const handleBlock = () => {
    Alert.alert(
      "Block User",
      `Block ${
        friend?.name ?? "this user"
      }? Their content will be immediately removed from your feed. The Everybody Eats team will be notified.`,
      [
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            setIsBlocking(true);
            try {
              await api(`/api/mobile/users/${id}/block`, { method: "POST" });
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              Alert.alert(
                "User Blocked",
                `${
                  friend?.name ?? "This user"
                } has been blocked and removed from your feed.`,
                [{ text: "OK", onPress: () => router.back() }]
              );
            } catch {
              Alert.alert(
                "Error",
                "Could not block this user. Please try again."
              );
            } finally {
              setIsBlocking(false);
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleReport = () => {
    Alert.alert(
      "Report User",
      `Why are you reporting ${friend?.name ?? "this user"}?`,
      [
        {
          text: "Offensive or abusive behaviour",
          onPress: async () => {
            try {
              await api("/api/mobile/report", {
                method: "POST",
                body: {
                  targetType: "user",
                  targetId: id,
                  reason: "Offensive or abusive behaviour",
                },
              });
              Alert.alert(
                "Report Submitted",
                "Thank you. The Everybody Eats team will review this within 24 hours."
              );
            } catch {
              Alert.alert(
                "Error",
                "Could not submit report. Please try again."
              );
            }
          },
        },
        {
          text: "Harassment",
          onPress: async () => {
            try {
              await api("/api/mobile/report", {
                method: "POST",
                body: {
                  targetType: "user",
                  targetId: id,
                  reason: "Harassment",
                },
              });
              Alert.alert(
                "Report Submitted",
                "Thank you. The Everybody Eats team will review this within 24 hours."
              );
            } catch {
              Alert.alert(
                "Error",
                "Could not submit report. Please try again."
              );
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <Stack.Screen options={{ title: "", headerTransparent: true }} />
        <ActivityIndicator size="large" color={Brand.green} />
      </View>
    );
  }

  if (error || !friend) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <Stack.Screen options={{ title: "", headerTransparent: true }} />
        <Text style={{ fontSize: 48, marginBottom: 12 }}>😕</Text>
        <ThemedText type="heading">Friend not found</ThemedText>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text
            style={[
              styles.backLinkText,
              { color: isDark ? Brand.greenLight : Brand.green },
            ]}
          >
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  const firstName = friend.name.split(" ")[0];
  const daysSinceFriends = differenceInDays(
    new Date(),
    new Date(friend.friendsSince)
  );
  const isNewFriend = daysSinceFriends <= 30;
  const isCloseBuddy = friend.shiftsTogether > 10;
  const connectedSince = formatNZT(new Date(friend.friendsSince), "MMMM yyyy");

  /* Derived layout values */
  const heroHeight = insets.top + 128;
  const avatarSize = 104;
  const accentShapeSize = 220;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "",
          headerTransparent: true,
          headerTintColor: "#fffdf7",
        }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 24) + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero canvas ────────────────────────────────── */}
        <View style={[styles.hero, { height: heroHeight }]}>
          <LinearGradient
            colors={
              isDark ? ["#13311f", Brand.greenDark] : [Brand.green, "#0b2c1a"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Diagonal accent plane — signature Everybody Eats lime */}
          <View
            style={[
              styles.accentShape,
              {
                width: accentShapeSize,
                height: accentShapeSize,
                top: heroHeight - accentShapeSize * 0.55,
                right: -accentShapeSize * 0.35,
                backgroundColor: isDark ? "#2a3b1a" : Brand.accent,
                opacity: isDark ? 0.55 : 0.85,
              },
            ]}
          />
          {/* Faint grid dots for editorial texture */}
          <View
            style={[
              styles.gridDot,
              { top: insets.top + 8, left: 24, opacity: isDark ? 0.4 : 0.5 },
            ]}
          />
          <View
            style={[
              styles.gridDot,
              { top: insets.top + 8, left: 40, opacity: isDark ? 0.2 : 0.25 },
            ]}
          />
          <View
            style={[
              styles.gridDot,
              { top: insets.top + 24, left: 24, opacity: isDark ? 0.2 : 0.25 },
            ]}
          />
        </View>

        {/* ── Identity block (avatar overlaps hero) ───────── */}
        <View style={[styles.identityBlock, { marginTop: -avatarSize / 2 }]}>
          <View style={styles.avatarWrap}>
            {friend.profilePhotoUrl ? (
              <Image
                source={{ uri: friend.profilePhotoUrl }}
                style={[
                  styles.avatar,
                  {
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                    borderColor: colors.background,
                  },
                ]}
              />
            ) : (
              <View
                style={[
                  styles.avatarFallback,
                  {
                    width: avatarSize,
                    height: avatarSize,
                    borderRadius: avatarSize / 2,
                    borderColor: colors.background,
                    backgroundColor: isDark ? "#223524" : Brand.greenLight,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.avatarInitial,
                    { color: isDark ? Brand.greenLight : Brand.green },
                  ]}
                >
                  {friend.name.charAt(0)}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.heroName, { color: colors.text }]}>
            {friend.name}
          </Text>

          <Text
            style={[styles.connectedSince, { color: colors.textSecondary }]}
          >
            Connected since {connectedSince}
            <Text
              style={{ color: isDark ? Brand.accentSubtle : Brand.greenHover }}
            >
              {" "}
              · {daysSinceFriends} days
            </Text>
          </Text>

          {(isNewFriend || isCloseBuddy) && (
            <View style={styles.badgeRow}>
              {isNewFriend && (
                <Badge
                  label="New friend"
                  emoji="✨"
                  tone="accent"
                  isDark={isDark}
                />
              )}
              {isCloseBuddy && (
                <Badge
                  label="Close buddy"
                  emoji="🤝"
                  tone="green"
                  isDark={isDark}
                />
              )}
            </View>
          )}
        </View>

        {/* ── Connection bento (asymmetric) ────────────── */}
        <View style={styles.bento}>
          {/* Hero stat — shared shifts */}
          <View
            style={[
              styles.bentoHero,
              {
                backgroundColor: isDark ? "#262a1a" : Brand.accent,
              },
            ]}
          >
            <Text
              style={[
                styles.bentoLabel,
                { color: isDark ? "#bdc48a" : "#3d4416" },
              ]}
            >
              SHARED SHIFTS
            </Text>
            <Text
              style={[
                styles.bentoHeroValue,
                { color: isDark ? "#f0f8a0" : "#0e3a23" },
              ]}
            >
              {friend.shiftsTogether}
            </Text>
            <Text
              style={[
                styles.bentoHeroCaption,
                { color: isDark ? "#bdc48a" : "#3d4416" },
              ]}
            >
              mahi done together
            </Text>
            {/* Decorative arc in the corner */}
            <View
              style={[
                styles.bentoArc,
                {
                  borderColor: isDark ? "#3d4416" : "#0e3a23",
                  opacity: 0.14,
                },
              ]}
            />
          </View>

          <View style={styles.bentoColumn}>
            <View
              style={[
                styles.bentoMini,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[styles.bentoLabel, { color: colors.textSecondary }]}
              >
                THEIR HOURS
              </Text>
              <Text style={[styles.bentoMiniValue, { color: colors.text }]}>
                {friend.hoursVolunteered}
              </Text>
            </View>
            <View
              style={[
                styles.bentoMini,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[styles.bentoLabel, { color: colors.textSecondary }]}
              >
                TOTAL SHIFTS
              </Text>
              <Text style={[styles.bentoMiniValue, { color: colors.text }]}>
                {friend.totalShifts}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Their Mahi ─────────────────────────────────── */}
        <SectionHeading title="Their mahi" colors={colors} />

        <View style={styles.section}>
          <View
            style={[
              styles.rhythmCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <RhythmStat
              value={friend.shiftsThisMonth.toString()}
              label="This month"
              colors={colors}
              isDark={isDark}
            />
            <View
              style={[styles.rhythmDivider, { backgroundColor: colors.border }]}
            />
            <RhythmStat
              value={friend.avgPerMonth.toString()}
              label="Avg / month"
              colors={colors}
              isDark={isDark}
            />
            <View
              style={[styles.rhythmDivider, { backgroundColor: colors.border }]}
            />
            <RhythmStat
              value={friend.totalShifts.toString()}
              label="All-time"
              colors={colors}
              isDark={isDark}
            />
          </View>

          {/* Favourite role — feature card with lime left rule */}
          <View
            style={[
              styles.featureCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.featureRule,
                { backgroundColor: isDark ? Brand.accent : Brand.green },
              ]}
            />
            <View style={styles.featureBody}>
              <Text
                style={[styles.featureEyebrow, { color: colors.textSecondary }]}
              >
                FAVOURITE ROLE
              </Text>
              <View style={styles.featureRow}>
                <Text style={styles.featureEmoji}>
                  {getShiftThemeByName(friend.favoriteRole).emoji}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.featureTitle, { color: colors.text }]}>
                    {friend.favoriteRole}
                  </Text>
                  <Text
                    style={[
                      styles.featureMeta,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Completed {friend.favoriteRoleCount}{" "}
                    {friend.favoriteRoleCount === 1 ? "time" : "times"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ── Shared moments ─────────────────────────────── */}
        <SectionHeading title="Shared moments" colors={colors} />

        <View style={styles.section}>
          {friend.sharedShifts.length > 0 ? (
            <View>
              {friend.sharedShifts.slice(0, 5).map((shift, idx) => {
                const isLast =
                  idx === Math.min(friend.sharedShifts.length, 5) - 1;
                const shiftDate = new Date(shift.date);
                return (
                  <View key={shift.id} style={styles.timelineRow}>
                    {/* Date column */}
                    <View style={styles.timelineDateCol}>
                      <Text
                        style={[styles.timelineDay, { color: colors.text }]}
                      >
                        {formatNZT(shiftDate, "d")}
                      </Text>
                      <Text
                        style={[
                          styles.timelineMonth,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {formatNZT(shiftDate, "MMM").toUpperCase()}
                      </Text>
                    </View>

                    {/* Rail + node */}
                    <View style={styles.timelineRail}>
                      <View
                        style={[
                          styles.timelineNode,
                          {
                            backgroundColor: shift.isUpcoming
                              ? isDark
                                ? Brand.accent
                                : Brand.green
                              : colors.border,
                            borderColor: colors.background,
                          },
                        ]}
                      />
                      {!isLast && (
                        <View
                          style={[
                            styles.timelineLine,
                            { backgroundColor: colors.border },
                          ]}
                        />
                      )}
                    </View>

                    {/* Content */}
                    <View style={styles.timelineContent}>
                      <Text
                        style={[styles.timelineTitle, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {shift.type}
                      </Text>
                      <Text
                        style={[
                          styles.timelineMeta,
                          { color: colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {shift.location}
                      </Text>
                      {shift.isUpcoming && (
                        <View
                          style={[
                            styles.upcomingTag,
                            {
                              backgroundColor: isDark
                                ? "rgba(248,251,105,0.12)"
                                : "#f6f8d4",
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.upcomingDot,
                              {
                                backgroundColor: isDark
                                  ? Brand.accent
                                  : Brand.green,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.upcomingTagText,
                              {
                                color: isDark ? Brand.accent : Brand.greenHover,
                              },
                            ]}
                          >
                            Coming up
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
              {friend.sharedShifts.length > 5 && (
                <Text
                  style={[styles.moreText, { color: colors.textSecondary }]}
                >
                  + {friend.sharedShifts.length - 5} more shifts together
                </Text>
              )}
            </View>
          ) : (
            <EmptyCanvas
              title="No shared shifts yet"
              subtitle={`Sign up for the same shifts to create moments with ${firstName}.`}
              colors={colors}
              isDark={isDark}
            />
          )}
        </View>

        {/* ── Coming up ──────────────────────────────────── */}
        <SectionHeading title={`${firstName}'s coming up`} colors={colors} />

        <View style={styles.section}>
          {friend.upcomingShifts.length > 0 ? (
            <View style={{ gap: 10 }}>
              {friend.upcomingShifts.map((shift) => {
                const theme = getShiftThemeByName(shift.type);
                const date = new Date(shift.date);
                return (
                  <View
                    key={shift.id}
                    style={[
                      styles.upcomingRow,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.upcomingIcon,
                        {
                          backgroundColor: isDark
                            ? theme.bgDark
                            : theme.bgLight,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 22 }}>{theme.emoji}</Text>
                    </View>
                    <View style={styles.upcomingBody}>
                      <Text
                        style={[styles.upcomingType, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {shift.type}
                      </Text>
                      <Text
                        style={[
                          styles.upcomingMeta,
                          { color: colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {shift.location} · {shift.time}
                      </Text>
                    </View>
                    <Text style={[styles.upcomingDate, { color: colors.text }]}>
                      {formatNZT(date, "MMM d")}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyCanvas
              title="Quiet for now"
              subtitle={`Check back later — ${firstName}'s schedule will appear here.`}
              colors={colors}
              isDark={isDark}
            />
          )}
        </View>

        {/* ── Primary CTA ────────────────────────────────── */}
        <View style={[styles.section, { marginTop: 28 }]}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/shifts");
            }}
            style={({ pressed }) => [
              styles.ctaButton,
              {
                backgroundColor: isDark ? Brand.accent : Brand.green,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
            accessibilityLabel="Browse shifts to volunteer together"
            accessibilityRole="button"
          >
            <Ionicons
              name="arrow-forward"
              size={18}
              color={isDark ? Brand.green : "#fffdf7"}
              style={{ marginRight: 2 }}
            />
            <Text
              style={[
                styles.ctaText,
                { color: isDark ? Brand.green : "#fffdf7" },
              ]}
            >
              Browse shifts together
            </Text>
          </Pressable>
        </View>

        {/* ── Safety actions ─────────────────────────────── */}
        <View style={[styles.section, styles.safetyRow]}>
          <Pressable
            onPress={handleReport}
            style={({ pressed }) => [
              styles.safetyBtn,
              {
                borderColor: colors.border,
                backgroundColor: "transparent",
                opacity: pressed ? 0.6 : 1,
              },
            ]}
            accessibilityLabel="Report this user"
            accessibilityRole="button"
          >
            <Ionicons
              name="flag-outline"
              size={15}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.safetyBtnText, { color: colors.textSecondary }]}
            >
              Report
            </Text>
          </Pressable>

          <Pressable
            onPress={handleBlock}
            disabled={isBlocking}
            style={({ pressed }) => [
              styles.safetyBtn,
              {
                borderColor: isDark ? "rgba(239,68,68,0.35)" : "#fecaca",
                backgroundColor: "transparent",
                opacity: pressed || isBlocking ? 0.6 : 1,
              },
            ]}
            accessibilityLabel="Block this user"
            accessibilityRole="button"
          >
            <Ionicons
              name="ban-outline"
              size={15}
              color={isDark ? "#fca5a5" : "#dc2626"}
            />
            <Text
              style={[
                styles.safetyBtnText,
                { color: isDark ? "#fca5a5" : "#dc2626" },
              ]}
            >
              {isBlocking ? "Blocking…" : "Block"}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.footerNote, { color: colors.textSecondary }]}>
          Treat our whānau with manaakitanga.
        </Text>
      </ScrollView>
    </View>
  );
}

/* ─── Sub-components ────────────────────────────────────────── */

function SectionHeading({
  title,
  colors,
}: {
  title: string;
  colors: (typeof Colors)["light"];
}) {
  return (
    <View style={styles.sectionMarker}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <View
        style={[styles.sectionMarkerRule, { backgroundColor: colors.border }]}
      />
    </View>
  );
}

function RhythmStat({
  value,
  label,
  colors,
  isDark,
}: {
  value: string;
  label: string;
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  return (
    <View style={styles.rhythmStat}>
      <Text style={[styles.rhythmValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.rhythmLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

function Badge({
  label,
  emoji,
  tone,
  isDark,
}: {
  label: string;
  emoji: string;
  tone: "accent" | "green";
  isDark: boolean;
}) {
  const bg =
    tone === "accent"
      ? isDark
        ? "rgba(248,251,105,0.14)"
        : "#fbfdc6"
      : isDark
      ? "rgba(134,239,172,0.14)"
      : Brand.greenLight;
  const fg =
    tone === "accent"
      ? isDark
        ? Brand.accent
        : "#3d4416"
      : isDark
      ? "#86efac"
      : Brand.green;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ fontSize: 12 }}>{emoji}</Text>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function EmptyCanvas({
  title,
  subtitle,
  colors,
  isDark,
}: {
  title: string;
  subtitle: string;
  colors: (typeof Colors)["light"];
  isDark: boolean;
}) {
  return (
    <View
      style={[
        styles.emptyCanvas,
        {
          borderColor: colors.border,
          backgroundColor: isDark
            ? "rgba(255,255,255,0.015)"
            : "rgba(14,58,35,0.02)",
        },
      ]}
    >
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {subtitle}
      </Text>
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────────── */

const HORIZONTAL = 22;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  backLink: {
    marginTop: 16,
    padding: 12,
  },
  backLinkText: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },

  /* Hero */
  hero: {
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  accentShape: {
    position: "absolute",
    borderRadius: 999,
  },
  gridDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#fffdf7",
  },
  /* Identity */
  identityBlock: {
    alignItems: "center",
    paddingHorizontal: HORIZONTAL,
  },
  avatarWrap: {
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  avatar: {
    borderWidth: 4,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
  },
  avatarInitial: {
    fontSize: 44,
    fontFamily: FontFamily.headingBold,
  },
  heroName: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: FontFamily.headingBold,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  connectedSince: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: FontFamily.regular,
    textAlign: "center",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.2,
  },

  /* Bento */
  bento: {
    flexDirection: "row",
    gap: 10,
    marginTop: 26,
    marginHorizontal: HORIZONTAL,
  },
  bentoHero: {
    flex: 1.35,
    borderRadius: 20,
    padding: 20,
    justifyContent: "space-between",
    overflow: "hidden",
    minHeight: 160,
  },
  bentoArc: {
    position: "absolute",
    right: -60,
    bottom: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
  },
  bentoColumn: {
    flex: 1,
    gap: 10,
  },
  bentoMini: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "space-between",
  },
  bentoLabel: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1.2,
  },
  bentoHeroValue: {
    fontSize: 56,
    lineHeight: 60,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
    marginTop: 4,
  },
  bentoHeroCaption: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    fontStyle: "italic",
  },
  bentoMiniValue: {
    fontSize: 28,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
    marginTop: 8,
  },

  /* Section heading */
  sectionMarker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: HORIZONTAL,
    marginTop: 32,
    marginBottom: 14,
  },
  sectionMarkerRule: {
    height: StyleSheet.hairlineWidth,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.3,
  },

  /* Sections */
  section: {
    paddingHorizontal: HORIZONTAL,
    gap: 12,
  },

  /* Rhythm card */
  rhythmCard: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
    alignItems: "stretch",
  },
  rhythmStat: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  rhythmValue: {
    fontSize: 24,
    fontFamily: FontFamily.headingBold,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  rhythmLabel: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.3,
  },
  rhythmDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 6,
  },

  /* Feature card */
  featureCard: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  featureRule: {
    width: 4,
  },
  featureBody: {
    flex: 1,
    padding: 16,
    gap: 10,
  },
  featureEyebrow: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1.1,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureEmoji: {
    fontSize: 32,
  },
  featureTitle: {
    fontSize: 17,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.2,
  },
  featureMeta: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    marginTop: 2,
  },

  /* Timeline */
  timelineRow: {
    flexDirection: "row",
    gap: 14,
    paddingBottom: 18,
  },
  timelineDateCol: {
    width: 44,
    alignItems: "flex-end",
    paddingTop: 2,
  },
  timelineDay: {
    fontSize: 26,
    lineHeight: 28,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  timelineMonth: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  timelineRail: {
    width: 14,
    alignItems: "center",
    paddingTop: 8,
  },
  timelineNode: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  timelineLine: {
    width: StyleSheet.hairlineWidth,
    flex: 1,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    gap: 3,
    paddingTop: 4,
  },
  timelineTitle: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
  },
  timelineMeta: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
  upcomingTag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  upcomingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  upcomingTagText: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.4,
  },
  moreText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    textAlign: "center",
    paddingTop: 4,
    fontStyle: "italic",
  },

  /* Upcoming list */
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  upcomingIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingBody: {
    flex: 1,
    gap: 3,
  },
  upcomingType: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
  },
  upcomingMeta: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },
  upcomingDate: {
    fontSize: 13,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.2,
  },

  /* Empty canvas */
  emptyCanvas: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },

  /* CTA */
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  ctaText: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    letterSpacing: 0.2,
  },

  /* Safety */
  safetyRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  safetyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  safetyBtnText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
  },

  /* Footer */
  footerNote: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    textAlign: "center",
    marginTop: 18,
    paddingHorizontal: 32,
    fontStyle: "italic",
  },
});
