"use client";

import { useEffect, ReactNode } from "react";
import { useAdminHeader } from "@/contexts/admin-header-context";

export function useAdminPageTitle(title: string, description?: string, actions?: ReactNode) {
  const { setTitle, setDescription, setActions } = useAdminHeader();

  useEffect(() => {
    // Immediate update on mount to prevent stale state during navigation
    setTitle(title);
    setDescription(description);
    setActions(actions);
    
    // Reset to defaults when component unmounts
    return () => {
      setTitle("Admin Panel");
      setDescription(undefined);
      setActions(undefined);
    };
  }, [title, description, actions, setTitle, setDescription, setActions]);
}