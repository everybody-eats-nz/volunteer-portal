"use client";

import { Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAdminHeader } from "@/contexts/admin-header-context";
import { AdminCommandPalette } from "@/components/admin-command-palette";

export function AdminLayoutHeader() {
  const { title, description, actions } = useAdminHeader();

  return (
    <header className="flex min-h-16 shrink-0 items-center gap-2 border-b px-4 bg-background rounded-t-xl">
      <SidebarTrigger data-testid="admin-sidebar-toggle" />
      <div className="h-4 w-px bg-border mx-2" />
      <div className="flex-1">
        <h1 data-testid="admin-page-header" className="text-lg font-semibold">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <AdminCommandPalette>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 text-muted-foreground"
            data-testid="admin-command-palette-trigger"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden lg:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
        </AdminCommandPalette>
        {actions && <>{actions}</>}
      </div>
    </header>
  );
}
