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
import { isDemoEnvironment, getDemoEnvironmentLabel } from "@/lib/environment";

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
  const showDemoIndicator = isDemoEnvironment();
  const demoLabel = getDemoEnvironmentLabel();

  const isActive = (path: string) => {
    return pathname === path;
  };

  const getLinkClassName = (path: string) => {
    return cn(
      "text-white/90 hover:text-white hover:bg-white/10 dark:hover:bg-white/5 backdrop-blur-sm transition-all duration-300 ease-out hover:scale-105 active:scale-95 rounded-lg px-3 py-2 font-medium relative overflow-hidden group border border-transparent hover:border-white/20 dark:hover:border-white-700",
      isActive(path) &&
        "text-white bg-white/15 dark:bg-white/10 backdrop-blur-sm shadow-lg font-medium"
    );
  };

  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <header className="border-b border-white/10 dark:border-gray-800 shadow-lg dark:shadow-xl">
      <div className="bg-[var(--ee-primary)] text-white relative">
        <nav
          aria-label="Main"
          className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4"
        >
          {/* Mobile hamburger menu button */}
          <div className="flex lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/90 hover:text-white hover:bg-white/10 p-2 transition-colors duration-200 rounded-lg"
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
                src="/logo.svg"
                alt="Everybody Eats"
                width={240}
                height={88}
                priority
                className="h-14 w-auto transition-all duration-300 ease-out group-hover:scale-105 group-active:scale-95 drop-shadow-sm"
              />
              {showDemoIndicator && (
                <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                  {demoLabel}
                </div>
              )}
              <div className="absolute inset-0 bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl" />
            </div>
            <span className="sr-only">Everybody Eats logo</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-2">
            {session?.user ? (
              <Button
                asChild
                variant="ghost"
                className={getLinkClassName(isAdmin ? "/admin" : "/dashboard")}
              >
                <Link
                  href={isAdmin ? "/admin" : "/dashboard"}
                  data-testid={
                    isAdmin ? "nav-admin-dashboard" : "nav-volunteer-dashboard"
                  }
                >
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

            {session?.user && !isAdmin ? (
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

            {isAdmin ? (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className={getLinkClassName("/admin/shifts")}
                >
                  <Link
                    href="/admin/shifts"
                    data-testid="nav-admin-manage-shifts"
                  >
                    Manage Shifts
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className={getLinkClassName("/admin/users")}
                >
                  <Link
                    href="/admin/users"
                    data-testid="nav-admin-manage-users"
                  >
                    Manage Users
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className={getLinkClassName("/admin/migration")}
                >
                  <Link
                    href="/admin/migration"
                    data-testid="nav-admin-migration"
                  >
                    Migration
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
                <div className="hidden sm:block w-px h-6 bg-white/20" />

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
                  className="text-white/90 hover:text-white hover:bg-white/10 backdrop-blur-sm transition-colors duration-300 rounded-lg px-3 py-2 font-medium"
                >
                  <Link href="/register">Join Us</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="bg-white text-[var(--ee-primary)] hover:bg-gray-100 font-semibold shadow-sm hover:shadow-md transition-all duration-300 px-4 py-2"
                >
                  <Link href="/login">Sign In</Link>
                </Button>
              </>
            )}
          </div>
        </nav>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-[var(--ee-primary)] border-t border-white/10 shadow-xl z-50">
            <nav className="px-4 py-6 space-y-4">
              {session?.user ? (
                <div className="space-y-3">
                  <Link
                    href={isAdmin ? "/admin" : "/dashboard"}
                    className={cn(
                      "block px-4 py-3 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200",
                      isActive(isAdmin ? "/admin" : "/dashboard") &&
                        "bg-white/15 text-white font-medium"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>

                  <Link
                    href="/shifts"
                    className={cn(
                      "block px-4 py-3 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200",
                      isActive("/shifts") &&
                        "bg-white/15 text-white font-medium"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Browse Shifts
                  </Link>

                  {!isAdmin && (
                    <>
                      <Link
                        href="/shifts/mine"
                        className={cn(
                          "block px-4 py-3 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200",
                          isActive("/shifts/mine") &&
                            "bg-white/15 text-white font-medium"
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        My Shifts
                      </Link>
                      <Link
                        href="/friends"
                        className={cn(
                          "block px-4 py-3 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200",
                          isActive("/friends") &&
                            "bg-white/15 text-white font-medium"
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Friends
                      </Link>
                    </>
                  )}

                  {isAdmin && (
                    <>
                      <Link
                        href="/admin/shifts"
                        className={cn(
                          "block px-4 py-3 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200",
                          isActive("/admin/shifts") &&
                            "bg-white/15 text-white font-medium"
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Manage Shifts
                      </Link>
                      <Link
                        href="/admin/users"
                        className={cn(
                          "block px-4 py-3 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200",
                          isActive("/admin/users") &&
                            "bg-white/15 text-white font-medium"
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Manage Users
                      </Link>
                    </>
                  )}

                  <div className="border-t border-white/20 pt-4 mt-4">
                    <Link
                      href="/profile"
                      className="block px-4 py-3 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      My Profile
                    </Link>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-white/70 text-sm">Theme</span>
                    <ThemeToggle />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    href="/shifts"
                    className={cn(
                      "block px-4 py-3 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200",
                      isActive("/shifts") &&
                        "bg-white/15 text-white font-medium"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Browse Shifts
                  </Link>

                  <div className="border-t border-white/20 pt-4 mt-4 space-y-3">
                    <Link
                      href="/register"
                      className="block px-4 py-3 rounded-lg bg-white/10 text-white border border-white/30 hover:bg-white/20 transition-all duration-200 text-center font-medium"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Join Us
                    </Link>
                    <Link
                      href="/login"
                      className="block px-4 py-3 rounded-lg text-white/90 border border-white/40 hover:bg-white/10 transition-all duration-200 text-center"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Login
                    </Link>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2 border-t border-white/20 pt-4">
                    <span className="text-white/70 text-sm">Theme</span>
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
