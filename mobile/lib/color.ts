/**
 * Returns `color` at the given opacity as an `rgba()` string.
 *
 * Accepts the hex forms the theme tokens use (`#RGB`, `#RRGGBB`, `#RRGGBBAA`).
 * Fading a gradient to the *same* hue at zero alpha (rather than to
 * `transparent`, which is transparent black) keeps the ramp from greying out
 * through the middle.
 *
 * Anything that is not a hex colour is returned unchanged at full opacity and
 * as `transparent` at zero, so a caller never gets an invalid colour back.
 */
export function withAlpha(color: string, alpha: number): string {
  const clamped = Math.min(1, Math.max(0, alpha));
  const hex = color.trim().replace(/^#/, '');

  if (!/^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) {
    return clamped === 0 ? 'transparent' : color;
  }

  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}
