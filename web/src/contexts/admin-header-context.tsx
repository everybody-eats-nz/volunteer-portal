"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface AdminHeaderContextType {
  title: string;
  description?: string;
  actions?: ReactNode;
  setTitle: (title: string) => void;
  setDescription: (description?: string) => void;
  setActions: (actions?: ReactNode) => void;
}

const AdminHeaderContext = createContext<AdminHeaderContextType | undefined>(
  undefined
);

export function AdminHeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("Admin Panel");
  const [description, setDescription] = useState<string | undefined>(undefined);
  const [actions, setActions] = useState<ReactNode | undefined>(undefined);

  return (
    <AdminHeaderContext.Provider value={{ title, description, actions, setTitle, setDescription, setActions }}>
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