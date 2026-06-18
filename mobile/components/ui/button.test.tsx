import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { Button } from '@/components/ui/button';
import { Colors, Palette } from '@/constants/theme';
import { render } from '@/test-utils/render';

// `vi.mock` is hoisted above the imports above, so the component resolves these
// stubs. Native primitives → lightweight stubs (see test-utils/react-native).
vi.mock('react-native', () => import('@/test-utils/react-native'));
vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

/** Flatten a style value (possibly a nested array) into one object. */
function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.filter(Boolean).reduce<Record<string, unknown>>(
      (acc, s) => Object.assign(acc, flatten(s)),
      {}
    );
  }
  return (style as Record<string, unknown>) ?? {};
}

/** Resolve Pressable's `style` render-prop (unpressed) into one object. */
function pressableStyle(tree: ReturnType<typeof render>) {
  const style = tree.root.findByType(Pressable).props.style;
  return flatten(typeof style === 'function' ? style({ pressed: false }) : style);
}

const labelColor = (tree: ReturnType<typeof render>) =>
  flatten(tree.root.findByType(Text).props.style).color;

describe('Button', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders its label and exposes a button role', () => {
    const tree = render(<Button label="Sign up" onPress={() => {}} />);

    expect(tree.root.findByType(Pressable).props.accessibilityRole).toBe('button');
    expect(tree.root.findByType(Text).props.children).toBe('Sign up');
  });

  it('defaults the accessibility label to the visible label, and lets it be overridden', () => {
    const a = render(<Button label="Sign up" onPress={() => {}} />);
    expect(a.root.findByType(Pressable).props.accessibilityLabel).toBe('Sign up');

    const b = render(
      <Button label="Go" onPress={() => {}} accessibilityLabel="Go to next step" />
    );
    expect(b.root.findByType(Pressable).props.accessibilityLabel).toBe('Go to next step');
  });

  it('fires onPress when enabled and triggers a light haptic on iOS', () => {
    const onPress = vi.fn();
    const tree = render(<Button label="Tap" onPress={onPress} />);

    tree.root.findByType(Pressable).props.onPress();

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it('skips the haptic when haptic={false}', () => {
    const onPress = vi.fn();
    const tree = render(<Button label="Tap" onPress={onPress} haptic={false} />);

    tree.root.findByType(Pressable).props.onPress();

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('does not fire onPress when disabled', () => {
    const onPress = vi.fn();
    const tree = render(<Button label="Nope" onPress={onPress} disabled />);
    const pressable = tree.root.findByType(Pressable);

    pressable.props.onPress();

    expect(onPress).not.toHaveBeenCalled();
    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.accessibilityState).toEqual({ disabled: true });
  });

  it('does not fire onPress while loading, and swaps the label for a spinner', () => {
    const onPress = vi.fn();
    const tree = render(<Button label="Saving" onPress={onPress} loading />);

    tree.root.findByType(Pressable).props.onPress();

    expect(onPress).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(tree.root.findAllByType(Text)).toHaveLength(0);
  });

  describe('variants', () => {
    it('primary fills with the forest primary on cream text', () => {
      const tree = render(<Button label="Primary" variant="primary" onPress={() => {}} />);
      expect(pressableStyle(tree).backgroundColor).toBe(Colors.light.primary);
      expect(labelColor(tree)).toBe(Palette.cream50);
    });

    it('accent fills with sun-yellow on ink text', () => {
      const tree = render(<Button label="Accent" variant="accent" onPress={() => {}} />);
      expect(pressableStyle(tree).backgroundColor).toBe(Palette.sun200);
      expect(labelColor(tree)).toBe(Palette.ink);
    });

    it('ghost is transparent with a hairline border and tinted text', () => {
      const tree = render(<Button label="Ghost" variant="ghost" onPress={() => {}} />);
      const style = pressableStyle(tree);
      expect(style.backgroundColor).toBe('transparent');
      expect(style.borderWidth).toBe(1);
      expect(labelColor(tree)).toBe(Colors.light.tint);
    });
  });

  it('dims to ~45% opacity when disabled', () => {
    const tree = render(<Button label="Off" onPress={() => {}} disabled />);
    expect(pressableStyle(tree).opacity).toBe(0.45);
  });

  it('matches the primary-button snapshot', () => {
    const tree = render(<Button label="Sign up" onPress={() => {}} />);
    expect(tree.toJSON()).toMatchSnapshot();
  });
});
