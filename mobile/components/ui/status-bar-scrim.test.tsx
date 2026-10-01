import { afterEach, describe, expect, it, vi } from 'vitest';
import { LinearGradient } from 'expo-linear-gradient';

import { StatusBarScrim } from '@/components/ui/status-bar-scrim';
import { Colors } from '@/constants/theme';
import { __resetColorScheme, __setColorScheme } from '@/test-utils/react-native';
import { render } from '@/test-utils/render';
import { flatten } from '@/test-utils/style';

// `vi.mock` is hoisted above the imports above (see test-utils/react-native).
vi.mock('react-native', () => import('@/test-utils/react-native'));
vi.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));

const insets = vi.hoisted(() => ({ top: 62, bottom: 34, left: 0, right: 0 }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => insets,
}));

const gradient = (tree: ReturnType<typeof render>) =>
  tree.root.findByType(LinearGradient).props;

describe('StatusBarScrim', () => {
  afterEach(() => {
    insets.top = 62;
    __resetColorScheme();
  });

  it('pins to the top of the screen and spans exactly the top inset', () => {
    const style = flatten(gradient(render(<StatusBarScrim />)).style);

    expect(style).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0 });
    expect(style.height).toBe(62);
  });

  it('stays solid paper over the status bar glyphs, then fades out', () => {
    const { colors, locations } = gradient(render(<StatusBarScrim />));

    // Solid from the top edge down to where the fade begins.
    expect(colors.slice(0, 2)).toEqual([Colors.light.background, Colors.light.background]);
    expect(locations[0]).toBe(0);
    // 16pt fade on a 62pt inset: solid for the first 46pt.
    expect(locations[1]).toBeCloseTo(46 / 62);
    // Fully clear exactly at the safe-area edge, so content at rest is untouched.
    expect(locations.at(-1)).toBe(1);
    expect(colors.at(-1)).toBe('rgba(253, 248, 239, 0)');
    expect(colors).toHaveLength(locations.length);
  });

  it('keeps its stops in ascending order', () => {
    const { locations } = gradient(render(<StatusBarScrim />));

    expect([...locations].sort((a, b) => a - b)).toEqual(locations);
  });

  it('shortens the fade on a short status bar', () => {
    insets.top = 20;
    const { locations } = gradient(render(<StatusBarScrim />));

    // 30% of a 20pt inset is a 6pt fade, leaving the top 14pt solid.
    expect(locations[1]).toBeCloseTo(14 / 20);
  });

  it('renders nothing when there is no top inset', () => {
    insets.top = 0;

    expect(render(<StatusBarScrim />).toJSON()).toBeNull();
  });

  it('follows the dark theme background', () => {
    __setColorScheme('dark');
    const { colors } = gradient(render(<StatusBarScrim />));

    expect(colors[0]).toBe(Colors.dark.background);
    expect(colors.at(-1)).toBe('rgba(15, 17, 20, 0)');
  });

  it('fades into a custom paper colour when given one', () => {
    const { colors } = gradient(render(<StatusBarScrim color="#102030" />));

    expect(colors[0]).toBe('#102030');
    expect(colors.at(-1)).toBe('rgba(16, 32, 48, 0)');
  });

  it('never intercepts touches and is hidden from screen readers', () => {
    const props = gradient(render(<StatusBarScrim />));

    expect(props.pointerEvents).toBe('none');
    expect(props.accessibilityElementsHidden).toBe(true);
    expect(props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
