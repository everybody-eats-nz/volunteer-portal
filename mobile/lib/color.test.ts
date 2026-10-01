import { describe, expect, it } from 'vitest';

import { withAlpha } from '@/lib/color';

describe('withAlpha', () => {
  it('converts a six-digit hex colour', () => {
    expect(withAlpha('#FDF8EF', 0.5)).toBe('rgba(253, 248, 239, 0.5)');
  });

  it('expands a three-digit hex colour', () => {
    expect(withAlpha('#0f8', 1)).toBe('rgba(0, 255, 136, 1)');
  });

  it('replaces the alpha of an eight-digit hex colour', () => {
    expect(withAlpha('#0F111480', 0)).toBe('rgba(15, 17, 20, 0)');
  });

  it('keeps the hue at zero alpha instead of fading to black', () => {
    expect(withAlpha('#FDF8EF', 0)).toBe('rgba(253, 248, 239, 0)');
  });

  it('clamps alpha into the 0 to 1 range', () => {
    expect(withAlpha('#000000', 4)).toBe('rgba(0, 0, 0, 1)');
    expect(withAlpha('#000000', -1)).toBe('rgba(0, 0, 0, 0)');
  });

  it('passes a non-hex colour through untouched when opaque', () => {
    expect(withAlpha('rgb(1, 2, 3)', 0.4)).toBe('rgb(1, 2, 3)');
  });

  it('falls back to transparent for a non-hex colour at zero alpha', () => {
    expect(withAlpha('papayawhip', 0)).toBe('transparent');
  });
});
