"use client";

import { ReactNode } from "react";
import { useAdminPageTitle } from "@/hooks/use-admin-page-title";

interface AdminPageWrapperProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AdminPageWrapper({ title, description, actions, children }: AdminPageWrapperProps) {
  useAdminPageTitle(title, description, actions);
  return <>{children}</>;
}