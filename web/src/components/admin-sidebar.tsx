"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  useSidebar,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { AdminMessagesBell } from "@/components/admin-messages-bell";
import {
  adminNavCategories,
  findActiveNavItem,
  publicNavItems,
} from "@/lib/admin-navigation";
import { STATUS_SOLID } from "@/lib/status-styles";
import { cn } from "@/lib/utils";
import { Session } from "next-auth";
import { showEnvironmentLabel, getEnvironmentLabel } from "@/lib/environment";

interface AdminSidebarProps {
  session: Session | null;
  userProfile: {
    id: string;
    profilePhotoUrl?: string | null;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  displayName: string;
  pendingParentalConsentCount: number;
  pendingReportCount?: number;
  unreadMessagesCount?: number;
  hiddenNavItems?: string[];
}

const DETAIL_ROUTE_PARENTS: [prefix: string, parent: string][] = [
  ["/admin/volunteers/", "/admin/users"],
  ["/admin/auto-accept-rules", "/admin/auto-approval"],
];

/** Brand active state: forest tint, bold label and a left rule. */
// The tint is a step deeper than the sidebar's hover tint so the current page
// still out-ranks whatever row the pointer is on.
const ACTIVE_ITEM_CLASSES =
  "relative data-[active=true]:bg-forest-100 data-[active=true]:font-semibold data-[active=true]:text-forest-600 data-[active=true]:hover:bg-forest-100 data-[active=true]:hover:text-forest-600 dark:data-[active=true]:bg-forest-500/60 dark:data-[active=true]:text-primary-text dark:data-[active=true]:hover:bg-forest-500/60 dark:data-[active=true]:hover:text-primary-text data-[active=true]:before:absolute data-[active=true]:before:inset-y-1.5 data-[active=true]:before:left-0 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-full data-[active=true]:before:bg-forest-500 dark:data-[active=true]:before:bg-primary-text";

/** Count badges keep white text even when their row is hovered or active. */
const COUNT_BADGE_CLASSES =
  "peer-hover/menu-button:text-white peer-data-[active=true]/menu-button:text-white";

export function AdminSidebar({
  session,
  userProfile,
  displayName,
  pendingParentalConsentCount,
  pendingReportCount = 0,
  unreadMessagesCount = 0,
  hiddenNavItems = [],
}: AdminSidebarProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const showDemoIndicator = showEnvironmentLabel();
  const demoLabel = getEnvironmentLabel();

  // Detail routes with no nav item of their own light up the list they belong to.
  const activeHref = findActiveNavItem(
    pathname,
    DETAIL_ROUTE_PARENTS.find(([prefix]) => pathname.startsWith(prefix))?.[1]
  )?.href;

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar variant="inset" data-testid="admin-sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between gap-3 px-2">
          <Link href="/admin" className="flex items-center gap-2 group">
            <Image
              src="/logo.svg"
              alt="Everybody Eats"
              width={120}
              height={44}
              priority
              className="h-8 w-auto transition-all duration-300 group-hover:scale-105 filter invert dark:invert-0"
            />
            {showDemoIndicator && (
              <span className="rounded-full bg-amber-700 px-1.5 py-0.5 text-xs font-bold leading-none text-white">
                {demoLabel}
              </span>
            )}
          </Link>

          <div className="flex items-center gap-0.5">
            <AdminMessagesBell
              subscribe
              className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            />

            {userProfile?.id && (
              <div className="[&_button]:text-sidebar-foreground [&_button]:hover:bg-sidebar-accent [&_button]:hover:text-sidebar-accent-foreground [&_[data-testid=notification-dropdown]]:left-0 [&_[data-testid=notification-dropdown]]:sm:left-0 [&_[data-testid=notification-dropdown]]:transform [&_[data-testid=notification-dropdown]]:sm:translate-x-0">
                <NotificationBell userId={userProfile.id} />
              </div>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {adminNavCategories.map((category) => {
          const visibleItems = category.items.filter(
            (item) => !hiddenNavItems.includes(item.href),
          );
          if (visibleItems.length === 0) return null;
          return (
          <SidebarGroup key={category.label}>
            <SidebarGroupLabel>{category.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map((item) => {
                  // Map test IDs to match existing tests
                  const testIdMap: Record<string, string> = {
                    "/admin/shifts": "manage-shifts-button",
                    "/admin/users": "manage-users-button",
                    "/admin/parental-consent": "sidebar-parental-consent",
                  };

                  const testId =
                    testIdMap[item.href] ||
                    `sidebar-${
                      item.href.replace("/admin", "").replace("/", "") ||
                      "dashboard"
                    }`;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={item.href === activeHref}
                        className={ACTIVE_ITEM_CLASSES}
                        data-testid={testId}
                      >
                        <Link
                          href={item.href}
                          onClick={handleLinkClick}
                          aria-current={
                            item.href === activeHref ? "page" : undefined
                          }
                        >
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.href === "/admin/parental-consent" &&
                        pendingParentalConsentCount > 0 && (
                          <SidebarMenuBadge
                            className={cn(STATUS_SOLID.pending, COUNT_BADGE_CLASSES)}
                            data-testid="parental-consent-badge"
                          >
                            {pendingParentalConsentCount}
                          </SidebarMenuBadge>
                        )}
                      {item.href === "/admin/moderation" &&
                        pendingReportCount > 0 && (
                          <SidebarMenuBadge
                            className={cn(STATUS_SOLID.danger, COUNT_BADGE_CLASSES)}
                            data-testid="moderation-badge"
                          >
                            {pendingReportCount}
                          </SidebarMenuBadge>
                        )}
                      {item.href === "/admin/messages" &&
                        unreadMessagesCount > 0 && (
                          <SidebarMenuBadge
                            className={cn(STATUS_SOLID.confirmed, COUNT_BADGE_CLASSES)}
                            data-testid="messages-badge"
                          >
                            {unreadMessagesCount}
                          </SidebarMenuBadge>
                        )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          );
        })}

        <SidebarGroup>
          <SidebarGroupLabel>Public</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {publicNavItems.map((item) => {
                // Map test IDs for public nav items
                const publicTestIdMap: Record<string, string> = {
                  "/shifts": "view-public-shifts-button",
                  "/resources": "view-public-resources-button",
                };

                const testId =
                  publicTestIdMap[item.href] ||
                  `sidebar-${item.href.replace("/", "") || "public"}`;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild data-testid={testId}>
                      <Link
                        href={item.href}
                        onClick={handleLinkClick}
                        target={item.opensInNewTab ? "_blank" : undefined}
                        rel={
                          item.opensInNewTab ? "noopener noreferrer" : undefined
                        }
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                        {item.opensInNewTab && (
                          <ExternalLink className="w-3 h-3 ml-auto opacity-60" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center pt-2">
          <div className="[&_button]:text-sidebar-foreground [&_button]:hover:bg-sidebar-accent/50 [&_button]:hover:text-sidebar-foreground [&_[data-state=open]]:bg-sidebar-accent/50 [&_[data-state=open]]:text-sidebar-foreground">
            <UserMenu
              userName={displayName}
              userEmail={session?.user?.email ?? undefined}
              profilePhotoUrl={userProfile?.profilePhotoUrl}
            />
          </div>

          <div className="ml-auto [&_button]:text-sidebar-foreground [&_button]:hover:bg-sidebar-accent [&_button]:hover:text-sidebar-accent-foreground">
            <ThemeToggle />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
