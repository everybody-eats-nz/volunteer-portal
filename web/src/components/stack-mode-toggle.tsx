"use client";

export type StackMode = "stacked" | "100%";

/**
 * Segmented control to switch a stacked chart between absolute ("Stacked")
 * and proportional ("100%") views. Mirrors the Monthly/Weekly toggle styling
 * used elsewhere on the analytics page for visual consistency.
 */
export function StackModeToggle({
  value,
  onChange,
  className = "",
}: {
  value: StackMode;
  onChange: (v: StackMode) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Chart display mode"
      className={`flex shrink-0 items-center rounded-md border text-sm ${className}`}
    >
      <button
        type="button"
        onClick={() => onChange("stacked")}
        aria-pressed={value === "stacked"}
        className={`px-3 py-1 rounded-l-md transition-colors ${
          value === "stacked"
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted"
        }`}
      >
        Stacked
      </button>
      <button
        type="button"
        onClick={() => onChange("100%")}
        aria-pressed={value === "100%"}
        className={`px-3 py-1 rounded-r-md transition-colors ${
          value === "100%"
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted"
        }`}
      >
        100%
      </button>
    </div>
  );
}
