import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Keyboard,
  LayoutAnimation,
  NativeScrollEvent,
  NativeSyntheticEvent,
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

type Question = { emoji: string; label: string };

type PaperTint = {
  paper: string;
  ink: string;
  inkSoft: string;
  rule: string;
  accent: string;
  eyebrow: string;
};

/* ─── Data ──────────────────────────────────────────────────── */

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Kia ora! I'm here to help with anything about volunteering at Everybody Eats. Ask me about what to expect on your first shift, kitchen safety, shift roles, or anything else 🌿",
};

const DEFAULT_SUGGESTED_QUESTIONS: Question[] = [
  { emoji: "🍽️", label: "What happens on a typical shift?" },
  { emoji: "🔪", label: "Kitchen safety tips" },
  { emoji: "👥", label: "What are the volunteer grades?" },
  { emoji: "📍", label: "Where are the kitchens?" },
];

const FLOATING_BAR_HEIGHT = 60;

/* ─── Editorial palette (derived from theme) ────────────────── */

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

/* ─── Leaf Seal (small warm avatar for chat stream) ─────────── */

const LeafSeal = React.memo(function LeafSeal({
  size = 24,
  isDark = false,
}: {
  size?: number;
  isDark?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isDark ? Brand.greenDark : Brand.greenLight,
      }}
    >
      <Text style={{ fontSize: size * 0.48 }}>🌿</Text>
    </View>
  );
});

/* ─── Message Bubble ────────────────────────────────────────── */

const MessageBubble = React.memo(function MessageBubble({
  item,
  colors,
  isDark,
  isFirstInGroup,
  paperTint,
}: {
  item: Message;
  colors: (typeof Colors)["light"];
  isDark: boolean;
  isFirstInGroup: boolean;
  paperTint: PaperTint;
}) {
  const isUser = item.role === "user";

  if (isUser) {
    return (
      <View
        style={[
          styles.messageRow,
          styles.userRow,
          { marginTop: isFirstInGroup ? 18 : 4 },
        ]}
      >
        <View style={[styles.userBubble, { backgroundColor: Brand.green }]}>
          <Text style={styles.userText}>{item.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.assistantBlock, { marginTop: isFirstInGroup ? 24 : 10 }]}
    >
      {isFirstInGroup && (
        <View style={styles.assistantMeta}>
          <LeafSeal size={22} isDark={isDark} />
          <Text
            style={[styles.assistantMetaLabel, { color: paperTint.eyebrow }]}
          >
            EE ASSISTANT
          </Text>
        </View>
      )}
      <View style={styles.assistantBody}>
        <MarkdownDisplay
          style={{
            body: {
              color: colors.text,
              fontFamily: FontFamily.regular,
              fontSize: 15.5,
              lineHeight: 24,
            },
            strong: { fontFamily: FontFamily.semiBold },
            em: { fontFamily: FontFamily.regular, fontStyle: "italic" },
            bullet_list: { marginVertical: 6 },
            ordered_list: { marginVertical: 6 },
            list_item: { marginVertical: 2 },
            link: {
              color: isDark ? Brand.greenLight : Brand.green,
              fontFamily: FontFamily.semiBold,
            },
            paragraph: { marginTop: 0, marginBottom: 10 },
            heading1: {
              fontFamily: FontFamily.headingBold,
              fontSize: 20,
              marginBottom: 8,
              marginTop: 14,
              color: colors.text,
              letterSpacing: -0.3,
            },
            heading2: {
              fontFamily: FontFamily.headingBold,
              fontSize: 17,
              marginBottom: 6,
              marginTop: 12,
              color: colors.text,
            },
            heading3: {
              fontFamily: FontFamily.semiBold,
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: 1.2,
              marginBottom: 4,
              marginTop: 10,
              color: paperTint.eyebrow,
            },
            blockquote: {
              borderLeftWidth: 2,
              borderLeftColor: paperTint.eyebrow,
              paddingLeft: 12,
              marginVertical: 8,
              backgroundColor: "transparent",
            },
            code_inline: {
              backgroundColor: isDark ? "#252830" : "rgba(14,58,35,0.06)",
              color: colors.text,
              fontSize: 14,
              paddingHorizontal: 4,
              paddingVertical: 1,
              borderRadius: 4,
            },
          }}
        >
          {item.content}
        </MarkdownDisplay>
      </View>
    </View>
  );
});

/* ─── Welcome Hero — Editorial ─────────────────────────────── */

function WelcomeHero({
  colors,
  isDark,
  onSuggestionPress,
  questions,
  paperTint,
  topInset,
}: {
  colors: (typeof Colors)["light"];
  isDark: boolean;
  onSuggestionPress: (text: string) => void;
  questions: Question[];
  paperTint: PaperTint;
  topInset: number;
}) {
  return (
    <ScrollView
      contentContainerStyle={[
        styles.welcomeContainer,
        {
          paddingTop: topInset + 36,
          paddingBottom: FLOATING_BAR_HEIGHT + 80,
        },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Hero block */}
      <View style={styles.heroBlock}>
        <Text style={styles.heroLine}>
          <Text style={[styles.hero, { color: paperTint.ink }]}>Kia ora</Text>
          <Text style={[styles.hero, { color: paperTint.accent }]}>.</Text>
        </Text>
        <Text style={[styles.heroSubtitle, { color: paperTint.inkSoft }]}>
          What would you like to know{"\n"}about volunteering with us?
        </Text>
      </View>

      {/* Hairline divider */}
      <View style={[styles.hairline, { backgroundColor: paperTint.rule }]} />

      {/* Suggestions header */}
      <Text
        style={[
          styles.eyebrow,
          { color: paperTint.eyebrow, marginTop: 28, marginBottom: 4 },
        ]}
      >
        TRY ASKING
      </Text>

      {/* Numbered editorial list */}
      <View style={styles.questionList}>
        {questions.map((q, i) => (
          <Pressable
            key={q.label}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSuggestionPress(q.label);
            }}
            style={({ pressed }) => [
              styles.questionRow,
              {
                borderBottomColor: paperTint.rule,
                borderBottomWidth: StyleSheet.hairlineWidth,
                opacity: pressed ? 0.55 : 1,
              },
              i === 0 && {
                borderTopColor: paperTint.rule,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}
            accessibilityLabel={q.label}
            accessibilityRole="button"
          >
            <Text style={[styles.questionNumber, { color: paperTint.eyebrow }]}>
              {String(i + 1).padStart(2, "0")}
            </Text>
            <Text
              style={[styles.questionLabel, { color: colors.text }]}
              numberOfLines={2}
            >
              {q.label}
            </Text>
            <Ionicons
              name="arrow-forward"
              size={16}
              color={paperTint.eyebrow}
              style={styles.questionArrow}
            />
          </Pressable>
        ))}
      </View>

      {/* Footer colophon */}
      <View style={styles.welcomeFooter}>
        <View
          style={[
            styles.hairline,
            { backgroundColor: paperTint.rule, marginBottom: 14 },
          ]}
        />
        <Text style={[styles.eyebrowCentered, { color: colors.textSecondary }]}>
          NGĀ MIHI · POWERED BY THE RESOURCE HUB
        </Text>
      </View>
    </ScrollView>
  );
}

/* ─── Main Screen ───────────────────────────────────────────── */

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const paperTint = usePaperTint(isDark, colors);
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<Question[]>(
    DEFAULT_SUGGESTED_QUESTIONS
  );
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [composerHeight, setComposerHeight] = useState(FLOATING_BAR_HEIGHT);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const pendingScrollIndexRef = useRef<number | null>(null);
  const scrollMetricsRef = useRef({
    offset: 0,
    contentHeight: 0,
    layoutHeight: 0,
  });

  const showWelcome = messages.length <= 1;
  const keyboardVisible = keyboardHeight > 0;

  /* ── Keyboard tracking with smooth LayoutAnimation ── */
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
    api<{ suggestedQuestions: Question[] }>("/api/mobile/chat/config")
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
    setShowScrollToBottom(false);
    pendingScrollIndexRef.current = null;
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
      pendingScrollIndexRef.current = messages.length;
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

  /* ── Floating bar vertical position ── */
  const floatingBottom = keyboardVisible
    ? keyboardHeight + 8
    : insets.bottom + 8;

  /* ── Scroll tracking: show button when not at bottom and list is scrollable ── */
  const updateScrollButton = useCallback(() => {
    const { offset, contentHeight, layoutHeight } = scrollMetricsRef.current;
    if (layoutHeight === 0) return;
    const distanceFromBottom = contentHeight - (offset + layoutHeight);
    const scrollable = contentHeight > layoutHeight + 20;
    setShowScrollToBottom(scrollable && distanceFromBottom > 40);
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollMetricsRef.current.offset = e.nativeEvent.contentOffset.y;
      scrollMetricsRef.current.contentHeight = e.nativeEvent.contentSize.height;
      scrollMetricsRef.current.layoutHeight =
        e.nativeEvent.layoutMeasurement.height;
      updateScrollButton();
    },
    [updateScrollButton]
  );

  const handleContentSizeChange = useCallback(
    (_w: number, h: number) => {
      scrollMetricsRef.current.contentHeight = h;
      // If a send was just triggered, pin the user's message to the top.
      if (pendingScrollIndexRef.current !== null) {
        const idx = pendingScrollIndexRef.current;
        pendingScrollIndexRef.current = null;
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToIndex({
            index: idx,
            viewPosition: 0,
            animated: true,
          });
        });
        return;
      }
      updateScrollButton();
    },
    [updateScrollButton]
  );

  const scrollToBottom = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Force-scroll to the exact bottom using tracked metrics (RN's
    // scrollToEnd can be off when content is still settling).
    const { contentHeight, layoutHeight } = scrollMetricsRef.current;
    const target = Math.max(0, contentHeight - layoutHeight);
    flatListRef.current?.scrollToOffset({ offset: target, animated: true });
  }, []);

  /* ── Render message with grouping awareness ── */
  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const prev = messages[index - 1];
      return (
        <MessageBubble
          item={item}
          colors={colors}
          isDark={isDark}
          isFirstInGroup={!prev || prev.role !== item.role}
          paperTint={paperTint}
        />
      );
    },
    [messages, colors, isDark, paperTint]
  );

  /* ── Composer state ── */
  const sendBtnInactive = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const hasInput = input.trim().length > 0 && !isLoading;
  const useNativeGlass = isLiquidGlassAvailable();

  const inputContents = (
    <>
      <View style={styles.glassInputField}>
        <TextInput
          ref={inputRef}
          style={[
            styles.glassInputText,
            { color: colors.text, fontFamily: FontFamily.regular },
          ]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything about volunteering…"
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
    <View style={[styles.container, { backgroundColor: paperTint.paper }]}>
      {/* ── Persistent header with back button ── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            borderBottomColor: showWelcome ? "transparent" : paperTint.rule,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityLabel="Back to Help"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={22} color={paperTint.eyebrow} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerCenterRow}>
            <LeafSeal size={20} isDark={isDark} />
            <Text style={[styles.headerTitle, { color: paperTint.eyebrow }]}>
              EE ASSISTANT
            </Text>
            <View style={[styles.statusDot, { backgroundColor: "#22c55e" }]} />
          </View>
        </View>
        <View style={styles.headerRight}>
          {!showWelcome ? (
            <Pressable
              onPress={resetChat}
              style={({ pressed }) => [
                styles.newChatBtn,
                { opacity: pressed ? 0.55 : 1 },
              ]}
              accessibilityLabel="Start new conversation"
              accessibilityRole="button"
              hitSlop={12}
            >
              <Ionicons
                name="create-outline"
                size={16}
                color={paperTint.eyebrow}
              />
              <Text style={[styles.newChatLabel, { color: paperTint.eyebrow }]}>
                NEW
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ── Content area ── */}
      {showWelcome ? (
        <WelcomeHero
          colors={colors}
          isDark={isDark}
          onSuggestionPress={sendMessage}
          questions={suggestedQuestions}
          paperTint={paperTint}
          topInset={0}
        />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messageList,
            { paddingBottom: composerHeight + floatingBottom },
          ]}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={32}
          onContentSizeChange={handleContentSizeChange}
          onLayout={(e) => {
            scrollMetricsRef.current.layoutHeight = e.nativeEvent.layout.height;
            updateScrollButton();
          }}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: Math.min(info.index, info.highestMeasuredFrameIndex),
                viewPosition: 0,
                animated: true,
              });
            }, 80);
          }}
          ListFooterComponent={
            isLoading ? (
              <View style={[styles.assistantBlock, { marginTop: 24 }]}>
                <View style={styles.assistantMeta}>
                  <LeafSeal size={22} isDark={isDark} />
                  <Text
                    style={[
                      styles.assistantMetaLabel,
                      { color: paperTint.eyebrow },
                    ]}
                  >
                    EE ASSISTANT
                  </Text>
                </View>
                <View style={[styles.assistantBody, styles.typingBody]}>
                  <TypingDots color={colors.textSecondary} />
                </View>
              </View>
            ) : null
          }
          ListFooterComponentStyle={styles.listFooter}
        />
      )}

      {/* ── Floating scroll-to-bottom button ── */}
      {!showWelcome && showScrollToBottom && (
        <Pressable
          onPress={scrollToBottom}
          style={({ pressed }) => [
            styles.scrollToBottomBtn,
            {
              bottom: floatingBottom + FLOATING_BAR_HEIGHT + 14,
              backgroundColor: isDark ? "#1a1d21" : "#ffffff",
              borderColor: isDark
                ? "rgba(255,255,255,0.14)"
                : "rgba(14,58,35,0.14)",
              transform: [{ scale: pressed ? 0.9 : 1 }],
            },
          ]}
          accessibilityLabel="Scroll to latest message"
          accessibilityRole="button"
          hitSlop={8}
        >
          <Ionicons name="arrow-down" size={18} color={paperTint.eyebrow} />
        </Pressable>
      )}

      {/* ── Floating composer ── */}
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
        {showWelcome ? (
          <View
            style={[
              styles.glassBar,
              styles.glassBarFallback,
              {
                backgroundColor: isDark ? "#1a1d21" : "#ffffff",
                borderColor: isDark
                  ? "rgba(255,255,255,0.12)"
                  : "rgba(14, 58, 35, 0.14)",
                borderWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            {inputContents}
          </View>
        ) : useNativeGlass ? (
          <GlassView glassEffectStyle="regular" style={styles.glassBar}>
            {inputContents}
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
                  borderColor: isDark
                    ? "rgba(255,255,255,0.18)"
                    : "rgba(14, 58, 35, 0.14)",
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: 22,
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
  container: { flex: 1 },

  /* Persistent header */
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },
  backBtn: {
    width: 60,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerCenterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerRight: {
    width: 60,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    letterSpacing: 2.2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  newChatLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.8,
  },

  /* Welcome — editorial */
  welcomeContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
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
  heroBlock: {
    marginBottom: 28,
  },
  heroLine: {
    marginBottom: 18,
  },
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
  questionList: {
    marginTop: 4,
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    gap: 14,
  },
  questionNumber: {
    fontFamily: FontFamily.headingBold,
    fontSize: 15,
    width: 28,
    letterSpacing: 0.5,
  },
  questionLabel: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  questionArrow: {
    marginLeft: 4,
  },
  welcomeFooter: {
    marginTop: 44,
  },

  /* Message list */
  messageList: {
    paddingHorizontal: 22,
    paddingTop: 8,
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
  userBubble: {
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 20,
    borderBottomRightRadius: 6,
  },
  userText: {
    color: "#ffffff",
    fontFamily: FontFamily.regular,
    fontSize: 15.5,
    lineHeight: 22,
  },

  /* Assistant — editorial prose */
  assistantBlock: {
    flexDirection: "column",
  },
  assistantMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  assistantMetaLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.8,
  },
  assistantBody: {
    paddingLeft: 32,
    paddingRight: 8,
  },
  typingBody: {
    paddingTop: 4,
    paddingBottom: 4,
  },

  /* Typing indicator */
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 22,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  /* Floating composer */
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
  glassBarFallback: {
    overflow: "hidden",
  },
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
    maxHeight: 100,
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

  /* Scroll-to-bottom floating button */
  scrollToBottomBtn: {
    position: "absolute",
    alignSelf: "center",
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 11,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
});
