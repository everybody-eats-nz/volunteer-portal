"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AvatarUser {
  id: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  profilePhotoUrl?: string | null;
}

interface AvatarListProps {
  users: AvatarUser[];
  size?: "sm" | "md" | "lg";
  className?: string;
  maxDisplay?: number;
  enableLinks?: boolean;
}

export function AvatarList({
  users,
  size = "md",
  className,
  maxDisplay = 5,
  enableLinks = true,
}: AvatarListProps) {
  const sizeClasses = {
    sm: "size-8",
    md: "size-10",
    lg: "size-12",
  };

  const marginClasses = {
    sm: "-ml-2",
    md: "-ml-3",
    lg: "-ml-4",
  };

  const displayUsers = users.slice(0, maxDisplay);
  const remainingCount = users.length - maxDisplay;

  const getDisplayName = (user: AvatarUser) => {
    return (
      user.name ||
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      user.email
    );
  };

  const getInitials = (user: AvatarUser) => {
    return (
      user.firstName?.[0] ||
      user.name?.[0] ||
      user.email[0]
    ).toUpperCase();
  };

  const getTooltipText = (user: AvatarUser) => {
    return getDisplayName(user);
  };


  return (
    <div className={cn("flex items-center", className)}>
      <TooltipProvider>
        {displayUsers.map((user, index) => (
          <Tooltip key={user.id}>
            <TooltipTrigger asChild>
              {enableLinks ? (
                <Link href={`/friends/${user.id}`} className="cursor-pointer">
                  <div
                    className={cn(
                      "group relative z-0 flex scale-100 items-center transition-all duration-200 ease-in-out hover:z-10 hover:scale-110",
                      index > 0 && marginClasses[size]
                    )}
                    style={{ zIndex: users.length - index }}
                  >
                    <div className="relative overflow-hidden rounded-full bg-white dark:bg-gray-800 ring-2 ring-white dark:ring-gray-800">
                      <div className="bg-size pointer-events-none absolute h-full w-full animate-bg-position from-violet-500 from-30% via-cyan-400 via-50% to-pink-500 to-80% bg-[length:300%_auto] opacity-0 transition-opacity duration-200 group-hover:opacity-15 group-hover:bg-gradient-to-r" />
                      <Avatar className={cn(sizeClasses[size])}>
                        <AvatarImage
                          src={user.profilePhotoUrl || undefined}
                          alt={getDisplayName(user)}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                          {getInitials(user)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                </Link>
              ) : (
                <div
                  className={cn(
                    "group relative z-0 flex scale-100 items-center transition-all duration-200 ease-in-out hover:z-10 hover:scale-110",
                    index > 0 && marginClasses[size]
                  )}
                  style={{ zIndex: users.length - index }}
                >
                  <div className="relative overflow-hidden rounded-full bg-white dark:bg-gray-800 ring-2 ring-white dark:ring-gray-800">
                    <div className="bg-size pointer-events-none absolute h-full w-full animate-bg-position from-violet-500 from-30% via-cyan-400 via-50% to-pink-500 to-80% bg-[length:300%_auto] opacity-0 transition-opacity duration-200 group-hover:opacity-15 group-hover:bg-gradient-to-r" />
                    <Avatar className={cn(sizeClasses[size])}>
                      <AvatarImage
                        src={user.profilePhotoUrl || undefined}
                        alt={getDisplayName(user)}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {getInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
              )}
            </TooltipTrigger>
            <TooltipContent>
              <p>{getTooltipText(user)}</p>
            </TooltipContent>
          </Tooltip>
        ))}

        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "group relative z-0 flex scale-100 items-center transition-all duration-200 ease-in-out hover:z-10 hover:scale-110",
                  marginClasses[size]
                )}
                style={{ zIndex: 0 }}
              >
                <div className="relative overflow-hidden rounded-full bg-white dark:bg-gray-800 ring-2 ring-white dark:ring-gray-800">
                  <div className="bg-size pointer-events-none absolute h-full w-full animate-bg-position from-violet-500 from-30% via-cyan-400 via-50% to-pink-500 to-80% bg-[length:300%_auto] opacity-0 transition-opacity duration-200 group-hover:opacity-15 group-hover:bg-gradient-to-r" />
                  <div
                    className={cn(
                      "flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium cursor-pointer",
                      sizeClasses[size],
                      "rounded-full"
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        size === "sm" && "text-[10px]",
                        size === "lg" && "text-sm"
                      )}
                    >
                      +{remainingCount}
                    </span>
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {remainingCount} more volunteer{remainingCount !== 1 ? "s" : ""}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>
    </div>
  );
}
