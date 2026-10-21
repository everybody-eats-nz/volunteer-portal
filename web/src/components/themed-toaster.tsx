"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/**
 * Sonner's Toaster, following the site theme. next-themes resolves "system"
 * to light or dark itself, so the toasts match the page rather than the OS
 * when a volunteer has picked a theme by hand.
 */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="top-right"
      closeButton
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}
