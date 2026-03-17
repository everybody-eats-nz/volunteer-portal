"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { SiteFooter } from "./site-footer";

export function SiteFooterWrapper() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Hide footer on admin pages
  if (pathname.startsWith("/admin")) {
    return null;
  }

  return <SiteFooter session={session} />;
}
