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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Brand, Colors, FontFamily } from "@/constants/theme";
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
import type { TeamMessage } from "@/lib/messages";

const POLL_MS = 15000;

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
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const flatListRef = useRef<FlatList<TeamMessage>>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rule = isDark ? "rgba(253,248,239,0.12)" : "rgba(29,83,55,0.14)";
  const eyebrow = isDark ? Brand.greenLight : Brand.green;

  const load = useCallback(
    async (markRead = true) => {
      try {
        const data = await fetchAdminThread(threadId);
        setDetail(data);
        setMessages(data.messages);
        if (markRead) {
          markAdminThreadRead(threadId)
            .then(() => clearAdminUnreadCount(queryClient))
            .catch(() => {});
        }
      } catch (err) {
        console.warn("[admin/messages] load failed", err);
      } finally {
        setLoading(false);
      }
    },
    [threadId]
  );

  useEffect(() => {
    void load();
    const tick = () => {
      pollRef.current = setTimeout(() => {
        void load(false).finally(tick);
      }, POLL_MS);
    };
    tick();
    return () => {
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
  const grade = volunteer?.volunteerGrade ? GRADE_COLORS[volunteer.volunteerGrade] : null;

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: rule }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.headerSide}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={eyebrow} />
        </Pressable>

        <Pressable
          style={styles.headerCenter}
          onPress={() => volunteer && router.push(`/user/${volunteer.id}` as Href)}
          accessibilityRole="button"
          accessibilityLabel={`${volunteerName} profile`}
        >
          {volunteer?.profilePhotoUrl ? (
            <Image source={{ uri: volunteer.profilePhotoUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.headerAvatarInitial, { color: Brand.green }]}>
                {initialOf(volunteerName)}
              </Text>
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
              {volunteerName}
            </Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {[volunteer?.defaultLocation, grade ? `${grade.label} grade` : null]
                .filter(Boolean)
                .join(" · ") || "Volunteer"}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={toggleResolve}
          hitSlop={12}
          style={styles.headerSide}
          accessibilityLabel={isResolved ? "Reopen conversation" : "Mark resolved"}
          accessibilityRole="button"
        >
          {resolving ? (
            <ActivityIndicator size="small" color={eyebrow} />
          ) : (
            <Ionicons
              name={isResolved ? "lock-open-outline" : "checkmark-done-outline"}
              size={22}
              color={isResolved ? colors.textSecondary : eyebrow}
            />
          )}
        </Pressable>
      </View>

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
              <Text style={[styles.resolvedBadgeText, { color: colors.textSecondary }]}>Resolved</Text>
            </View>
          )}
        </View>
      )}

      {/* Messages */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={eyebrow} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            No messages yet. Say kia ora — your reply reaches {volunteerName.split(" ")[0]} in the app.
          </Text>
        </View>
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
        />
      )}

      {/* Composer */}
      <View
        style={[
          styles.composer,
          {
            backgroundColor: colors.card,
            borderTopColor: rule,
            paddingBottom: insets.bottom + 8,
          },
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
      </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  headerSide: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerAvatarFallback: { alignItems: "center", justifyContent: "center" },
  headerAvatarInitial: { fontFamily: FontFamily.bold, fontSize: 15 },
  headerText: { flex: 1 },
  headerName: { fontFamily: FontFamily.semiBold, fontSize: 16 },
  headerSub: { fontFamily: FontFamily.regular, fontSize: 12.5, marginTop: 1 },
  contextStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contextText: { fontFamily: FontFamily.medium, fontSize: 12.5 },
  resolvedBadge: {
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  resolvedBadgeText: { fontFamily: FontFamily.semiBold, fontSize: 10.5, letterSpacing: 0.4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyBody: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 300,
  },
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
  teamBubbleText: { color: "#fff", fontFamily: FontFamily.regular, fontSize: 15.5, lineHeight: 22 },
  metaRight: { fontFamily: FontFamily.regular, fontSize: 11, marginTop: 4, marginRight: 4 },
  volBlock: { maxWidth: "82%", alignItems: "flex-start" },
  volBubble: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
  },
  volBubbleText: { fontFamily: FontFamily.regular, fontSize: 15.5, lineHeight: 22 },
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
  input: { fontFamily: FontFamily.regular, fontSize: 15.5, lineHeight: 20, maxHeight: 120, paddingVertical: 0 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
