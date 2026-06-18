/**
 * Flatten an RN `style` value — which may be a (possibly nested) array of
 * style objects, a single object, or undefined — into one merged object, so
 * tests can assert on a single resolved property (e.g. `flatten(style).color`).
 */
export function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.filter(Boolean).reduce<Record<string, unknown>>(
      (acc, s) => Object.assign(acc, flatten(s)),
      {}
    );
  }
  return (style as Record<string, unknown>) ?? {};
}
