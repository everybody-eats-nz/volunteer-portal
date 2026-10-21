import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { STATUS_TINTED, type StatusTone } from "@/lib/status-styles";

/**
 * A status chip drawn from the shared status map (`lib/status-styles.ts`).
 * Pass the label as children; colour is never the only signal.
 */
export function StatusBadge({
  tone,
  className,
  children,
  ...props
}: ComponentProps<"span"> & { tone: StatusTone }) {
  return (
    <span
      data-slot="status-badge"
      data-tone={tone}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium [&>svg]:size-3 [&>svg]:shrink-0",
        STATUS_TINTED[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
