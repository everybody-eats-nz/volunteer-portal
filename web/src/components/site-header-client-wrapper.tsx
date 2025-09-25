"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "./site-header";
import { Session } from "next-auth";

interface SiteHeaderClientWrapperProps {
  session: Session | null;
  userProfile: {
    id: string;
    profilePhotoUrl?: string | null;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
}

export function SiteHeaderClientWrapper({
  session,
  userProfile,
}: SiteHeaderClientWrapperProps) {
  const pathname = usePathname();

  // Hide header on admin pages (they have their own sidebar layout)
  if (pathname.startsWith("/admin")) {
    return null;
  }

  // Use profile name if available, otherwise fall back to session name/email
  const displayName =
    userProfile?.name ||
    session?.user?.name ||
    session?.user?.email ||
    "Account";

  return (
    <SiteHeader
      session={session}
      userProfile={userProfile}
      displayName={displayName}
    />
  );
}
