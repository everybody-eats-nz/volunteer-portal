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
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { adminNavCategories, publicNavItems } from "@/lib/admin-navigation";
import { Session } from "next-auth";

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
}


export function AdminSidebar({
  session,
  userProfile,
  displayName,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact = false) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <Sidebar variant="inset" data-testid="admin-sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between gap-3 px-2">
          <Link href="/" className="flex items-center gap-2 group">
            <Image
              src="/logo.svg"
              alt="Everybody Eats"
              width={120}
              height={44}
              priority
              className="h-8 w-auto transition-all duration-300 group-hover:scale-105 filter invert dark:invert-0"
            />
          </Link>

          {userProfile?.id && (
            <div className="[&_button]:text-sidebar-foreground [&_button]:hover:bg-sidebar-accent [&_button]:hover:text-sidebar-accent-foreground [&_[data-testid=notification-dropdown]]:left-0 [&_[data-testid=notification-dropdown]]:sm:left-0 [&_[data-testid=notification-dropdown]]:transform [&_[data-testid=notification-dropdown]]:sm:translate-x-0">
              <NotificationBell userId={userProfile.id} />
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {adminNavCategories.map((category) => (
          <SidebarGroup key={category.label}>
            <SidebarGroupLabel>{category.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {category.items.map((item) => {
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
                        isActive={isActive(item.href, true)}
                        data-testid={testId}
                      >
                        <Link href={item.href}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup>
          <SidebarGroupLabel>Public</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {publicNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    data-testid="view-public-shifts-button"
                  >
                    <Link
                      href={item.href}
                      target={item.opensInNewTab ? "_blank" : undefined}
                      rel={item.opensInNewTab ? "noopener noreferrer" : undefined}
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                      {item.opensInNewTab && (
                        <ExternalLink className="w-3 h-3 ml-auto opacity-60" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
