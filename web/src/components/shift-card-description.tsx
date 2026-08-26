"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CLAMP_CLASSES = {
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
} as const;

interface ShiftCardDescriptionProps {
  text: string;
  /** Lines shown before the description is clamped. */
  collapsedLines?: keyof typeof CLAMP_CLASSES;
  className?: string;
  testId?: string;
}

/**
 * Shift description that clamps to a few lines but can be opened in place.
 *
 * Offsite shifts carry long notes - full street address, parking, who to ask
 * for - so the card keeps its tidy height while still letting volunteers read
 * everything without leaving the list.
 */
export function ShiftCardDescription({
  text,
  collapsedLines = 3,
  className,
  testId,
}: ShiftCardDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  // Only offer the toggle when the clamp actually hides something - a two-line
  // note should never grow a "Show more" that reveals nothing.
  const measure = useCallback(() => {
    const el = textRef.current;
    if (!el || expanded) return;
    setIsClamped(el.scrollHeight - el.clientHeight > 1);
  }, [expanded]);

  useEffect(() => {
    measure();
    const el = textRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Card widths change with the grid breakpoints, which changes how much fits.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, text]);

  return (
    <div className={className}>
      <p
        ref={textRef}
        data-testid={testId}
        className={`text-sm leading-relaxed whitespace-pre-line text-forest-700/70 dark:text-cream-50/65 ${
          expanded ? "" : CLAMP_CLASSES[collapsedLines]
        }`}
      >
        {text}
      </p>
      {(isClamped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          data-testid={testId ? `${testId}-toggle` : undefined}
          className="mt-1 py-1 text-xs font-medium text-forest-600 underline decoration-forest-500/40 underline-offset-4 transition-colors hover:text-forest-700 hover:decoration-forest-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-sm dark:text-cream-50/80 dark:decoration-cream-50/40 dark:hover:text-cream-50 dark:hover:decoration-cream-50/70 cursor-pointer"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
