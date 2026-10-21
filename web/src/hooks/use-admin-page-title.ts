"use client";

import { useEffect, ReactNode } from "react";
import { useAdminHeader } from "@/contexts/admin-header-context";
import type { AdminBreadcrumb } from "@/lib/admin-navigation";

export function useAdminPageTitle(
  title: string,
  description?: string,
  actions?: ReactNode,
  breadcrumbs?: AdminBreadcrumb[]
) {
  const { setTitle, setDescription, setActions, setBreadcrumbs } =
    useAdminHeader();

  // Breadcrumbs arrive as a fresh array on every render; key the effect on
  // their content so it doesn't re-run (and flash the header) each time.
  const breadcrumbsKey = JSON.stringify(breadcrumbs ?? null);

  useEffect(() => {
    // Immediate update on mount to prevent stale state during navigation
    setTitle(title);
    setDescription(description);
    setActions(actions);
    setBreadcrumbs(
      (JSON.parse(breadcrumbsKey) as AdminBreadcrumb[] | null) ?? undefined
    );

    // Reset to defaults when component unmounts
    return () => {
      setTitle("Admin Panel");
      setDescription(undefined);
      setActions(undefined);
      setBreadcrumbs(undefined);
    };
  }, [
    title,
    description,
    actions,
    breadcrumbsKey,
    setTitle,
    setDescription,
    setActions,
    setBreadcrumbs,
  ]);
}
