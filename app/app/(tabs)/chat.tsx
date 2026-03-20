import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Kia ora! 👋 I'm here to help with anything about volunteering at Everybody Eats. Ask me about what to expect on your first mahi, kitchen safety, shift roles, or anything else 🌿",
};

const SUGGESTED_QUESTIONS = [
  "🍽️ What happens on a typical shift?",
  "🔪 Kitchen safety tips",
  "👥 What are the volunteer grades?",
  "📍 Where are the kitchens?",
];

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const showSuggestions = messages.length <= 1;

  const sendMessage = async (text?: string) => {
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
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={[
          styles.messageBubble,
          isUser
            ? [styles.userBubble, { backgroundColor: Brand.green }]
            : [
                styles.assistantBubble,
                { backgroundColor: colors.card, borderColor: colors.border },
              ],
        ]}
      >
        {!isUser && (
          <View
            style={[
              styles.assistantAvatar,
              { backgroundColor: Brand.greenLight },
            ]}
          >
            <Text style={styles.assistantAvatarEmoji}>🌿</Text>
          </View>
        )}
        <Text
          style={[
            styles.messageText,
            {
              color: isUser ? "#ffffff" : colors.text,
              fontFamily: FontFamily.regular,
            },
          ]}
        >
          {item.content}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <ThemedText type="title">Chat 💬</ThemedText>
        <ThemedText type="caption" style={{ color: colors.textSecondary }}>
          Your volunteering assistant
        </ThemedText>
      </View>

      {/* ── Messages ── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListFooterComponent={
          <>
            {/* Suggested questions */}
            {showSuggestions && (
              <View style={styles.suggestionsContainer}>
                <Text
                  style={[
                    styles.suggestionsLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Try asking...
                </Text>
                <View style={styles.suggestionsGrid}>
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <Pressable
                      key={q}
                      onPress={() => sendMessage(q)}
                      style={({ pressed }) => [
                        styles.suggestionPill,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.suggestionText, { color: colors.text }]}
                      >
                        {q}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Typing indicator */}
            {isLoading && (
              <View
                style={[
                  styles.typingBubble,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.assistantAvatar,
                    { backgroundColor: Brand.greenLight },
                  ]}
                >
                  <Text style={styles.assistantAvatarEmoji}>🌿</Text>
                </View>
                <Text
                  style={[styles.typingDots, { color: colors.textSecondary }]}
                >
                  Thinking...
                </Text>
              </View>
            )}
          </>
        }
      />

      {/* ── Input row ── */}
      <View
        style={[
          styles.inputRow,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              color: colors.text,
              borderColor: colors.border,
              fontFamily: FontFamily.regular,
            },
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
        />
        <Pressable
          onPress={() => sendMessage()}
          disabled={!input.trim() || isLoading}
          style={({ pressed }) => [
            styles.sendButton,
            {
              backgroundColor:
                input.trim() && !isLoading ? Brand.green : colors.border,
              opacity: pressed && input.trim() ? 0.8 : 1,
            },
          ]}
          accessibilityLabel="Send message"
        >
          <Ionicons name="arrow-up" size={20} color="#ffffff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 4,
  },

  // Messages
  messageList: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    padding: 14,
    borderRadius: 18,
    maxWidth: "85%",
  },
  userBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 6,
    borderWidth: 1,
  },
  assistantAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  assistantAvatarEmoji: {
    fontSize: 14,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },

  // Suggestions
  suggestionsContainer: {
    marginTop: 8,
    gap: 10,
  },
  suggestionsLabel: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
  },
  suggestionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
  },

  // Typing indicator
  typingBubble: {
    alignSelf: "flex-start",
    padding: 14,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    marginTop: 4,
  },
  typingDots: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    fontStyle: "italic",
  },

  // Input
  inputRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    alignItems: "flex-end",
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
