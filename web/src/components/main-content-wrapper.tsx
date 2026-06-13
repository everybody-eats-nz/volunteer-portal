"use client";

import { usePathname } from "next/navigation";

interface MainContentWrapperProps {
  children: React.ReactNode;
}

export function MainContentWrapper({ children }: MainContentWrapperProps) {
  const pathname = usePathname();
  
  // Admin pages handle their own layout
  if (pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  // The landing page is full-bleed (edge-to-edge marquee and panels) and
  // brings its own containers.
  if (pathname === "/") {
    return <>{children}</>;
  }

  // Regular pages use the centered container
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {children}
    </div>
  );
}