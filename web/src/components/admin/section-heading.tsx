import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * The one admin section heading style: Fraunces, 20px, semibold. Every h2
 * that titles a section of an admin page uses it, so sections line up from
 * page to page instead of ranging from 14px to 24px.
 */
export const sectionHeadingClass =
  "font-accent text-xl font-semibold leading-tight";

export function SectionHeading({
  className,
  ...props
}: ComponentProps<"h2">) {
  return <h2 className={cn(sectionHeadingClass, className)} {...props} />;
}
