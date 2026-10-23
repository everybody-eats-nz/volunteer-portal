"use client";

import { usePathname } from "next/navigation";
import { useHydrationSafeSession } from "@/hooks/use-hydration-safe-session";
import { SiteFooter } from "./site-footer";
import { isEmbedPath } from "@/lib/embed-paths";

export function SiteFooterWrapper() {
  const pathname = usePathname();
  const { data: session, status } = useHydrationSafeSession();

  // Hide footer on admin pages and on pages embedded in the mobile app
  if (pathname.startsWith("/admin") || isEmbedPath(pathname)) {
    return null;
  }

  return (
    <SiteFooter session={session} isSessionLoading={status === "loading"} />
  );
}
