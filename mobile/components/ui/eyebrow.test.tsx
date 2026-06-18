import { describe, expect, it, vi } from 'vitest';
import { Text, View } from 'react-native';

import { Eyebrow } from '@/components/ui/eyebrow';
import { Colors } from '@/constants/theme';
import { render } from '@/test-utils/render';
import { flatten } from '@/test-utils/style';

// `vi.mock` is hoisted above the imports above (see test-utils/react-native).
vi.mock('react-native', () => import('@/test-utils/react-native'));

describe('Eyebrow', () => {
  it('uppercases its text and marks it as a header', () => {
    const tree = render(<Eyebrow>Our kaupapa</Eyebrow>);
    const text = tree.root.findByType(Text);

    expect(text.props.children).toBe('OUR KAUPAPA');
    expect(text.props.accessibilityRole).toBe('header');
  });

  it('renders the leading hairline rule by default', () => {
    const tree = render(<Eyebrow>Kicker</Eyebrow>);
    // Outer row View + the rule View == two Views.
    expect(tree.root.findAllByType(View)).toHaveLength(2);
  });

  it('omits the rule when rule={false}', () => {
    const tree = render(<Eyebrow rule={false}>Kicker</Eyebrow>);
    // Only the outer row View remains.
    expect(tree.root.findAllByType(View)).toHaveLength(1);
  });

  it('uses the theme tint colour by default', () => {
    const tree = render(<Eyebrow>Kicker</Eyebrow>);
    expect(flatten(tree.root.findByType(Text).props.style).color).toBe(Colors.light.tint);
  });

  it('applies a colour override to the text', () => {
    const tree = render(<Eyebrow color="#FF0000">Kicker</Eyebrow>);
    expect(flatten(tree.root.findByType(Text).props.style).color).toBe('#FF0000');
  });

  it('matches the snapshot', () => {
    const tree = render(<Eyebrow>Our kaupapa</Eyebrow>);
    expect(tree.toJSON()).toMatchSnapshot();
  });
});
