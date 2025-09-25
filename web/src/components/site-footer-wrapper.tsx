"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "./site-footer";
import { Session } from "next-auth";

interface SiteFooterWrapperProps {
  session: Session | null;
}

export function SiteFooterWrapper({ session }: SiteFooterWrapperProps) {
  const pathname = usePathname();
  
  // Hide footer on admin pages
  if (pathname.startsWith("/admin")) {
    return null;
  }
  
  return <SiteFooter session={session} />;
}