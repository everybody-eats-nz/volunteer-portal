"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

export function LogoutClient() {
  useEffect(() => {
    // Perform logout immediately on mount
    signOut({ callbackUrl: "/login", redirect: true });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground">Signing out...</p>
      </div>
    </div>
  );
}
