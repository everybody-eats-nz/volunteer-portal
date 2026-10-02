/**
 * Where a form has to scroll to so the keyboard does not cover what is being
 * typed into.
 *
 * Everything is in the scroll view's content coordinates, so the answer does
 * not depend on where the form happens to be scrolled right now. It is pure
 * (and a worklet, because `useKeyboardAwareScroll` calls it on the UI thread
 * for every frame of the keyboard animation) so the rules can be tested
 * without a device.
 */

export type RevealTarget = {
  /** Top edge of the focused input. */
  top: number;
  /** Bottom edge of the focused input. */
  bottom: number;
  /**
   * Bottom edge of the group worth showing with it, for example the last
   * field of the form. Equal to `bottom` when the input stands alone.
   */
  groupBottom: number;
};

/**
 * The smallest scroll offset that leaves `gap` between the target and the top
 * of the keyboard.
 *
 * The whole group is shown when it fits between the keyboard and `topInset`
 * (the status bar) without pushing the focused input off the top. Otherwise
 * only the input itself is guaranteed. `visibleHeight` is the height of the
 * scroll viewport that is left above the keyboard.
 */
export function keyboardRevealOffset(
  target: RevealTarget,
  visibleHeight: number,
  gap: number,
  topInset: number
): number {
  "worklet";
  const groupHeight = target.groupBottom - target.top;
  const groupFits = groupHeight + gap * 2 <= visibleHeight - topInset;
  const bottom = groupFits
    ? Math.max(target.groupBottom, target.bottom)
    : target.bottom;
  return bottom + gap - visibleHeight;
}

/**
 * Whether a fresh measurement describes the target already being revealed.
 * The form is measured again whenever its content changes size, which is
 * mostly the keyboard spacer animating: nothing above it has moved, and the
 * unchanged measurement must not restart the glide.
 */
export function isSameRevealTarget(
  previous: RevealTarget | null,
  next: RevealTarget
): boolean {
  return (
    previous !== null &&
    previous.top === next.top &&
    previous.bottom === next.bottom &&
    previous.groupBottom === next.groupBottom
  );
}
