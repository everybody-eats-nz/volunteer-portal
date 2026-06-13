"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { cn } from "@/lib/utils";
import { Session } from "next-auth";
import { Menu, X } from "lucide-react";
import { showEnvironmentLabel, getEnvironmentLabel } from "@/lib/environment";

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

export function SiteHeader({
  session,
  userProfile,
  displayName,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const showDemoIndicator = showEnvironmentLabel();
  const demoLabel = getEnvironmentLabel();

  const isActive = (path: string) => {
    return pathname === path;
  };

  const getLinkClassName = (path: string) => {
    return cn(
      "px-4 py-2 text-sm font-medium rounded-full transition-colors text-forest-700/75 hover:text-forest-700 hover:bg-forest-700/5 dark:text-cream-50/75 dark:hover:text-cream-50 dark:hover:bg-cream-50/5",
      isActive(path) &&
        "text-forest-700 bg-forest-700/10 dark:text-cream-50 dark:bg-cream-50/10"
    );
  };

  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <header className="sticky top-0 z-40 border-b border-forest-500/10 backdrop-blur-md dark:border-cream-50/10">
      <div className="relative bg-cream-50/85 text-forest-700 dark:bg-[#0f1114]/85 dark:text-cream-50">
        <nav
          aria-label="Main"
          className="relative max-w-[88rem] mx-auto px-5 sm:px-8 lg:px-12 py-3 flex items-center gap-4"
        >
          {/* Mobile hamburger menu button */}
          <div className="flex lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="text-forest-700 hover:text-forest-700 hover:bg-forest-700/5 dark:text-cream-50 dark:hover:text-cream-50 dark:hover:bg-cream-50/5 p-2 transition-colors duration-200 rounded-full"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
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
                className="h-9 sm:h-10 w-auto transition-all duration-300 ease-out group-hover:scale-105 group-active:scale-95 dark:[filter:brightness(0)_invert(0.93)_sepia(0.08)]"
              />
              {showDemoIndicator && (
                <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                  {demoLabel}
                </div>
              )}
            </div>
            <span className="sr-only">Everybody Eats logo</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-2">
            {isAdmin ? (
              <Button
                asChild
                variant="ghost"
                className={getLinkClassName("/admin")}
              >
                <Link href="/admin" data-testid="nav-admin-dashboard">
                  Admin
                </Link>
              </Button>
            ) : null}

            {session?.user ? (
              <Button
                asChild
                variant="ghost"
                className={getLinkClassName("/dashboard")}
              >
                <Link href="/dashboard" data-testid="nav-volunteer-dashboard">
                  Dashboard
                </Link>
              </Button>
            ) : null}

            <Button
              asChild
              variant="ghost"
              className={getLinkClassName("/shifts")}
            >
              <Link href="/shifts" data-testid="nav-shifts">
                Shifts
              </Link>
            </Button>

            <Button
              asChild
              variant="ghost"
              className={getLinkClassName("/resources")}
            >
              <Link href="/resources" data-testid="nav-resources">
                Resources
              </Link>
            </Button>

            {session?.user ? (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className={getLinkClassName("/shifts/mine")}
                >
                  <Link href="/shifts/mine" data-testid="nav-my-shifts">
                    My Shifts
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className={getLinkClassName("/friends")}
                >
                  <Link href="/friends" data-testid="nav-friends">
                    Friends
                  </Link>
                </Button>
              </>
            ) : null}
          </div>

          {/* Right side header items */}
          <div className="ml-auto flex items-center gap-1">
            {/* Theme Toggle - Always visible on desktop */}
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            {session?.user ? (
              <>
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
                  <Link href="/register">Join Us</Link>
                </Button>
                <Button asChild size="sm" className="px-5">
                  <Link href="/login">Sign In</Link>
                </Button>
              </>
            )}
          </div>
        </nav>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-cream-50 dark:bg-[#101418] border-t border-forest-500/10 dark:border-cream-50/10 shadow-xl z-50">
            <nav className="px-4 py-6 space-y-4">
              {session?.user ? (
                <div className="space-y-3">
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className={cn(
                        "block px-4 py-3 rounded-xl text-forest-700/80 hover:text-forest-700 hover:bg-forest-700/5 dark:text-cream-50/80 dark:hover:text-cream-50 dark:hover:bg-cream-50/5 transition-all duration-200",
                        isActive("/admin") &&
                          "bg-forest-700/10 text-forest-700 dark:bg-cream-50/10 dark:text-cream-50 font-medium"
                      )}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Admin
                    </Link>
                  )}

                  <Link
                    href="/dashboard"
                    className={cn(
                      "block px-4 py-3 rounded-xl text-forest-700/80 hover:text-forest-700 hover:bg-forest-700/5 dark:text-cream-50/80 dark:hover:text-cream-50 dark:hover:bg-cream-50/5 transition-all duration-200",
                      isActive("/dashboard") &&
                        "bg-forest-700/10 text-forest-700 dark:bg-cream-50/10 dark:text-cream-50 font-medium"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>

                  <Link
                    href="/shifts"
                    className={cn(
                      "block px-4 py-3 rounded-xl text-forest-700/80 hover:text-forest-700 hover:bg-forest-700/5 dark:text-cream-50/80 dark:hover:text-cream-50 dark:hover:bg-cream-50/5 transition-all duration-200",
                      isActive("/shifts") &&
                        "bg-forest-700/10 text-forest-700 dark:bg-cream-50/10 dark:text-cream-50 font-medium"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Browse Shifts
                  </Link>

                  <Link
                    href="/resources"
                    className={cn(
                      "block px-4 py-3 rounded-xl text-forest-700/80 hover:text-forest-700 hover:bg-forest-700/5 dark:text-cream-50/80 dark:hover:text-cream-50 dark:hover:bg-cream-50/5 transition-all duration-200",
                      isActive("/resources") &&
                        "bg-forest-700/10 text-forest-700 dark:bg-cream-50/10 dark:text-cream-50 font-medium"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Resources
                  </Link>

                  <Link
                    href="/shifts/mine"
                    className={cn(
                      "block px-4 py-3 rounded-xl text-forest-700/80 hover:text-forest-700 hover:bg-forest-700/5 dark:text-cream-50/80 dark:hover:text-cream-50 dark:hover:bg-cream-50/5 transition-all duration-200",
                      isActive("/shifts/mine") &&
                        "bg-forest-700/10 text-forest-700 dark:bg-cream-50/10 dark:text-cream-50 font-medium"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    My Shifts
                  </Link>
                  <Link
                    href="/friends"
                    className={cn(
                      "block px-4 py-3 rounded-xl text-forest-700/80 hover:text-forest-700 hover:bg-forest-700/5 dark:text-cream-50/80 dark:hover:text-cream-50 dark:hover:bg-cream-50/5 transition-all duration-200",
                      isActive("/friends") &&
                        "bg-forest-700/10 text-forest-700 dark:bg-cream-50/10 dark:text-cream-50 font-medium"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Friends
                  </Link>

                  <div className="border-t border-forest-500/15 dark:border-cream-50/15 pt-4 mt-4">
                    <Link
                      href="/profile"
                      className="block px-4 py-3 rounded-xl text-forest-700/80 hover:text-forest-700 hover:bg-forest-700/5 dark:text-cream-50/80 dark:hover:text-cream-50 dark:hover:bg-cream-50/5 transition-all duration-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      My Profile
                    </Link>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-forest-700/60 dark:text-cream-50/60 text-sm">Theme</span>
                    <ThemeToggle />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    href="/shifts"
                    className={cn(
                      "block px-4 py-3 rounded-xl text-forest-700/80 hover:text-forest-700 hover:bg-forest-700/5 dark:text-cream-50/80 dark:hover:text-cream-50 dark:hover:bg-cream-50/5 transition-all duration-200",
                      isActive("/shifts") &&
                        "bg-forest-700/10 text-forest-700 dark:bg-cream-50/10 dark:text-cream-50 font-medium"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Browse Shifts
                  </Link>

                  <Link
                    href="/resources"
                    className={cn(
                      "block px-4 py-3 rounded-xl text-forest-700/80 hover:text-forest-700 hover:bg-forest-700/5 dark:text-cream-50/80 dark:hover:text-cream-50 dark:hover:bg-cream-50/5 transition-all duration-200",
                      isActive("/resources") &&
                        "bg-forest-700/10 text-forest-700 dark:bg-cream-50/10 dark:text-cream-50 font-medium"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Resources
                  </Link>

                  <div className="border-t border-forest-500/15 dark:border-cream-50/15 pt-4 mt-4 space-y-3">
                    <Link
                      href="/register"
                      className="block px-4 py-3 rounded-full bg-forest-500 text-cream-50 hover:bg-forest-600 transition-all duration-200 text-center font-medium"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Join Us
                    </Link>
                    <Link
                      href="/login"
                      className="block px-4 py-3 rounded-full border border-forest-500/30 text-forest-700 hover:bg-forest-700 hover:text-cream-50 dark:border-cream-50/30 dark:text-cream-50 dark:hover:bg-cream-50 dark:hover:text-forest-700 transition-all duration-200 text-center"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Login
                    </Link>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2 border-t border-forest-500/15 dark:border-cream-50/15 pt-4">
                    <span className="text-forest-700/60 dark:text-cream-50/60 text-sm">Theme</span>
                    <ThemeToggle />
                  </div>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
