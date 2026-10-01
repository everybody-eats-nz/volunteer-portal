import { type RefObject } from "react";
import {
  type FocusEvent,
  type HostInstance,
  type LayoutChangeEvent,
  type View,
} from "react-native";
import type Animated from "react-native-reanimated";
import {
  cancelAnimation,
  Easing,
  KeyboardState,
  scrollTo,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { keyboardRevealOffset, type RevealTarget } from "@/lib/keyboard-reveal";

/** Breathing room between the revealed content and the top of the keyboard. */
const DEFAULT_GAP = 16;

/** The lift is an entrance, so it eases out, at about the keyboard's own pace. */
const GLIDE = { duration: 250, easing: Easing.out(Easing.cubic) };

/**
 * How long the keyboard has to stay closed under a focused input before its
 * space is given back. iOS closes and reopens the keyboard when focus moves
 * between a plain field and a secure one (email to password), about a frame
 * apart.
 */
const RELEASE_DELAY = 150;

/**
 * The scroll view's content container. Present on the ref at runtime, but
 * missing from the React Native typings this project compiles against.
 */
type WithInnerView = { getInnerViewRef?: () => HostInstance | null };

/**
 * Keyboard avoidance for a scrolling form, the same on iOS and Android.
 *
 * `KeyboardAvoidingView` only resizes the scroll view. It never positions the
 * focused field, which on iOS left UIKit's own nudge: that stops with the
 * field's border still under the keyboard. On Android it does nothing at all,
 * because the app is edge-to-edge from Expo SDK 55 and the window no longer
 * resizes for the keyboard. So this does both jobs itself, from the keyboard
 * height reanimated reports:
 *
 * 1. `spacerStyle` goes on an empty view at the end of the scroll content and
 *    takes the height of the keyboard, so the form can always be scrolled
 *    clear of it. The scroll view itself keeps its size: shrinking it instead
 *    exposes the page background in the gap while the keyboard is still
 *    sliding in. When the keyboard is dismissed the space goes with it and the
 *    scroll view settles back by itself. While an input still has focus the
 *    space is held, so the form stays put as iOS swaps one keyboard for
 *    another.
 * 2. Focusing an input glides the form up until the input (and its group,
 *    when one is given and fits) sits `gap` above the keyboard. The glide is
 *    our own animation rather than a frame-by-frame copy of the keyboard,
 *    because iOS 26 reports the keyboard's final height almost at once. Where
 *    the height does arrive frame by frame, the glide simply chases it.
 *
 * The scroll view must reach the bottom of the screen, because the keyboard
 * height is measured from there.
 *
 * Usage:
 *
 *   const keyboardScroll = useKeyboardAwareScroll();
 *
 *   <Animated.ScrollView {...keyboardScroll.scrollProps}>
 *     <View ref={fieldsRef}>
 *       <TextInput {...keyboardScroll.inputProps(fieldsRef)} />
 *     </View>
 *     <Animated.View style={keyboardScroll.spacerStyle} />
 *   </Animated.ScrollView>
 *
 * This animates a scroll offset in response to focus. It adds no entering or
 * layout animations, so it is safe on screens that must mount without them.
 */
export function useKeyboardAwareScroll({
  gap = DEFAULT_GAP,
}: { gap?: number } = {}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const keyboard = useAnimatedKeyboard();
  const viewportHeight = useSharedValue(0);
  const scrollOffset = useSharedValue(0);
  /** What to keep clear of the keyboard. Null while no input has focus. */
  const target = useSharedValue<RevealTarget | null>(null);
  /** Space kept clear for the keyboard at the end of the scroll content. */
  const reserved = useSharedValue(0);
  /** Furthest offset asked for since the input took focus. -1 when idle. */
  const goal = useSharedValue(-1);
  /** The offset on its way to `goal`, pushed to the scroll view every frame. */
  const glide = useSharedValue(0);
  const gliding = useSharedValue(false);

  const spacerStyle = useAnimatedStyle(() => ({ height: reserved.value }));

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollOffset.value = event.contentOffset.y;
    },
    // A finger on the form always wins over the glide.
    onBeginDrag: () => {
      cancelAnimation(glide);
      gliding.value = false;
    },
  });

  const onLayout = (event: LayoutChangeEvent) => {
    viewportHeight.set(event.nativeEvent.layout.height);
  };

  /**
   * Props for an input inside the scroll view. Pass the ref of the group that
   * should be shown with the input (say, the email and password fields
   * together); without one the input is revealed on its own.
   */
  const inputProps = (groupRef?: RefObject<View | null>) => ({
    onFocus: (event: FocusEvent) => {
      const content = (
        scrollRef.current as WithInnerView | null
      )?.getInnerViewRef?.();
      if (!content) return;

      const reveal = (focused: RevealTarget) => {
        goal.set(-1);
        target.set(focused);
      };

      // Measured against the content container rather than the screen, so the
      // result holds wherever the form is currently scrolled to.
      event.currentTarget.measureLayout(content, (_x, y, _width, height) => {
        const input = { top: y, bottom: y + height };
        const group = groupRef?.current;
        if (!group) {
          reveal({ ...input, groupBottom: input.bottom });
          return;
        }
        group.measureLayout(
          content,
          (_groupX, groupY, _groupWidth, groupHeight) => {
            reveal({ ...input, groupBottom: groupY + groupHeight });
          }
        );
      });
    },
    onBlur: () => {
      target.set(null);
    },
  });

  // Reserve room for the keyboard at the end of the content.
  useAnimatedReaction(
    () => ({
      height: keyboard.height.value,
      state: keyboard.state.value,
      focused: target.value !== null,
    }),
    (current, previous) => {
      if (current.state === KeyboardState.CLOSING) {
        // Dismissed: hand the room back in step with the keyboard. With an
        // input still focused this is a keyboard swap, so hold on to it.
        if (!current.focused) reserved.value = current.height;
      } else if (current.state !== KeyboardState.CLOSED) {
        // Assigning also calls off a release that was waiting.
        reserved.value = Math.max(current.height, reserved.value);
      } else if (previous?.state !== KeyboardState.CLOSED) {
        // Closed for good after all (Android's back button hides the keyboard
        // without taking focus), unless it reopens within the delay.
        reserved.value = withDelay(
          current.focused ? RELEASE_DELAY : 0,
          withTiming(0, GLIDE)
        );
      }
    }
  );

  // Work out how far the form has to scroll, and start the glide there.
  useAnimatedReaction(
    () => {
      const focused = target.value;
      const viewport = viewportHeight.value;
      // A closing keyboard only ever uncovers content. Leave the scroll alone.
      if (
        focused === null ||
        viewport <= 0 ||
        keyboard.state.value === KeyboardState.CLOSING
      ) {
        return null;
      }
      return keyboardRevealOffset(
        focused,
        viewport - keyboard.height.value,
        gap,
        insets.top
      );
    },
    (offset) => {
      if (offset === null) {
        goal.value = -1;
        return;
      }
      // Only ever scroll further down, and only once per distance: never pull
      // back a form the volunteer has scrolled past the keyboard themselves.
      if (offset <= Math.max(scrollOffset.value, goal.value)) return;
      goal.value = offset;
      // Pick up from wherever the form is, or from a glide already under way.
      glide.value = gliding.value ? glide.value : scrollOffset.value;
      gliding.value = true;
      glide.value = withTiming(offset, GLIDE, (finished) => {
        if (finished) gliding.value = false;
      });
    }
  );

  useAnimatedReaction(
    () => glide.value,
    (offset, previous) => {
      if (previous !== null && offset !== previous) {
        scrollTo(scrollRef, 0, offset, false);
      }
    }
  );

  return {
    /** Spread onto the `Animated.ScrollView` that holds the form. */
    scrollProps: { ref: scrollRef, onScroll, onLayout, scrollEventThrottle: 16 },
    spacerStyle,
    inputProps,
  };
}
