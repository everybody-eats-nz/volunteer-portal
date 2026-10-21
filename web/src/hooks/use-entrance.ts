import type { MotionProps } from "motion/react";
import { useHydrated } from "./use-hydrated";

/**
 * Wraps the `initial` prop of an entrance animation so it never hides server
 * HTML:
 *
 *   const entrance = useEntrance();
 *   <motion.div initial={entrance("hidden")} animate="visible" />
 *
 * During SSR and hydration `entrance(...)` returns `false`, so motion renders
 * the element in its `animate` state: the first paint is the finished page,
 * visible before (and without) JavaScript. Components that mount later on the
 * client - after a soft navigation, or when a list changes - get their
 * `initial` back and play the entrance as before. motion only reads `initial`
 * on mount, so the post-hydration re-render does not replay anything.
 */
export function useEntrance() {
  const hydrated = useHydrated();
  return <T extends MotionProps["initial"]>(initial: T): T | false =>
    hydrated ? initial : false;
}
