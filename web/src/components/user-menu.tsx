"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  ThemedDropdownMenu,
  ThemedDropdownMenuContent,
  ThemedDropdownMenuItem,
  ThemedDropdownMenuLabel,
  ThemedDropdownMenuSeparator,
  ThemedDropdownMenuTrigger,
  ThemedDropdownMenuIcon,
  ThemedDropdownMenuText,
} from "@/components/ui/themed-dropdown-menu";

type UserMenuProps = {
  userName: string;
  userEmail?: string;
  profilePhotoUrl?: string | null;
};

export function UserMenu({
  userName,
  userEmail,
  profilePhotoUrl,
}: UserMenuProps) {
  const initials = userName
    .split(" ")
    .map((name) => name.charAt(0))
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <ThemedDropdownMenu>
      <ThemedDropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative text-white/90 hover:text-white hover:bg-white/10 transition-colors duration-200 rounded-lg px-2 py-1"
        >
          <div data-testid="user-menu" className="flex items-center gap-2">
            <Avatar className="w-7 h-7 border border-white/20">
              {profilePhotoUrl ? (
                <AvatarImage
                  src={profilePhotoUrl}
                  alt="Profile"
                  className="object-cover"
                  onError={(e) => {
                    console.error('Avatar image failed to load:', profilePhotoUrl);
                    // Hide the image on error so fallback shows
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <AvatarFallback className="text-sm font-semibold bg-white/20 text-white backdrop-blur-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:block text-sm font-medium">
              {userName}
            </span>
            <svg
              className="w-4 h-4 opacity-60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </Button>
      </ThemedDropdownMenuTrigger>
      <ThemedDropdownMenuContent align="end" sideOffset={8} className="w-64 p-2">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
          <Avatar className="w-10 h-10 border-2 border-primary/20">
            <AvatarImage
              src={profilePhotoUrl || undefined}
              alt="Profile"
              className="object-cover"
            />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary-700 text-white font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <ThemedDropdownMenuLabel className="p-0 font-semibold text-foreground">
              {userName}
            </ThemedDropdownMenuLabel>
            {userEmail && (
              <p className="text-xs text-muted-foreground truncate">
                {userEmail}
              </p>
            )}
          </div>
        </div>

        <ThemedDropdownMenuSeparator className="my-2" />

        <ThemedDropdownMenuItem asChild>
          <Link href="/dashboard">
            <ThemedDropdownMenuIcon>
              <svg
                className="w-4 h-4 text-primary dark:text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </ThemedDropdownMenuIcon>
            <ThemedDropdownMenuText
              title="Dashboard"
              subtitle="Your volunteer overview"
            />
          </Link>
        </ThemedDropdownMenuItem>

        <ThemedDropdownMenuItem asChild>
          <Link href="/profile">
            <ThemedDropdownMenuIcon>
              <svg
                className="w-4 h-4 text-primary dark:text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </ThemedDropdownMenuIcon>
            <ThemedDropdownMenuText
              title="Profile"
              subtitle="Manage your account"
            />
          </Link>
        </ThemedDropdownMenuItem>

        <ThemedDropdownMenuItem asChild>
          <Link href="/shifts/mine">
            <ThemedDropdownMenuIcon>
              <svg
                className="w-4 h-4 text-primary dark:text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </ThemedDropdownMenuIcon>
            <ThemedDropdownMenuText
              title="My Shifts"
              subtitle="View your schedule"
            />
          </Link>
        </ThemedDropdownMenuItem>

        <ThemedDropdownMenuSeparator className="my-2" />

        <ThemedDropdownMenuItem
          data-testid="sign-out-button"
          onClick={() => signOut({ callbackUrl: "/" })}
          variant="destructive"
        >
          <ThemedDropdownMenuIcon variant="destructive">
            <svg
              className="w-4 h-4 text-red-700 dark:text-red-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </ThemedDropdownMenuIcon>
          <ThemedDropdownMenuText
            title="Sign out"
            subtitle="Sign out of your account"
          />
        </ThemedDropdownMenuItem>
      </ThemedDropdownMenuContent>
    </ThemedDropdownMenu>
  );
}
