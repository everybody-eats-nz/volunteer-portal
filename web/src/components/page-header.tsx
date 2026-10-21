import type { ReactNode } from "react";
import { Sparkle } from "@/components/sparkle";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** The page's h1. Wrap one word in <em> for the light Fraunces italic. */
  title: ReactNode;
  description?: ReactNode;
  /** Beside the heading from lg up, below it on smaller screens. */
  actions?: ReactNode;
  /** The sun sparkle after the title. */
  sparkle?: boolean;
  align?: "start" | "center";
  className?: string;
  "data-testid"?: string;
  /** Defaults to the heading's test id with "-heading" swapped for "-description". */
  descriptionTestId?: string;
}

/**
 * The volunteer pages' header: a Fraunces display h1 (matching the marketing
 * site, new.everybodyeats.nz), an optional sentence under it and optional
 * actions. A server component with no entrance animation, so it is part of
 * the first paint.
 */
export function PageHeader({
  title,
  description,
  actions,
  sparkle = true,
  align = "start",
  className,
  "data-testid": dataTestId,
  descriptionTestId,
}: PageHeaderProps) {
  const centered = align === "center";

  return (
    <header
      className={cn(
        "flex flex-col gap-6 pb-6",
        centered
          ? "items-center text-center"
          : "lg:flex-row lg:items-end lg:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h1
          className={cn(
            "display flex flex-wrap items-baseline gap-x-3 text-4xl leading-[1.05] tracking-tight text-forest-700 sm:text-5xl lg:text-6xl dark:text-cream-50",
            centered && "justify-center"
          )}
          data-testid={dataTestId}
        >
          <span>{title}</span>
          {sparkle && (
            <Sparkle className="h-6 w-6 shrink-0 self-center text-sun-300 sm:h-7 sm:w-7" />
          )}
        </h1>
        {description && (
          <p
            className={cn(
              "mt-4 max-w-xl text-lg leading-relaxed text-forest-700/75 dark:text-cream-50/75",
              centered && "mx-auto"
            )}
            data-testid={
              descriptionTestId ??
              (dataTestId
                ? `${dataTestId.replace("-heading", "")}-description`
                : undefined)
            }
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}
