import { cn } from "@/lib/utils";

/**
 * Marks a figure that is, or includes, a planning estimate. The dashed amber
 * border matches an estimated line's amount field: dashed means pencilled in.
 */
export function EstimateBadge({
  children = "Est.",
  label,
  className,
  testId,
}: {
  /** The visible text. Short ("Est.") beside an amount. */
  children?: React.ReactNode;
  /** What a screen reader hears instead, when the visible text is terse. */
  label?: string;
  className?: string;
  testId?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-dashed border-amber-500/80 bg-amber-50 px-1.5 py-px text-[11px] font-semibold leading-4 text-amber-800 dark:border-amber-500/60 dark:bg-amber-950/40 dark:text-amber-300",
        className
      )}
      title={label}
      data-testid={testId}
    >
      {label ? (
        <>
          <span aria-hidden>{children}</span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        children
      )}
    </span>
  );
}
