import { createContext, useContext, useState, type ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import {
  FloatingHeader,
  useFloatingHeader,
  type FloatingHeaderState,
} from "@/components/ui/floating-header";
import { HeaderBackButton } from "@/components/ui/screen-header";
import { Colors, FontFamily } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { KeyboardAwareScroll } from "@/hooks/use-keyboard-aware-scroll";

/**
 * The chrome the driver flows sit in.
 *
 * A driver is standing at a van, often one-handed, often in the dark. The
 * flows are full-bleed paper with a single back affordance and a step count -
 * no tab bar, no scroll, nothing to hunt for.
 */

/** Space under the last thing on a flow screen, above the home indicator. */
const BOTTOM_GAP = 16;
/** Space between the status bar and the flow header. */
const TOP_GAP = 8;
/** The flow header: its 44pt back button plus the space under it. */
const HEADER_HEIGHT = 66;
const SIDE_GUTTER = 24;

/**
 * The flow screen's header, when it floats over the screen's scroll view (see
 * `FloatingHeader`). Null outside a `DriveFlowScreen`.
 */
const FlowHeaderContext = createContext<FloatingHeaderState | null>(null);

/**
 * For a scroll view in a flow screen. Where the header floats, the scroll view
 * runs up underneath it (`style`) and content starts below it, either padded
 * (`contentStyle`, for a form whose scroll offset must start at 0) or inset
 * (`header.scrollProps`, for a list with pull to refresh). Both are empty when
 * the header sits in flow.
 */
export function useFlowScroll() {
  const header = useContext(FlowHeaderContext);
  const inset = header?.floats ? header.inset : 0;
  return {
    header,
    style: inset ? { marginTop: -inset } : undefined,
    contentStyle: inset ? { paddingTop: inset } : undefined,
    scrollProps: header?.floats ? header.scrollProps : {},
  };
}

export function DriveFlowScreen({
  children,
  testID,
}: {
  children: React.ReactNode;
  testID?: string;
}) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const header = useFloatingHeader({
    estimatedHeight: insets.top + TOP_GAP + HEADER_HEIGHT,
  });

  return (
    <FlowHeaderContext.Provider value={header}>
      <View
        testID={testID}
        style={[
          styles.screen,
          {
            backgroundColor: colors.background,
            // A floating header is out of the layout, so the screen keeps
            // its room here instead.
            paddingTop: header.floats ? header.inset : insets.top + TOP_GAP,
            paddingBottom: insets.bottom + BOTTOM_GAP,
          },
        ]}
      >
        {children}
      </View>
    </FlowHeaderContext.Provider>
  );
}

/**
 * A list in a flow screen (trip history, a step's choices). Where the header
 * floats it runs up underneath it, inset so pull to refresh and the scroll
 * indicator stay below the header; otherwise it is a plain `ScrollView`.
 */
export function FlowScrollView({ style, ...props }: ScrollViewProps) {
  const flowScroll = useFlowScroll();
  return <ScrollView {...props} {...flowScroll.scrollProps} style={[style, flowScroll.style]} />;
}

/**
 * The body of a flow step that takes typing.
 *
 * At rest it lays out exactly like the plain flow body: `flexGrow` content, so
 * a child with `marginTop: "auto"` still sits on the bottom edge, and the same
 * space under it. It only scrolls when the keyboard needs it to, through
 * `useKeyboardAwareScroll`:
 *
 * - The scroll view runs through `DriveFlowScreen`'s bottom padding to the
 *   edge of the screen, where the hook measures the keyboard from, and keeps
 *   that space inside its content instead.
 * - The keyboard spacer replaces the home-indicator inset rather than adding
 *   to it, so an action pinned to the bottom rides up `BOTTOM_GAP` above the
 *   keyboard, not the inset plus that.
 * - `footer` is an action that stays on the bottom edge however long the body
 *   is. It is drawn over the scroll view, which still reaches the screen edge,
 *   and the keyboard simply covers it.
 */
export function FlowScroll({
  keyboardScroll,
  footer,
  contentContainerStyle,
  children,
}: {
  keyboardScroll: KeyboardAwareScroll;
  footer?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const flowScroll = useFlowScroll();
  const [footerHeight, setFooterHeight] = useState(0);
  const bottomSpace = insets.bottom + BOTTOM_GAP;

  return (
    <View style={[styles.scrollFrame, { marginBottom: -bottomSpace }, flowScroll.style]}>
      <Animated.ScrollView
        {...keyboardScroll.scrollProps}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          flowScroll.contentStyle,
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
        <View
          style={{
            paddingTop: BOTTOM_GAP,
            minHeight: footer ? footerHeight : bottomSpace,
          }}
        >
          <Animated.View style={keyboardScroll.spacerStyle} />
        </View>
      </Animated.ScrollView>
      {footer ? (
        <View
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          style={[
            styles.footer,
            { backgroundColor: colors.background, paddingBottom: bottomSpace },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function FlowHeader({
  title,
  subtitle,
  onBack,
  step,
  stepCount,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  step?: number;
  stepCount?: number;
}) {
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const floating = useContext(FlowHeaderContext);

  const row = (
    <View style={styles.header}>
      <HeaderBackButton onPress={onBack} color={colors.text} bordered />

      <View style={styles.headerBody}>
        <ThemedText style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText
            style={[styles.headerSubtitle, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </ThemedText>
        ) : null}
      </View>

      {step && stepCount ? (
        <View
          style={styles.steps}
          accessibilityRole="progressbar"
          accessibilityLabel={`Step ${step} of ${stepCount}`}
        >
          {Array.from({ length: stepCount }, (_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                {
                  backgroundColor: i < step ? colors.tint : colors.border,
                  width: i === step - 1 ? 18 : 6,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );

  if (!floating?.floats) return row;

  return (
    <FloatingHeader
      header={floating}
      style={{ paddingTop: insets.top + TOP_GAP, paddingHorizontal: SIDE_GUTTER }}
    >
      {row}
    </FloatingHeader>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: SIDE_GUTTER },
  scrollFrame: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    // With the 44pt back button, the same 66pt the 40pt one plus 26 gave.
    paddingBottom: 22,
  },
  headerBody: { flex: 1 },
  headerTitle: { fontFamily: FontFamily.semiBold, fontSize: 16, lineHeight: 21 },
  headerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 17,
    marginTop: 1,
    fontVariant: ["tabular-nums"],
  },
  steps: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepDot: { height: 6, borderRadius: 999 },
});
