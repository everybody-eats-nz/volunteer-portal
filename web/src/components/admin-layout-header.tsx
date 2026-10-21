"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAdminHeader } from "@/contexts/admin-header-context";
import { AdminCommandPalette } from "@/components/admin-command-palette";

export function AdminLayoutHeader() {
  const { title, description, actions, breadcrumbs } = useAdminHeader();

  return (
    <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2 bg-background rounded-t-xl">
      <SidebarTrigger data-testid="admin-sidebar-toggle" />
      <div className="h-4 w-px bg-border mx-2" />
      {/* basis-48: once actions no longer fit beside the title, they wrap to their own row */}
      <div className="min-w-0 flex-1 basis-48">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" data-testid="admin-breadcrumbs">
            <ol className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              {breadcrumbs.map((crumb, i) => {
                const isNearest = i === breadcrumbs.length - 1;
                return (
                  <li
                    key={crumb.href}
                    // Small screens show only the nearest parent, as a back link.
                    className={
                      isNearest
                        ? "flex min-w-0 items-center gap-1"
                        : "hidden items-center gap-1 sm:flex"
                    }
                  >
                    <Link
                      href={crumb.href}
                      className="inline-flex min-h-6 min-w-0 items-center gap-0.5 rounded-sm font-medium text-muted-foreground underline-offset-2 hover:text-primary-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {isNearest && (
                        <ChevronLeft
                          className="h-3.5 w-3.5 shrink-0 sm:hidden"
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate">{crumb.label}</span>
                    </Link>
                    <ChevronRight
                      className="hidden h-3.5 w-3.5 shrink-0 sm:block"
                      aria-hidden="true"
                    />
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        <h1 data-testid="admin-page-header" className="text-lg font-semibold">
          {title}
        </h1>
        {description && (
          <p className="hidden md:block text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <AdminCommandPalette>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 text-muted-foreground"
            data-testid="admin-command-palette-trigger"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden lg:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
        </AdminCommandPalette>
        {actions && <>{actions}</>}
      </div>
    </header>
  );
}
