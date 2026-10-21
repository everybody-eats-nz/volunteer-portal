"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import type { AdminBreadcrumb } from "@/lib/admin-navigation";

interface AdminHeaderContextType {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: AdminBreadcrumb[];
  setTitle: (title: string) => void;
  setDescription: (description?: string) => void;
  setActions: (actions?: ReactNode) => void;
  setBreadcrumbs: (breadcrumbs?: AdminBreadcrumb[]) => void;
}

const AdminHeaderContext = createContext<AdminHeaderContextType | undefined>(
  undefined
);

export function AdminHeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("Admin Panel");
  const [description, setDescription] = useState<string | undefined>(undefined);
  const [actions, setActions] = useState<ReactNode | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbs] = useState<
    AdminBreadcrumb[] | undefined
  >(undefined);

  return (
    <AdminHeaderContext.Provider
      value={{
        title,
        description,
        actions,
        breadcrumbs,
        setTitle,
        setDescription,
        setActions,
        setBreadcrumbs,
      }}
    >
      {children}
    </AdminHeaderContext.Provider>
  );
}

export function useAdminHeader() {
  const context = useContext(AdminHeaderContext);
  if (context === undefined) {
    throw new Error("useAdminHeader must be used within an AdminHeaderProvider");
  }
  return context;
}
