"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { AdminMessagesBell } from "@/components/admin-messages-bell";
import { cn } from "@/lib/utils";
import { Session } from "next-auth";
import { Menu, X } from "lucide-react";
import { showEnvironmentLabel, getEnvironmentLabel } from "@/lib/environment";
import { SITE_CONTAINER } from "@/lib/site-container";

interface SiteHeaderProps {
  session: Session | null;
  userProfile: {
    id: string;
    profilePhotoUrl?: string | null;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  displayName: string;
}

interface NavLink {
  href: string;
  /** Desktop label */
  label: string;
  /** Mobile menu label, when it differs */
  mobileLabel?: string;
  testId?: string;
  show: "always" | "signed-in" | "admin";
}

const NAV_LINKS: NavLink[] = [
  { href: "/admin", label: "Admin", testId: "nav-admin-dashboard", show: "admin" },
  { href: "/dashboard", label: "Dashboard", testId: "nav-volunteer-dashboard", show: "signed-in" },
  { href: "/shifts", label: "Shifts", mobileLabel: "Browse shifts", testId: "nav-shifts", show: "always" },
  { href: "/resources", label: "Resources", testId: "nav-resources", show: "always" },
  { href: "/shifts/mine", label: "My Shifts", testId: "nav-my-shifts", show: "signed-in" },
  { href: "/friends", label: "Friends", testId: "nav-friends", show: "signed-in" },
];

const MOBILE_MENU_ID = "mobile-menu";

const mobileLinkClassName =
  "block rounded-xl px-4 py-3 text-forest-700/80 transition-colors duration-200 hover:bg-forest-700/5 hover:text-forest-700 dark:text-cream-50/80 dark:hover:bg-cream-50/5 dark:hover:text-cream-50";
const mobileActiveClassName =
  "bg-forest-700/10 font-medium text-forest-700 dark:bg-cream-50/10 dark:text-cream-50";

export function SiteHeader({
  session,
  userProfile,
  displayName,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const showDemoIndicator = showEnvironmentLabel();
  const demoLabel = getEnvironmentLabel();

  const isAdmin = session?.user?.role === "ADMIN";
  const isSignedIn = !!session?.user;
  const links = NAV_LINKS.filter(
    (link) =>
      link.show === "always" ||
      (link.show === "signed-in" && isSignedIn) ||
      (link.show === "admin" && isAdmin)
  );

  const isActive = (path: string) => pathname === path;
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  // Escape closes the menu and returns focus to the button that opened it.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMobileMenuOpen]);

  const getLinkClassName = (path: string) => {
    return cn(
      "px-4 py-2 text-sm font-medium rounded-full transition-colors text-forest-700/75 hover:text-forest-700 hover:bg-forest-700/5 dark:text-cream-50/75 dark:hover:text-cream-50 dark:hover:bg-cream-50/5",
      isActive(path) &&
        "text-forest-700 bg-forest-700/10 dark:text-cream-50 dark:bg-cream-50/10"
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-forest-500/10 backdrop-blur-md dark:border-cream-50/10">
      <div className="relative bg-cream-50/85 text-forest-700 dark:bg-[#0f1114]/85 dark:text-cream-50">
        <nav
          aria-label="Main"
          className={cn(SITE_CONTAINER, "relative flex items-center gap-4 py-3")}
        >
          {/* Mobile hamburger menu button */}
          <div className="flex lg:hidden">
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="icon"
              className="size-11 rounded-full text-forest-700 transition-colors duration-200 hover:bg-forest-700/5 hover:text-forest-700 dark:text-cream-50 dark:hover:bg-cream-50/5 dark:hover:text-cream-50"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls={MOBILE_MENU_ID}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
            </Button>
          </div>

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
                className="h-9 sm:h-10 w-auto transition-all duration-300 ease-out motion-safe:group-hover:scale-105 motion-safe:group-active:scale-95 dark:[filter:brightness(0)_invert(0.93)_sepia(0.08)]"
              />
              {showDemoIndicator && (
                <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                  {demoLabel}
                </div>
              )}
            </div>
            <span className="sr-only">Home</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-2">
            {links.map((link) => (
              <Button
                key={link.href}
                asChild
                variant="ghost"
                className={getLinkClassName(link.href)}
              >
                <Link
                  href={link.href}
                  data-testid={link.testId}
                  aria-current={isActive(link.href) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              </Button>
            ))}
          </div>

          {/* Right side header items */}
          <div className="ml-auto flex items-center gap-1">
            {/* Theme Toggle - Always visible on desktop */}
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            {session?.user ? (
              <>
                {/* Volunteer messages - admins only, kept separate from the
                    notification feed so a message needing a reply cannot get
                    buried under platform notifications */}
                {isAdmin && (
                  <AdminMessagesBell className="text-forest-700/80 hover:text-forest-700 hover:bg-forest-700/5 dark:text-cream-50/80 dark:hover:text-cream-50 dark:hover:bg-cream-50/5 transition-colors duration-200" />
                )}

                {/* Notification Bell - Only for logged in users */}
                {userProfile?.id && (
                  <NotificationBell userId={userProfile.id} />
                )}

                {/* Divider between notifications and user menu */}
                <div className="hidden sm:block w-px h-6 bg-forest-500/15 dark:bg-cream-50/15" />

                {/* User Menu */}
                <UserMenu
                  userName={displayName}
                  userEmail={session.user?.email ?? undefined}
                  profilePhotoUrl={userProfile?.profilePhotoUrl}
                />
              </>
            ) : (
              <>
                {/* Auth Buttons for logged out users */}
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-forest-700/75 hover:text-forest-700 hover:bg-forest-700/5 dark:text-cream-50/75 dark:hover:text-cream-50 dark:hover:bg-cream-50/5 transition-colors duration-300 rounded-full px-4 py-2 font-medium"
                >
                  <Link href="/register">Join us</Link>
                </Button>
                <Button asChild size="sm" className="px-5">
                  <Link href="/login">Sign in</Link>
                </Button>
              </>
            )}
          </div>
        </nav>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div
            id={MOBILE_MENU_ID}
            className="lg:hidden absolute top-full left-0 right-0 bg-cream-50 dark:bg-[#101418] border-t border-forest-500/10 dark:border-cream-50/10 shadow-xl z-50"
          >
            <nav aria-label="Menu" className="px-4 py-6 space-y-4">
              <div className="space-y-3">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      mobileLinkClassName,
                      isActive(link.href) && mobileActiveClassName
                    )}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    onClick={closeMobileMenu}
                  >
                    {link.mobileLabel ?? link.label}
                  </Link>
                ))}

                {isSignedIn ? (
                  <div className="border-t border-forest-500/15 dark:border-cream-50/15 pt-4 mt-4">
                    <Link
                      href="/profile"
                      className={cn(
                        mobileLinkClassName,
                        isActive("/profile") && mobileActiveClassName
                      )}
                      aria-current={isActive("/profile") ? "page" : undefined}
                      onClick={closeMobileMenu}
                    >
                      My Profile
                    </Link>
                  </div>
                ) : (
                  <div className="border-t border-forest-500/15 dark:border-cream-50/15 pt-4 mt-4 space-y-3">
                    <Link
                      href="/register"
                      className="block px-4 py-3 rounded-full bg-forest-500 text-cream-50 hover:bg-forest-600 transition-all duration-200 text-center font-medium"
                      onClick={closeMobileMenu}
                    >
                      Join us
                    </Link>
                    <Link
                      href="/login"
                      className="block px-4 py-3 rounded-full border border-forest-500/30 text-forest-700 hover:bg-forest-700 hover:text-cream-50 dark:border-cream-50/30 dark:text-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700 transition-all duration-200 text-center"
                      onClick={closeMobileMenu}
                    >
                      Sign in
                    </Link>
                  </div>
                )}

                <div
                  className={cn(
                    "flex items-center justify-between px-4 py-2",
                    !isSignedIn &&
                      "border-t border-forest-500/15 dark:border-cream-50/15 pt-4"
                  )}
                >
                  <span className="text-forest-700/75 dark:text-cream-50/70 text-sm">
                    Theme
                  </span>
                  <ThemeToggle />
                </div>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
