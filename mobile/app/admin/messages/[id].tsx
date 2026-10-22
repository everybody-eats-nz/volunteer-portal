import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ui/screen-header";
import { EmptyState, ErrorState } from "@/components/ui/state-view";
import { Brand, Colors, FontFamily, MaxFontScale } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { clearAdminUnreadCount } from "@/hooks/use-admin";
import { GRADE_COLORS, initialOf } from "@/lib/admin-format";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import {
  fetchAdminThread,
  markAdminThreadRead,
  resolveAdminThread,
  sendAdminMessage,
  type AdminThreadDetail,
} from "@/lib/admin";
import { loadErrorKind } from "@/lib/load-error";
import type { TeamMessage } from "@/lib/messages";
import { goBackOrHome } from "@/lib/navigation";

const POLL_MS = 15_000;

export default function AdminConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const threadId = String(id);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [detail, setDetail] = useState<AdminThreadDetail | null>(null);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [loading, setLoading] = useState(true);
  // Only the first load's failure is shown; a failed background poll keeps
  // the conversation already on screen.
  const [loadError, setLoadError] = useState<unknown>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const flatListRef = useRef<FlatList<TeamMessage>>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rule = isDark ? "rgba(253,248,239,0.12)" : "rgba(29,83,55,0.14)";

  const load = useCallback(
    async (markRead = true) => {
      try {
        const data = await fetchAdminThread(threadId);
        setDetail(data);
        setMessages(data.messages);
        setLoadError(null);
        if (markRead) {
          markAdminThreadRead(threadId)
            .then(() => clearAdminUnreadCount(queryClient))
            .catch(() => {});
        }
      } catch (err) {
        console.warn("[admin/messages] load failed", err);
        setLoadError(err);
      } finally {
        setLoading(false);
      }
    },
    [threadId]
  );

  useEffect(() => {
    // `active` guards against the in-flight poll re-scheduling itself after
    // the component unmounts (clearTimeout alone can't catch a load() that is
    // already running when cleanup fires).
    let active = true;
    void load();
    const tick = () => {
      pollRef.current = setTimeout(() => {
        if (!active) return;
        void load(false).finally(() => {
          if (active) tick();
        });
      }, POLL_MS);
    };
    tick();
    return () => {
      active = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [load]);

  const send = useCallback(async () => {
    const body = input.trim();
    if (!body || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setInput("");
    try {
      const { message } = await sendAdminMessage(threadId, body);
      setMessages((prev) => [...prev, message]);
      // Inbox previews are now stale.
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      setInput(body);
      console.warn("[admin/messages] send failed", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSending(false);
    }
  }, [input, sending, threadId]);

  const toggleResolve = useCallback(async () => {
    if (!detail || resolving) return;
    const next = detail.thread.status === "RESOLVED" ? "OPEN" : "RESOLVED";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResolving(true);
    // Optimistic.
    setDetail((d) => (d ? { ...d, thread: { ...d.thread, status: next } } : d));
    try {
      await resolveAdminThread(threadId, next);
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    } catch {
      setDetail((d) =>
        d ? { ...d, thread: { ...d.thread, status: next === "RESOLVED" ? "OPEN" : "RESOLVED" } } : d
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setResolving(false);
    }
  }, [detail, resolving, threadId]);

  const volunteer = detail?.thread.volunteer;
  const volunteerName =
    [volunteer?.firstName, volunteer?.lastName].filter(Boolean).join(" ") ||
    volunteer?.name ||
    volunteer?.email ||
    "Volunteer";
  const isResolved = detail?.thread.status === "RESOLVED";
  const grade = volunteer?.volunteerGrade ? GRADE_COLORS[colorScheme][volunteer.volunteerGrade] : null;

  const renderMessage = useCallback(
    ({ item, index }: { item: TeamMessage; index: number }) => {
      const prev = messages[index - 1];
      const firstInGroup =
        !prev ||
        prev.senderRole !== item.senderRole ||
        new Date(item.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;
      return <Bubble item={item} firstInGroup={firstInGroup} colors={colors} />;
    },
    [messages, colors]
  );

  /* Android is edge-to-edge (Expo SDK 55+), so the window no longer resizes
     for the keyboard and the iOS-only KeyboardAvoidingView padding never runs
     there. Grow the composer's bottom padding with the live IME inset instead;
     the flex layout shrinks the message list in step. */
  const keyboard = useAnimatedKeyboard();
  const composerLift = useAnimatedStyle(() => ({
    paddingBottom:
      insets.bottom +
      8 +
      (Platform.OS === "android"
        ? Math.max(keyboard.height.value - insets.bottom, 0)
        : 0),
  }));

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScreenHeader
        borderColor={rule}
        center={
          <Pressable
            style={styles.headerCenter}
            onPress={() => volunteer && router.push(`/user/${volunteer.id}` as Href)}
            disabled={!volunteer}
            accessibilityRole="button"
            accessibilityLabel={`${volunteerName} profile`}
          >
            {volunteer?.profilePhotoUrl ? (
              <Image source={{ uri: volunteer.profilePhotoUrl }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, styles.headerAvatarFallback, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.headerAvatarInitial, { color: colors.tint }]}>
                  {initialOf(volunteerName)}
                </Text>
              </View>
            )}
            <View style={styles.headerText}>
              <Text
                style={[styles.headerName, { color: colors.text }]}
                numberOfLines={1}
                accessibilityRole="header"
              >
                {volunteerName}
              </Text>
              <Text style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
                {[volunteer?.defaultLocation, grade ? `${grade.label} grade` : null]
                  .filter(Boolean)
                  .join(" · ") || "Volunteer"}
              </Text>
            </View>
          </Pressable>
        }
        right={
          detail ? (
            <Pressable
              onPress={toggleResolve}
              hitSlop={4}
              android_ripple={{ color: rule, borderless: true, radius: 22 }}
              style={({ pressed }) => [styles.headerAction, { opacity: pressed ? 0.6 : 1 }]}
              accessibilityLabel={isResolved ? "Reopen conversation" : "Mark resolved"}
              accessibilityRole="button"
              accessibilityState={{ busy: resolving }}
            >
              {resolving ? (
                <ActivityIndicator size="small" color={colors.tint} />
              ) : (
                <Ionicons
                  name={isResolved ? "lock-open-outline" : "checkmark-done-outline"}
                  size={22}
                  color={isResolved ? colors.textSecondary : colors.tint}
                />
              )}
            </Pressable>
          ) : null
        }
      />

      {/* Context strip */}
      {detail && (
        <View style={[styles.contextStrip, { backgroundColor: colors.surfaceSoft, borderBottomColor: rule }]}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.contextText, { color: colors.textSecondary }]}>
            {detail.upcomingShiftCount > 0
              ? `${detail.upcomingShiftCount} upcoming shift${detail.upcomingShiftCount === 1 ? "" : "s"}`
              : "No upcoming shifts"}
          </Text>
          {isResolved && (
            <View style={[styles.resolvedBadge, { borderColor: rule }]}>
              <Text
                style={[styles.resolvedBadgeText, { color: colors.textSecondary }]}
                maxFontSizeMultiplier={MaxFontScale.compact}
              >
                Resolved
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Messages */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.tint} />
        </View>
      ) : !detail && loadError ? (
        loadErrorKind(loadError) === "not-found" ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="Conversation not found"
            body="It may have been removed. Head back to the inbox to pick another."
            action={{ label: "Back to inbox", icon: "arrow-back", onPress: () => goBackOrHome() }}
          />
        ) : (
          <ErrorState
            kind={loadErrorKind(loadError) === "offline" ? "offline" : "error"}
            title={loadErrorKind(loadError) === "offline" ? undefined : "Couldn't load this conversation"}
            onRetry={() => {
              setLoading(true);
              void load();
            }}
          />
        )
      ) : messages.length === 0 ? (
        <EmptyState
          emoji="💬"
          title="No messages yet"
          body={`Say kia ora - your reply reaches ${volunteerName.split(" ")[0]} in the app.`}
        />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: false }))
          }
          // Also pin on layout changes — the list resizes when the keyboard
          // opens (composer padding grows), which would otherwise leave the
          // newest messages hidden behind it.
          onLayout={() =>
            requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: false }))
          }
        />
      )}

      {/* Composer */}
      {(detail || !loadError) && (
        <Animated.View
          style={[
            styles.composer,
            { backgroundColor: colors.card, borderTopColor: rule },
            composerLift,
          ]}
        >
          <View style={[styles.inputField, { backgroundColor: colors.surfaceSunk }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={input}
              onChangeText={setInput}
              placeholder={`Reply to ${volunteerName.split(" ")[0]}…`}
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={4000}
              editable={!sending}
              accessibilityLabel="Reply message"
            />
          </View>
          <Pressable
            onPress={send}
            disabled={input.trim().length === 0 || sending}
            android_ripple={{ color: "rgba(253,248,239,0.22)", borderless: true, radius: 22 }}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor:
                  input.trim().length > 0 && !sending
                    ? Brand.green
                    : isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.06)",
                transform: [{ scale: pressed && input.trim().length > 0 ? 0.9 : 1 }],
              },
            ]}
            accessibilityLabel="Send reply"
            accessibilityRole="button"
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons
                name="arrow-up"
                size={20}
                color={input.trim().length > 0 ? "#fff" : colors.textSecondary}
              />
            )}
          </Pressable>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

/* ─── Bubble (team = outgoing/right, volunteer = incoming/left) ── */

const Bubble = React.memo(function Bubble({
  item,
  firstInGroup,
  colors,
}: {
  item: TeamMessage;
  firstInGroup: boolean;
  colors: (typeof Colors)["light"];
}) {
  const fromTeam = item.senderRole === "ADMIN";
  const time = new Date(item.createdAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (fromTeam) {
    const senderName =
      [item.sender.firstName, item.sender.lastName].filter(Boolean).join(" ") ||
      item.sender.name ||
      "You";
    return (
      <View style={[styles.bubbleRow, styles.rowEnd, { marginTop: firstInGroup ? 16 : 4 }]}>
        <View style={styles.teamBlock}>
          <View style={[styles.teamBubble, { backgroundColor: Brand.green }]}>
            <Text style={styles.teamBubbleText}>{item.body}</Text>
          </View>
          {firstInGroup && (
            <Text style={[styles.metaRight, { color: colors.textSecondary }]}>
              {senderName} · {time}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, { marginTop: firstInGroup ? 16 : 4 }]}>
      <View style={styles.volBlock}>
        <View style={[styles.volBubble, { backgroundColor: colors.surfaceSoft }]}>
          <Text style={[styles.volBubbleText, { color: colors.text }]}>{item.body}</Text>
        </View>
        {firstInGroup && (
          <Text style={[styles.metaLeft, { color: colors.textSecondary }]}>{time}</Text>
        )}
      </View>
    </View>
  );
});

/* ─── Styles ────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerAction: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCenter: { alignSelf: "stretch", flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerAvatarFallback: { alignItems: "center", justifyContent: "center" },
  headerAvatarInitial: { fontFamily: FontFamily.bold, fontSize: 15 },
  headerText: { flex: 1 },
  headerName: { fontFamily: FontFamily.semiBold, fontSize: 16 },
  headerSub: { fontFamily: FontFamily.regular, fontSize: 13, marginTop: 1 },
  contextStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contextText: { fontFamily: FontFamily.medium, fontSize: 13 },
  resolvedBadge: {
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  resolvedBadgeText: { fontFamily: FontFamily.semiBold, fontSize: 11, letterSpacing: 0.4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  messageList: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16 },
  bubbleRow: { flexDirection: "row" },
  rowEnd: { justifyContent: "flex-end" },
  teamBlock: { maxWidth: "82%", alignItems: "flex-end" },
  teamBubble: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomRightRadius: 6,
  },
  teamBubbleText: { color: "#fff", fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 22 },
  metaRight: { fontFamily: FontFamily.regular, fontSize: 11, marginTop: 4, marginRight: 4 },
  volBlock: { maxWidth: "82%", alignItems: "flex-start" },
  volBubble: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
  },
  volBubbleText: { fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 22 },
  metaLeft: { fontFamily: FontFamily.regular, fontSize: 11, marginTop: 4, marginLeft: 4 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputField: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 4,
    minHeight: 44,
    justifyContent: "center",
  },
  input: { fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 21, maxHeight: 120, paddingVertical: 0 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
