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
      "px-4 py-2 text-sm font-medium rounded-full text-forest-700/75 hover:bg-forest-700/5 dark:text-cream-50/75 dark:hover:bg-cream-50/5",
      pathname === path &&
        "text-forest-700 bg-forest-700/10 dark:text-cream-50 dark:bg-cream-50/10"
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-forest-500/10 backdrop-blur-md dark:border-cream-50/10">
      <div className="relative bg-cream-50/85 text-forest-700 dark:bg-[#0f1114]/85 dark:text-cream-50">
        <nav
          aria-label="Main"
          className="relative max-w-[88rem] mx-auto px-5 sm:px-8 lg:px-12 py-3 flex items-center gap-4"
        >
          {/* Mobile hamburger */}
          <div className="flex lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="text-forest-700 hover:bg-forest-700/5 dark:text-cream-50 dark:hover:bg-cream-50/5 p-2 rounded-full"
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
                src="/everybody-eats-logo.svg"
                alt="Everybody Eats"
                width={179}
                height={65}
                priority
                className="h-9 sm:h-10 w-auto dark:[filter:brightness(0)_invert(0.93)_sepia(0.08)]"
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
            <div className="h-8 w-16 rounded-full bg-forest-700/5 dark:bg-cream-50/10 animate-pulse" />
            <div className="h-8 w-20 rounded-full bg-forest-700/10 dark:bg-cream-50/20 animate-pulse" />
          </div>
        </nav>
      </div>
    </header>
  );
}
