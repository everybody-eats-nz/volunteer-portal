import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

/* ─── Types ─────────────────────────────────────────────────── */

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

/* ─── Data ──────────────────────────────────────────────────── */

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Kia ora! 👋 I'm here to help with anything about volunteering at Everybody Eats. Ask me about what to expect on your first shift, kitchen safety, shift roles, or anything else 🌿",
};

const SUGGESTED_QUESTIONS = [
  { emoji: "🍽️", label: "What happens on a typical shift?" },
  { emoji: "🔪", label: "Kitchen safety tips" },
  { emoji: "👥", label: "What are the volunteer grades?" },
  { emoji: "📍", label: "Where are the kitchens?" },
];

/* ─── Animated Typing Dots ──────────────────────────────────── */

const TypingDots = React.memo(function TypingDots({
  color,
}: {
  color: string;
}) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const dots = [dot1, dot2, dot3];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.dotsRow}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: color,
              opacity: dot.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1],
              }),
              transform: [
                {
                  translateY: dot.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -4],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
});

/* ─── Assistant Avatar ──────────────────────────────────────── */

const AssistantAvatar = React.memo(function AssistantAvatar({
  size = 32,
  isDark = false,
}: {
  size?: number;
  isDark?: boolean;
}) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isDark ? Brand.greenDark : Brand.greenLight,
        },
      ]}
    >
      <Text style={{ fontSize: size * 0.5 }}>🌿</Text>
    </View>
  );
});

/* ─── Message Bubble ────────────────────────────────────────── */

const MessageBubble = React.memo(function MessageBubble({
  item,
  colors,
  isDark,
  isFirstInGroup,
  isLastInGroup,
}: {
  item: Message;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
}) {
  const isUser = item.role === "user";

  if (isUser) {
    return (
      <View
        style={[
          styles.messageRow,
          styles.userRow,
          { marginTop: isFirstInGroup ? 12 : 3 },
        ]}
      >
        <View
          style={[
            styles.bubble,
            styles.userBubble,
            {
              backgroundColor: Brand.green,
              borderTopRightRadius: isFirstInGroup ? 20 : 8,
              borderBottomRightRadius: isLastInGroup ? 6 : 8,
            },
          ]}
        >
          <Text style={[styles.messageText, { color: "#ffffff" }]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.messageRow,
        styles.assistantRow,
        { marginTop: isFirstInGroup ? 12 : 3 },
      ]}
    >
      {isFirstInGroup ? (
        <AssistantAvatar size={30} isDark={isDark} />
      ) : (
        <View style={styles.avatarSpacer} />
      )}
      <View
        style={[
          styles.bubble,
          styles.assistantBubble,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderTopLeftRadius: isFirstInGroup ? 20 : 8,
            borderBottomLeftRadius: isLastInGroup ? 6 : 8,
          },
        ]}
      >
        <Text style={[styles.messageText, { color: colors.text }]}>
          {item.content}
        </Text>
      </View>
    </View>
  );
});

/* ─── Welcome Hero ──────────────────────────────────────────── */

function WelcomeHero({
  colors,
  isDark,
  onSuggestionPress,
}: {
  colors: (typeof Colors)["light"];
  isDark: boolean;
  onSuggestionPress: (text: string) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.welcomeContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Decorative avatar with ring */}
      <View style={styles.welcomeAvatarWrap}>
        <View
          style={[
            styles.welcomeRing,
            {
              borderColor: isDark
                ? "rgba(232, 245, 232, 0.15)"
                : "rgba(14, 58, 35, 0.08)",
            },
          ]}
        >
          <View
            style={[
              styles.welcomeAvatarCircle,
              {
                backgroundColor: isDark ? Brand.greenDark : Brand.greenLight,
              },
            ]}
          >
            <Text style={styles.welcomeEmoji}>🌿</Text>
          </View>
        </View>
      </View>

      {/* Greeting */}
      <ThemedText type="title" style={styles.welcomeTitle}>
        Kia ora! 👋
      </ThemedText>
      <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
        I'm your volunteering assistant for{"\n"}Everybody Eats. Ask me anything
        about{"\n"}shifts, safety, or getting started.
      </Text>

      {/* Suggestion cards — 2×2 grid */}
      <Text style={[styles.suggestionsLabel, { color: colors.textSecondary }]}>
        Try asking...
      </Text>
      <View style={styles.suggestionsGrid}>
        {SUGGESTED_QUESTIONS.map((q) => (
          <Pressable
            key={q.label}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSuggestionPress(`${q.emoji} ${q.label}`);
            }}
            style={({ pressed }) => [
              styles.suggestionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
              Platform.OS === "ios" && {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0.3 : 0.06,
                shadowRadius: 6,
              },
            ]}
            accessibilityLabel={q.label}
            accessibilityRole="button"
          >
            <Text style={styles.suggestionEmoji}>{q.emoji}</Text>
            <Text
              style={[styles.suggestionLabel, { color: colors.text }]}
              numberOfLines={2}
            >
              {q.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Footer */}
      <Text style={[styles.welcomeFooter, { color: colors.textSecondary }]}>
        Powered by your whānau knowledge base 💚
      </Text>
    </ScrollView>
  );
}

/* ─── Main Screen ───────────────────────────────────────────── */

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const showWelcome = messages.length <= 1;

  /* ── Reset ── */
  const resetChat = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setIsLoading(false);
  }, []);

  /* ── Send ── */
  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || isLoading) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content,
      };

      setInput("");
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // TODO: Connect to AI endpoint with volunteer knowledge base
      setTimeout(() => {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "I'm not connected to the AI backend yet — once that's set up I'll be able to answer all your questions about volunteering! 🌱",
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsLoading(false);
      }, 1000);
    },
    [input, isLoading],
  );

  /* ── Render message with grouping ── */
  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const prev = messages[index - 1];
      const next = messages[index + 1];
      return (
        <MessageBubble
          item={item}
          colors={colors}
          isDark={isDark}
          isFirstInGroup={!prev || prev.role !== item.role}
          isLastInGroup={!next || next.role !== item.role}
        />
      );
    },
    [messages, colors, isDark],
  );

  /* ── Input bar colors ── */
  const inputBarBg = isDark ? "#1a1d21" : "#ffffff";
  const inputFieldBg = isDark ? "#252830" : "#f1f5f9";
  const inputFieldBorder = isDark ? "rgba(255,255,255,0.08)" : "#e2e8f0";
  const sendBtnInactive = isDark ? "#2a2d32" : "#e2e8f0";
  const hasInput = input.trim().length > 0 && !isLoading;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={styles.headerInner}>
          <AssistantAvatar size={36} isDark={isDark} />
          <View style={styles.headerText}>
            <ThemedText type="subtitle" style={styles.headerName}>
              EE Assistant
            </ThemedText>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: "#22c55e" },
                ]}
              />
              <Text
                style={[
                  styles.statusLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Online
              </Text>
            </View>
          </View>

          {/* New conversation button */}
          {!showWelcome && (
            <Pressable
              onPress={resetChat}
              style={({ pressed }) => [
                styles.newChatBtn,
                {
                  backgroundColor: isDark ? "#252830" : Brand.greenLight,
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
              accessibilityLabel="Start new conversation"
              accessibilityRole="button"
              hitSlop={8}
            >
              <Ionicons
                name="create-outline"
                size={18}
                color={isDark ? colors.text : Brand.green}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Content area ── */}
      {showWelcome ? (
        <WelcomeHero
          colors={colors}
          isDark={isDark}
          onSuggestionPress={sendMessage}
        />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListFooterComponent={
            isLoading ? (
              <View style={[styles.messageRow, styles.assistantRow, { marginTop: 12 }]}>
                <AssistantAvatar size={30} isDark={isDark} />
                <View
                  style={[
                    styles.bubble,
                    styles.assistantBubble,
                    styles.typingBubble,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <TypingDots color={colors.textSecondary} />
                </View>
              </View>
            ) : null
          }
          ListFooterComponentStyle={styles.listFooter}
        />
      )}

      {/* ── Input bar ── */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: inputBarBg,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            borderTopColor: colors.border,
          },
          Platform.OS === "ios" && {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: isDark ? 0.25 : 0.05,
            shadowRadius: 8,
          },
          Platform.OS === "android" && { elevation: 8 },
        ]}
      >
        <View
          style={[
            styles.inputField,
            {
              backgroundColor: inputFieldBg,
              borderColor: inputFieldBorder,
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[
              styles.inputText,
              { color: colors.text, fontFamily: FontFamily.regular },
            ]}
            value={input}
            onChangeText={setInput}
            placeholder="Ask a question..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={1000}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
            editable={!isLoading}
            accessibilityLabel="Message input"
          />
        </View>

        <Pressable
          onPress={() => sendMessage()}
          disabled={!hasInput}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: hasInput ? Brand.green : sendBtnInactive,
              transform: [{ scale: pressed && hasInput ? 0.9 : 1 }],
            },
          ]}
          accessibilityLabel="Send message"
          accessibilityRole="button"
        >
          <Ionicons
            name="arrow-up"
            size={20}
            color={hasInput ? "#ffffff" : colors.textSecondary}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ─── Styles ────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /* Header */
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  newChatBtn: {
    marginLeft: "auto",
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    gap: 2,
  },
  headerName: {
    fontSize: 17,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusLabel: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
  },

  /* Avatar (shared) */
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },

  /* Welcome hero */
  welcomeContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  welcomeAvatarWrap: {
    marginBottom: 20,
  },
  welcomeRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeAvatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeEmoji: {
    fontSize: 32,
  },
  welcomeTitle: {
    textAlign: "center",
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    fontFamily: FontFamily.regular,
    marginBottom: 28,
  },
  suggestionsLabel: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  suggestionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
  },
  suggestionCard: {
    flexBasis: "48%",
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  suggestionEmoji: {
    fontSize: 24,
  },
  suggestionLabel: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    lineHeight: 19,
  },
  welcomeFooter: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    textAlign: "center",
    marginTop: 28,
  },

  /* Message list */
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  listFooter: {
    paddingBottom: 8,
  },
  messageRow: {
    flexDirection: "row",
  },
  userRow: {
    justifyContent: "flex-end",
  },
  assistantRow: {
    alignItems: "flex-end",
    gap: 8,
  },
  avatarSpacer: {
    width: 30,
  },

  /* Bubbles */
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "78%",
  },
  userBubble: {
    borderRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    borderRadius: 20,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FontFamily.regular,
  },

  /* Typing indicator */
  typingBubble: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  /* Input bar */
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputField: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    minHeight: 44,
    justifyContent: "center",
  },
  inputText: {
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
