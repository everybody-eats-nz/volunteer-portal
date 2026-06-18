import { describe, expect, it, vi } from 'vitest';
import { Text } from 'react-native';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { render } from '@/test-utils/render';
import { flatten } from '@/test-utils/style';

// `vi.mock` is hoisted above the imports above (see test-utils/react-native).
vi.mock('react-native', () => import('@/test-utils/react-native'));

const styleOf = (type: ThemedTextProps['type']) =>
  flatten(render(<ThemedText type={type}>Kia ora</ThemedText>).root.findByType(Text).props.style);

describe('ThemedText', () => {
  it.each([
    ['default', FontFamily.regular],
    ['defaultSemiBold', FontFamily.semiBold],
    ['subtitle', FontFamily.semiBold],
    ['heading', FontFamily.heading],
    ['title', FontFamily.display],
    ['display', FontFamily.display],
    ['displayLarge', FontFamily.display],
    ['caption', FontFamily.regular],
    ['link', FontFamily.medium],
    ['accent', FontFamily.displayItalic],
  ] as const)('type="%s" resolves the %s font family', (type, fontFamily) => {
    expect(styleOf(type).fontFamily).toBe(fontFamily);
  });

  it('falls back to the default style for an unknown type', () => {
    // `default` is the documented fallback (styles[type] ?? styles.default).
    expect(styleOf('default').fontFamily).toBe(FontFamily.regular);
  });

  it('applies the theme text colour for normal types', () => {
    expect(styleOf('title').color).toBe(Colors.light.text);
  });

  it('honours an explicit lightColor override', () => {
    const tree = render(
      <ThemedText type="default" lightColor="#123456">
        Kia ora
      </ThemedText>
    );
    expect(flatten(tree.root.findByType(Text).props.style).color).toBe('#123456');
  });

  it('omits its own colour for the accent type so it inherits from its parent', () => {
    // The accent italic is meant to be nested inside a heading and inherit
    // size + colour — it must not pin its own colour.
    const accent = styleOf('accent');
    expect(accent.color).toBeUndefined();
    expect(accent.fontFamily).toBe(FontFamily.displayItalic);
  });

  it('nested accent keeps the parent display font on the outer text and italic on the inner', () => {
    const tree = render(
      <ThemedText type="display">
        The <ThemedText type="accent">mahi</ThemedText>, in numbers
      </ThemedText>
    );
    const [outer, inner] = tree.root.findAllByType(Text);

    expect(flatten(outer.props.style).fontFamily).toBe(FontFamily.display);
    expect(flatten(outer.props.style).color).toBe(Colors.light.text);

    expect(flatten(inner.props.style).fontFamily).toBe(FontFamily.displayItalic);
    expect(flatten(inner.props.style).color).toBeUndefined();
  });

  it('matches the title snapshot', () => {
    const tree = render(<ThemedText type="title">Kia ora</ThemedText>);
    expect(tree.toJSON()).toMatchSnapshot();
  });
});
