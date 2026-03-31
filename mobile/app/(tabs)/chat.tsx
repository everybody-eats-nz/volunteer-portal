import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MarkdownDisplay from "react-native-markdown-display";

import { ThemedText } from "@/components/themed-text";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { api } from "@/lib/api";
import { chatWithAssistant } from "@/lib/chat";

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

const DEFAULT_SUGGESTED_QUESTIONS = [
  { emoji: "🍽️", label: "What happens on a typical shift?" },
  { emoji: "🔪", label: "Kitchen safety tips" },
  { emoji: "👥", label: "What are the volunteer grades?" },
  { emoji: "📍", label: "Where are the kitchens?" },
];

/* ─── Layout Constants ─────────────────────────────────────── */

const FLOATING_BAR_HEIGHT = 60;

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
        ])
      )
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
        <MarkdownDisplay
          style={{
            body: {
              color: colors.text,
              fontFamily: FontFamily.regular,
              fontSize: 15,
              lineHeight: 22,
            },
            strong: { fontFamily: FontFamily.semiBold },
            bullet_list: { marginVertical: 4 },
            ordered_list: { marginVertical: 4 },
            list_item: { marginVertical: 1 },
            link: { color: Brand.green },
            paragraph: { marginTop: 0, marginBottom: 10 },
            heading1: {
              fontFamily: FontFamily.headingBold,
              fontSize: 18,
              marginBottom: 6,
              marginTop: 12,
              color: colors.text,
            },
            heading2: {
              fontFamily: FontFamily.headingBold,
              fontSize: 17,
              marginBottom: 4,
              marginTop: 10,
              color: colors.text,
            },
            heading3: {
              fontFamily: FontFamily.headingBold,
              fontSize: 16,
              marginBottom: 4,
              marginTop: 8,
              color: colors.text,
            },
          }}
        >
          {item.content}
        </MarkdownDisplay>
      </View>
    </View>
  );
});

/* ─── Welcome Hero ──────────────────────────────────────────── */

function WelcomeHero({
  colors,
  isDark,
  onSuggestionPress,
  questions,
}: {
  colors: (typeof Colors)["light"];
  isDark: boolean;
  onSuggestionPress: (text: string) => void;
  questions: { emoji: string; label: string }[];
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

      {/* Suggestion cards — 2x2 grid */}
      <Text style={[styles.suggestionsLabel, { color: colors.textSecondary }]}>
        Try asking...
      </Text>
      <View style={styles.suggestionsGrid}>
        {questions.map((q) => (
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
  const [suggestedQuestions, setSuggestedQuestions] = useState(
    DEFAULT_SUGGESTED_QUESTIONS
  );
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const showWelcome = messages.length <= 1;
  const keyboardVisible = keyboardHeight > 0;

  /* ── Track keyboard with LayoutAnimation for smooth transitions ── */
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

  /* ── Fetch suggested questions from API ── */
  useEffect(() => {
    api<{ suggestedQuestions: typeof DEFAULT_SUGGESTED_QUESTIONS }>(
      "/api/mobile/chat/config"
    )
      .then((data) => {
        if (data.suggestedQuestions?.length > 0) {
          setSuggestedQuestions(data.suggestedQuestions);
        }
      })
      .catch(() => {
        // Keep defaults on error
      });
  }, []);

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
      setIsLoading(true);

      const assistantId = (Date.now() + 1).toString();
      const allMessages = [...messages, userMessage]
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, userMessage]);

      try {
        await chatWithAssistant(allMessages, {
          onStart: () => {
            setIsLoading(false);
            setMessages((prev) => [
              ...prev,
              { id: assistantId, role: "assistant", content: "" },
            ]);
          },
          onToken: (token: string) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + token } : m
              )
            );
          },
          onFinish: () => {
            setIsLoading(false);
          },
          onError: (error: string) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content:
                        "Sorry, I had trouble responding. Please try again — or contact the team directly if you need help right away 🌿",
                    }
                  : m
              )
            );
            setIsLoading(false);
            console.error("Chat error:", error);
          },
        });
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant" as const,
            content:
              "Sorry, I couldn't connect right now. Please check your connection and try again 🌿",
          },
        ]);
        setIsLoading(false);
      }
    },
    [input, isLoading, messages]
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
    [messages, colors, isDark]
  );

  /* ── Floating bar position ── */
  const floatingBottom = keyboardVisible
    ? keyboardHeight + 8
    : insets.bottom + 8;

  /* ── Glass bar colors ── */
  const sendBtnInactive = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const hasInput = input.trim().length > 0 && !isLoading;
  const useNativeGlass = isLiquidGlassAvailable();

  /* ── Input contents (shared between glass and fallback paths) ── */
  const inputContents = (
    <>
      <View
        style={[styles.glassInputField, { backgroundColor: "transparent" }]}
      >
        <TextInput
          ref={inputRef}
          style={[
            styles.glassInputText,
            { color: "white", fontFamily: FontFamily.regular },
          ]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask a question..."
          placeholderTextColor={"#ccc"}
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
          styles.glassSendBtn,
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
          size={18}
          color={hasInput ? "#ffffff" : colors.textSecondary}
        />
      </Pressable>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
                style={[styles.statusDot, { backgroundColor: "#22c55e" }]}
              />
              <Text
                style={[styles.statusLabel, { color: colors.textSecondary }]}
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
          questions={suggestedQuestions}
        />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messageList,
            { paddingBottom: FLOATING_BAR_HEIGHT + 100 },
          ]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListFooterComponent={
            isLoading ? (
              <View
                style={[
                  styles.messageRow,
                  styles.assistantRow,
                  { marginTop: 12 },
                ]}
              >
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

      {/* ── Floating glass input bar ── */}
      <View
        style={[
          styles.floatingWrap,
          { bottom: floatingBottom },
          !useNativeGlass &&
            Platform.OS === "ios" && {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.3 : 0.1,
              shadowRadius: 16,
            },
          !useNativeGlass && Platform.OS === "android" && { elevation: 8 },
        ]}
      >
        {useNativeGlass ? (
          <GlassView glassEffectStyle={"regular"} style={styles.glassBar}>
            {inputContents}
          </GlassView>
        ) : (
          <View style={styles.glassBar}>
            <BlurView
              intensity={isDark ? 60 : 80}
              tint={isDark ? "dark" : "light"}
              style={[StyleSheet.absoluteFill, { borderRadius: 26 }]}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isDark
                    ? "rgba(40,44,52,0.35)"
                    : "rgba(255,255,255,0.25)",
                  borderColor: isDark
                    ? "rgba(255,255,255,0.18)"
                    : "rgba(255,255,255,0.5)",
                  borderWidth: 1,
                  borderRadius: 26,
                },
              ]}
            />
            {inputContents}
          </View>
        )}
      </View>
    </View>
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
    zIndex: 2,
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
    paddingBottom: FLOATING_BAR_HEIGHT + 40,
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

  /* Floating glass input bar */
  floatingWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 10,
  },
  glassBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 26,
    padding: 6,
    gap: 6,
    overflow: "hidden",
  },
  glassInputField: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    minHeight: 40,
    justifyContent: "center",
  },
  glassInputText: {
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 100,
    paddingTop: 0,
    paddingBottom: 0,
    textAlignVertical: "center",
    color: "white",
  },
  glassSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
