"use client";

import { ReactNode } from "react";
import { useAdminPageTitle } from "@/hooks/use-admin-page-title";
import type { AdminBreadcrumb } from "@/lib/admin-navigation";

interface AdminPageWrapperProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /**
   * The pages above this one, outermost first (the current page is the
   * title). Detail pages pass at least their parent list so the header shows
   * a back link; on small screens only the nearest parent is shown.
   */
  breadcrumbs?: AdminBreadcrumb[];
  /** Shorthand for a single parent breadcrumb. */
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}

export function AdminPageWrapper({
  title,
  description,
  actions,
  breadcrumbs,
  backHref,
  backLabel,
  children,
}: AdminPageWrapperProps) {
  const crumbs =
    breadcrumbs ??
    (backHref ? [{ href: backHref, label: backLabel ?? "Back" }] : undefined);
  useAdminPageTitle(title, description, actions, crumbs);
  return <>{children}</>;
}
