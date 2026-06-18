import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { Brand, Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type AgreementModalProps = {
  visible: boolean;
  title: string;
  /** Raw markdown body of the policy. */
  content: string;
  loading: boolean;
  error: boolean;
  /** Re-fetch the policy text when loading failed. */
  onRetry: () => void;
  onClose: () => void;
  onAgree: () => void;
};

/**
 * Full-screen agreement reader. The "I agree" button stays disabled until the
 * volunteer scrolls to the end of the policy, so we know the content was put in
 * front of them before they accept.
 */
export function AgreementModal({
  visible,
  title,
  content,
  loading,
  error,
  onRetry,
  onClose,
  onAgree,
}: AgreementModalProps) {
  const isDark = useColorScheme() === "dark";
  const colors = Colors[isDark ? "dark" : "light"];
  const insets = useSafeAreaInsets();

  const [reachedEnd, setReachedEnd] = useState(false);
  // Tracks the visible viewport height so short policies (that never scroll)
  // still unlock the agree button.
  const viewportH = useRef(0);

  const surface = isDark ? "#15181d" : Brand.warmWhite;
  const headerStroke = isDark
    ? "rgba(255,255,255,0.08)"
    : "rgba(14,58,35,0.10)";
  const mutedText = isDark ? colors.textSecondary : "rgba(26,20,16,0.62)";

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (reachedEnd) return;
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 28) {
      setReachedEnd(true);
      Haptics.selectionAsync();
    }
  }

  function handleContentSize(_w: number, h: number) {
    // If the whole policy fits without scrolling, there's nothing to scroll —
    // treat it as fully read once laid out.
    if (viewportH.current > 0 && h <= viewportH.current + 4) {
      setReachedEnd(true);
    }
  }

  function handleClose() {
    setReachedEnd(false);
    onClose();
  }

  function handleAgree() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setReachedEnd(false);
    onAgree();
  }

  const blocks = useMemo(() => parseMarkdown(content), [content]);
  const canAgree = reachedEnd && !loading && !error;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: surface }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + 12, borderBottomColor: headerStroke },
          ]}
        >
          <ThemedText
            type="heading"
            style={styles.headerTitle}
            lightColor={Brand.green}
            darkColor={colors.text}
            numberOfLines={2}
          >
            {title}
          </ThemedText>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={[
              styles.closeBtn,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(14,58,35,0.06)",
              },
            ]}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={Brand.green} />
            <ThemedText style={[styles.centerText, { color: mutedText }]}>
              Loading the agreement…
            </ThemedText>
          </View>
        ) : error ? (
          <View style={styles.centerFill}>
            <Ionicons
              name="cloud-offline-outline"
              size={32}
              color={mutedText}
            />
            <ThemedText style={[styles.centerText, { color: mutedText }]}>
              Couldn't load the agreement.
            </ThemedText>
            <Pressable
              onPress={onRetry}
              style={({ pressed }) => [
                styles.retryBtn,
                { borderColor: Brand.green, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Ionicons name="refresh" size={16} color={Brand.green} />
              <ThemedText style={[styles.retryText, { color: Brand.green }]}>
                Try again
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onLayout={(e) => {
              viewportH.current = e.nativeEvent.layout.height;
            }}
            onContentSizeChange={handleContentSize}
            showsVerticalScrollIndicator
          >
            {blocks.map((block, i) => (
              <MarkdownBlock
                key={i}
                block={block}
                colors={colors}
                mutedText={mutedText}
              />
            ))}
          </ScrollView>
        )}

        {/* Footer */}
        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 14) + 4,
              borderTopColor: headerStroke,
            },
          ]}
        >
          {!canAgree && !loading && !error && (
            <Animated.View entering={FadeIn} style={styles.scrollHint}>
              <Ionicons name="arrow-down" size={15} color={mutedText} />
              <ThemedText style={[styles.scrollHintText, { color: mutedText }]}>
                Scroll to the end to continue
              </ThemedText>
            </Animated.View>
          )}
          <Pressable
            onPress={handleAgree}
            disabled={!canAgree}
            style={({ pressed }) => [
              styles.agreeBtn,
              {
                backgroundColor: Brand.green,
                opacity: !canAgree ? 0.45 : pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canAgree }}
          >
            {canAgree && (
              <Ionicons name="checkmark-circle" size={20} color={Brand.accent} />
            )}
            <ThemedText style={styles.agreeBtnText}>
              {canAgree ? "I agree" : "Read the full agreement"}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Tappable row that gates an agreement — shows agreed/unagreed state and opens
 * the reader. Shared by the register screen and the post-OAuth agreement gate.
 */
export function AgreementGate({
  title,
  agreed,
  onPress,
  inputBg,
  inputStroke,
  mutedText,
  textColor,
}: {
  title: string;
  agreed: boolean;
  onPress: () => void;
  inputBg: string;
  inputStroke: string;
  mutedText: string;
  textColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        gateStyles.gate,
        {
          backgroundColor: inputBg,
          borderColor: agreed ? Brand.green : inputStroke,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ checked: agreed }}
      accessibilityLabel={
        agreed
          ? `${title}, agreed. Tap to review.`
          : `${title}. Tap to read and agree.`
      }
    >
      <View
        style={[
          gateStyles.gateCheck,
          {
            backgroundColor: agreed ? Brand.green : "transparent",
            borderColor: agreed ? Brand.green : inputStroke,
          },
        ]}
      >
        {agreed && <Ionicons name="checkmark" size={16} color={Brand.accent} />}
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={[gateStyles.gateTitle, { color: textColor }]}>
          {title}
        </ThemedText>
        <ThemedText style={[gateStyles.gateSub, { color: mutedText }]}>
          {agreed ? "Agreed — tap to review" : "Tap to read & agree"}
        </ThemedText>
      </View>
      <Ionicons
        name={agreed ? "document-text" : "chevron-forward"}
        size={20}
        color={agreed ? Brand.green : mutedText}
      />
    </Pressable>
  );
}

const gateStyles = StyleSheet.create({
  gate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 60,
  },
  gateCheck: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  gateTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  gateSub: {
    fontFamily: FontFamily.regular,
    fontSize: 12.5,
    marginTop: 1,
  },
});

/* ───────────────────────── Markdown rendering ───────────────────────── */

type Block =
  | { kind: "h1" | "h2" | "h3" | "p"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "hr" };

/**
 * Minimal markdown parser for the policy docs (headings, bullets, bold,
 * dividers). Intentionally tiny — avoids pulling a markdown dependency into the
 * app for two static documents.
 */
function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of src.split("\n")) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^---+$/.test(trimmed)) {
      blocks.push({ kind: "hr" });
    } else if (trimmed.startsWith("### ")) {
      blocks.push({ kind: "h3", text: trimmed.slice(4) });
    } else if (trimmed.startsWith("## ")) {
      blocks.push({ kind: "h2", text: trimmed.slice(3) });
    } else if (trimmed.startsWith("# ")) {
      blocks.push({ kind: "h1", text: trimmed.slice(2) });
    } else if (/^[-*]\s+/.test(trimmed)) {
      blocks.push({ kind: "bullet", text: trimmed.replace(/^[-*]\s+/, "") });
    } else {
      blocks.push({ kind: "p", text: trimmed });
    }
  }
  return blocks;
}

/** Render inline markdown: **bold** spans and [text](url) → text. */
function renderInline(text: string, boldFamily: string) {
  const cleaned = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  const parts = cleaned.split("**");
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <ThemedText key={i} style={{ fontFamily: boldFamily }}>
        {part}
      </ThemedText>
    ) : (
      part
    )
  );
}

function MarkdownBlock({
  block,
  colors,
  mutedText,
}: {
  block: Block;
  colors: (typeof Colors)["light"];
  mutedText: string;
}) {
  if (block.kind === "hr") {
    return <View style={[styles.hr, { backgroundColor: mutedText }]} />;
  }
  if (block.kind === "bullet") {
    return (
      <View style={styles.bulletRow}>
        <ThemedText style={[styles.bulletDot, { color: Brand.green }]}>
          {"•"}
        </ThemedText>
        <ThemedText style={[styles.bodyText, { color: colors.text }]}>
          {renderInline(block.text, FontFamily.semiBold)}
        </ThemedText>
      </View>
    );
  }
  if (block.kind === "h1") {
    return (
      <ThemedText
        style={[styles.h1, { color: colors.text }]}
        lightColor={Brand.green}
      >
        {block.text}
      </ThemedText>
    );
  }
  if (block.kind === "h2") {
    return (
      <ThemedText
        style={[styles.h2, { color: colors.text }]}
        lightColor={Brand.green}
      >
        {block.text}
      </ThemedText>
    );
  }
  if (block.kind === "h3") {
    return (
      <ThemedText style={[styles.h3, { color: colors.text }]}>
        {block.text}
      </ThemedText>
    );
  }
  return (
    <ThemedText style={[styles.bodyText, { color: colors.text }]}>
      {renderInline(block.text, FontFamily.semiBold)}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    flex: 1,
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    lineHeight: 28,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  centerText: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    textAlign: "center",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 4,
  },
  retryText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  h1: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
    lineHeight: 28,
    marginTop: 10,
    marginBottom: 8,
  },
  h2: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    lineHeight: 24,
    marginTop: 18,
    marginBottom: 6,
  },
  h3: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 14,
    marginBottom: 4,
  },
  bodyText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 22,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 10,
    paddingRight: 4,
    marginBottom: 4,
  },
  bulletDot: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    lineHeight: 22,
  },
  hr: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.25,
    marginVertical: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  scrollHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  scrollHintText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
  },
  agreeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  agreeBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    color: "#fffdf7",
    letterSpacing: 0.2,
  },
});
