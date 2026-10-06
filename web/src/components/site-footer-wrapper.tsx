"use client";

import { usePathname } from "next/navigation";
import { useHydrationSafeSession } from "@/hooks/use-hydration-safe-session";
import { SiteFooter } from "./site-footer";

export function SiteFooterWrapper() {
  const pathname = usePathname();
  const { data: session, status } = useHydrationSafeSession();

  // Hide footer on admin pages
  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <SiteFooter session={session} isSessionLoading={status === "loading"} />
  );
}
