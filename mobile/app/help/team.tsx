import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTeamUnreadStore } from "@/hooks/use-team-unread";
import {
  fetchTeamThread,
  markTeamThreadRead,
  sendTeamMessage,
  type HoursStatus,
  type TeamMessage,
} from "@/lib/messages";

const FLOATING_BAR_HEIGHT = 60;
const REFRESH_ON_FOCUS_INTERVAL_MS = 15000;

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

/* ─── Bubble ────────────────────────────────────────────────── */

const Bubble = React.memo(function Bubble({
  item,
  isFirstInGroup,
  colors,
  isDark,
  paperTint,
}: {
  item: TeamMessage;
  isFirstInGroup: boolean;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  paperTint: PaperTint;
}) {
  const isAdmin = item.senderRole === "ADMIN";
  const senderName =
    [item.sender.firstName, item.sender.lastName].filter(Boolean).join(" ") ||
    item.sender.name ||
    "";

  if (!isAdmin) {
    return (
      <View
        style={[
          styles.row,
          styles.rowEnd,
          { marginTop: isFirstInGroup ? 18 : 4 },
        ]}
      >
        <View style={[styles.userBubble, { backgroundColor: Brand.green }]}>
          <Text style={styles.userBubbleText}>{item.body}</Text>
        </View>
      </View>
    );
  }

  const avatarInitial = (
    item.sender.firstName?.charAt(0) ||
    item.sender.name?.charAt(0) ||
    "·"
  ).toUpperCase();

  return (
    <View style={[styles.assistantBlock, { marginTop: isFirstInGroup ? 24 : 8 }]}>
      {isFirstInGroup && (
        <View style={styles.assistantMeta}>
          {item.sender.profilePhotoUrl ? (
            <Image
              source={{ uri: item.sender.profilePhotoUrl }}
              style={styles.adminAvatar}
            />
          ) : (
            <View
              style={[
                styles.adminAvatar,
                styles.adminAvatarFallback,
                {
                  backgroundColor: isDark ? Brand.greenDark : Brand.greenLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.adminAvatarInitial,
                  { color: isDark ? Brand.greenLight : Brand.green },
                ]}
              >
                {avatarInitial}
              </Text>
            </View>
          )}
          <Text style={[styles.assistantMetaLabel, { color: paperTint.eyebrow }]}>
            {senderName ? senderName.toUpperCase() : "EE TEAM"} · TEAM
          </Text>
          <Text style={[styles.timeLabel, { color: paperTint.inkSoft }]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      )}
      <View style={styles.assistantBody}>
        <Text style={[styles.assistantBubbleText, { color: colors.text }]}>
          {item.body}
        </Text>
      </View>
    </View>
  );
});

/* ─── Screen ────────────────────────────────────────────────── */

export default function TeamThreadScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const paperTint = usePaperTint(isDark, colors);
  const router = useRouter();

  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [hours, setHours] = useState<HoursStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [composerHeight, setComposerHeight] = useState(FLOATING_BAR_HEIGHT);
  const flatListRef = useRef<FlatList<TeamMessage>>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async (markRead: boolean = true) => {
    try {
      const data = await fetchTeamThread();
      setMessages(data.messages);
      setHours(data.hours);
      if (markRead && data.thread.unread) {
        markTeamThreadRead()
          .then(() => useTeamUnreadStore.getState().setCount(0))
          .catch(() => {});
      } else if (markRead) {
        useTeamUnreadStore.getState().setCount(0);
      }
    } catch (err) {
      console.warn("[help/team] refresh failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      const tick = () => {
        pollTimerRef.current = setTimeout(() => {
          void refresh(false).finally(tick);
        }, REFRESH_ON_FOCUS_INTERVAL_MS);
      };
      tick();
      return () => {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      };
    }, [refresh])
  );

  /* Keyboard tracking with smooth LayoutAnimation. */
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        if (Platform.OS === "ios") {
          LayoutAnimation.configureNext({
            duration: e.duration,
            update: { type: LayoutAnimation.Types.keyboard },
          });
        }
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      (e) => {
        if (Platform.OS === "ios" && e?.duration) {
          LayoutAnimation.configureNext({
            duration: e.duration,
            update: { type: LayoutAnimation.Types.keyboard },
          });
        }
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const send = useCallback(async () => {
    const body = input.trim();
    if (!body || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setInput("");
    try {
      const { message } = await sendTeamMessage(body);
      setMessages((prev) => [...prev, message]);
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
    } catch (err) {
      setInput(body);
      console.warn("[help/team] send failed", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  const renderMessage = useCallback(
    ({ item, index }: { item: TeamMessage; index: number }) => {
      const prev = messages[index - 1];
      return (
        <Bubble
          item={item}
          isFirstInGroup={
            !prev ||
            prev.senderRole !== item.senderRole ||
            new Date(item.createdAt).getTime() -
              new Date(prev.createdAt).getTime() >
              5 * 60 * 1000
          }
          colors={colors}
          isDark={isDark}
          paperTint={paperTint}
        />
      );
    },
    [messages, colors, isDark, paperTint]
  );

  const floatingBottom = keyboardHeight > 0
    ? keyboardHeight + 8
    : insets.bottom + 8;

  const useNativeGlass = isLiquidGlassAvailable();
  const sendBtnInactive = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const hasInput = input.trim().length > 0 && !sending;

  const composerInner = (
    <>
      <View style={styles.glassInputField}>
        <TextInput
          style={[
            styles.glassInputText,
            { color: colors.text, fontFamily: FontFamily.regular },
          ]}
          value={input}
          onChangeText={setInput}
          placeholder="Message the team…"
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={4000}
          returnKeyType="default"
          editable={!sending}
          accessibilityLabel="Message input"
        />
      </View>
      <Pressable
        onPress={send}
        disabled={!hasInput}
        style={({ pressed }) => [
          styles.glassSendBtn,
          {
            backgroundColor: hasInput ? Brand.green : sendBtnInactive,
            transform: [{ scale: pressed && hasInput ? 0.9 : 1 }],
          },
        ]}
        accessibilityLabel="Send message"
        accessibilityRole="button"
      >
        {sending ? (
          <ActivityIndicator color={hasInput ? "#ffffff" : colors.textSecondary} />
        ) : (
          <Ionicons
            name="arrow-up"
            size={18}
            color={hasInput ? "#ffffff" : colors.textSecondary}
          />
        )}
      </Pressable>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: paperTint.paper }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 14,
            borderBottomColor: paperTint.rule,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={paperTint.eyebrow} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: paperTint.eyebrow }]}>
            EE TEAM
          </Text>
          <Text
            style={[styles.headerSubtitle, { color: paperTint.inkSoft }]}
            numberOfLines={1}
          >
            {hoursSubtitle(hours)}
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={paperTint.eyebrow} />
        </View>
      ) : messages.length === 0 ? (
        <EmptyState paperTint={paperTint} colors={colors} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(m) => m.id}
          contentContainerStyle={[
            styles.messageList,
            { paddingBottom: composerHeight + floatingBottom + 16 },
          ]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            requestAnimationFrame(() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            });
          }}
        />
      )}

      {/* Off-hours hint */}
      {hours && !hours.isOpenNow && (
        <View
          style={[
            styles.offHoursHint,
            {
              bottom: floatingBottom + composerHeight + 12,
              backgroundColor: isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(14,58,35,0.05)",
              borderColor: paperTint.rule,
            },
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.offHoursText, { color: paperTint.inkSoft }]}>
            {hours.nextOpenLabel
              ? `Team is offline · ${hours.nextOpenLabel.toLowerCase()}`
              : "Team is offline · we'll reply when we're around"}
          </Text>
        </View>
      )}

      {/* Composer */}
      <View
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && Math.abs(h - composerHeight) > 0.5) {
            setComposerHeight(h);
          }
        }}
        style={[
          styles.floatingWrap,
          { bottom: floatingBottom },
          Platform.OS === "ios" && {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.3 : 0.1,
            shadowRadius: 16,
          },
          Platform.OS === "android" && { elevation: 8 },
        ]}
      >
        {useNativeGlass ? (
          <GlassView glassEffectStyle="regular" style={styles.glassBar}>
            {composerInner}
          </GlassView>
        ) : (
          <View style={[styles.glassBar, styles.glassBarFallback]}>
            <BlurView
              intensity={isDark ? 60 : 80}
              tint={isDark ? "dark" : "light"}
              style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isDark
                    ? "rgba(40,44,52,0.55)"
                    : "rgba(255,253,247,0.78)",
                  borderColor: paperTint.rule,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: 22,
                },
              ]}
            />
            {composerInner}
          </View>
        )}
      </View>
    </View>
  );
}

/* ─── Empty state ───────────────────────────────────────────── */

function EmptyState({
  paperTint,
  colors,
}: {
  paperTint: PaperTint;
  colors: (typeof Colors)["light"];
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyEmoji]}>💬</Text>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        Say kia ora to the team
      </Text>
      <Text style={[styles.emptyBody, { color: paperTint.inkSoft }]}>
        Tell us what&apos;s up — running late, swapping a shift, a question,
        anything. We&apos;ll get back as soon as we can.
      </Text>
    </View>
  );
}

/* ─── Helpers ───────────────────────────────────────────────── */

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function hoursSubtitle(hours: HoursStatus | null): string {
  if (!hours) return "We reply during opening hours";
  if (hours.isOpenNow) return "Online · usually replies quickly";
  return hours.nextOpenLabel ?? "Currently offline";
}

/* ─── Styles ────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, alignItems: "flex-start", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    letterSpacing: 2.2,
  },
  headerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    marginTop: 2,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingBottom: FLOATING_BAR_HEIGHT * 2,
  },
  emptyEmoji: { fontSize: 44, marginBottom: 14 },
  emptyTitle: {
    fontFamily: FontFamily.headingBold,
    fontSize: 24,
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 320,
  },
  messageList: {
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  row: { flexDirection: "row" },
  rowEnd: { justifyContent: "flex-end" },
  userBubble: {
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 20,
    borderBottomRightRadius: 6,
  },
  userBubbleText: {
    color: "#ffffff",
    fontFamily: FontFamily.regular,
    fontSize: 15.5,
    lineHeight: 22,
  },
  assistantBlock: { flexDirection: "column" },
  assistantMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  adminAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  adminAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  adminAvatarInitial: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  assistantMetaLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  timeLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    marginLeft: "auto",
  },
  assistantBody: {
    paddingLeft: 32,
    paddingRight: 8,
  },
  assistantBubbleText: {
    fontFamily: FontFamily.regular,
    fontSize: 15.5,
    lineHeight: 23,
  },
  offHoursHint: {
    position: "absolute",
    left: 22,
    right: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    zIndex: 5,
  },
  offHoursText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  floatingWrap: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 10,
  },
  glassBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 22,
    padding: 6,
    gap: 6,
  },
  glassBarFallback: { overflow: "hidden" },
  glassInputField: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    minHeight: 40,
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  glassInputText: {
    fontSize: 15.5,
    lineHeight: 20,
    maxHeight: 120,
    paddingTop: 0,
    paddingBottom: 0,
    textAlignVertical: "center",
  },
  glassSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
