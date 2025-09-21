"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Mail, CheckCircle, Database } from "lucide-react";
import { MigrationStatus } from "./migration-status";
import { UserInvitations } from "./user-invitations";
import { MigratedUsers } from "./migrated-users";
import { NovaBulkMigration } from "./nova-bulk-migration";

export function MigrationTabs() {
  const [activeTab, setActiveTab] = useState("migration");

  // Handle hash-based navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (
        hash &&
        ["migration", "status", "invitations", "users"].includes(hash)
      ) {
        setActiveTab(hash);
      }
    };

    // Set initial tab from hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Update hash without reloading page
    window.history.replaceState(null, "", `#${value}`);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList
        className="grid w-full grid-cols-4"
        data-testid="migration-tabs"
      >
        <TabsTrigger
          value="migration"
          className="flex items-center gap-2"
          data-testid="tab-migration"
        >
          <Database className="h-4 w-4" />
          Migration
        </TabsTrigger>
        <TabsTrigger
          value="status"
          className="flex items-center gap-2"
          data-testid="tab-migration-status"
        >
          <CheckCircle className="h-4 w-4" />
          Status
        </TabsTrigger>
        <TabsTrigger
          value="invitations"
          className="flex items-center gap-2"
          data-testid="tab-user-invitations"
        >
          <Mail className="h-4 w-4" />
          Invitations
        </TabsTrigger>
        <TabsTrigger
          value="users"
          className="flex items-center gap-2"
          data-testid="tab-migrated-users"
        >
          <Users className="h-4 w-4" />
          Users
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="migration"
        className="space-y-6"
        data-testid="tab-content-migration"
      >
        <NovaBulkMigration />
      </TabsContent>

      <TabsContent
        value="status"
        className="space-y-6"
        data-testid="tab-content-status"
      >
        <MigrationStatus />
      </TabsContent>

      <TabsContent
        value="invitations"
        className="space-y-6"
        data-testid="tab-content-invitations"
      >
        <UserInvitations />
      </TabsContent>

      <TabsContent
        value="users"
        className="space-y-6"
        data-testid="tab-content-users"
      >
        <MigratedUsers />
      </TabsContent>
    </Tabs>
  );
}
