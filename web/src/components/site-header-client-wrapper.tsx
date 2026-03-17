"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { SiteHeader } from "./site-header";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { showEnvironmentLabel, getEnvironmentLabel } from "@/lib/environment";

export function SiteHeaderClientWrapper() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;
    fetch("/api/profile/photo")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setProfilePhotoUrl(data.profilePhotoUrl);
      })
      .catch(() => {
        if (!cancelled) setProfilePhotoUrl(null);
      });
    return () => { cancelled = true; };
  }, [status]);

  // Clear profile photo when logged out (derived from status, not set in effect)
  const effectiveProfilePhotoUrl = status === "authenticated" ? profilePhotoUrl : null;

  // Hide header on admin pages (they have their own sidebar layout)
  if (pathname.startsWith("/admin")) {
    return null;
  }

  // Show skeleton header while session is loading
  if (status === "loading") {
    return <HeaderSkeleton pathname={pathname} />;
  }

  // Use profile name if available, otherwise fall back to session name/email
  const displayName =
    session?.user?.name ||
    session?.user?.email ||
    "Account";

  return (
    <SiteHeader
      session={session}
      userProfile={
        session?.user
          ? {
              id: session.user.id,
              profilePhotoUrl: effectiveProfilePhotoUrl,
              name: session.user.name,
              firstName: session.user.firstName,
              lastName: session.user.lastName,
            }
          : null
      }
      displayName={displayName}
    />
  );
}

function HeaderSkeleton({ pathname }: { pathname: string }) {
  const showDemoIndicator = showEnvironmentLabel();
  const demoLabel = getEnvironmentLabel();

  const getLinkClassName = (path: string) => {
    return cn(
      "text-white/90 hover:bg-white/10 rounded-lg px-3 py-2 font-medium border border-transparent",
      pathname === path &&
        "text-white bg-white/15 shadow-lg font-medium"
    );
  };

  return (
    <header className="border-b border-white/10 dark:border-gray-800 shadow-lg dark:shadow-xl">
      <div className="bg-[var(--ee-primary)] text-white relative">
        <nav
          aria-label="Main"
          className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4"
        >
          {/* Mobile hamburger */}
          <div className="flex lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/90 hover:text-white hover:bg-white/10 p-2 rounded-lg"
              aria-label="Toggle mobile menu"
              disabled
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-3 cursor-pointer group mr-2"
          >
            <div className="relative">
              <Image
                src="/logo.svg"
                alt="Everybody Eats"
                width={240}
                height={88}
                priority
                className="h-14 w-auto drop-shadow-sm"
              />
              {showDemoIndicator && (
                <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                  {demoLabel}
                </div>
              )}
            </div>
            <span className="sr-only">Everybody Eats logo</span>
          </Link>

          {/* Desktop nav — only show always-visible links */}
          <div className="hidden lg:flex items-center gap-2">
            <Button asChild variant="ghost" className={getLinkClassName("/shifts")}>
              <Link href="/shifts">Shifts</Link>
            </Button>
            <Button asChild variant="ghost" className={getLinkClassName("/resources")}>
              <Link href="/resources">Resources</Link>
            </Button>
          </div>

          {/* Right side — skeleton placeholders */}
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            {/* Skeleton pills matching the sign-in buttons size */}
            <div className="h-8 w-16 rounded-lg bg-white/10 animate-pulse" />
            <div className="h-8 w-20 rounded-lg bg-white/20 animate-pulse" />
          </div>
        </nav>
      </div>
    </header>
  );
}
