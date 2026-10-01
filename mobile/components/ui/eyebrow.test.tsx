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

  it('renders only the kicker text, with no leading rule', () => {
    const tree = render(<Eyebrow>Kicker</Eyebrow>);
    expect(tree.root.findAllByType(View)).toHaveLength(0);
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
