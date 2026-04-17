"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ui/scrollable-tabs";
import {
  Archive,
  LayoutDashboard,
  History,
  Database,
  Send,
  UserX,
  BellRing,
  AlertTriangle,
} from "lucide-react";
import { ArchivingOverview } from "./archiving-overview";
import { PendingCategory } from "./pending-category";
import { ArchivingLog } from "./archiving-log";
import type { ArchiveCategory } from "@/lib/archive-service";

const TABS = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  {
    value: "never-migrated",
    label: "Never migrated",
    icon: Database,
  },
  {
    value: "never-activated-nudge",
    label: "Nudge new sign-ups",
    icon: BellRing,
  },
  {
    value: "never-activated-archive",
    label: "Never activated — archive",
    icon: UserX,
  },
  {
    value: "inactive-warning",
    label: "Inactive — send warning",
    icon: Send,
  },
  {
    value: "inactive-archive",
    label: "Inactive — archive",
    icon: AlertTriangle,
  },
  { value: "log", label: "Activity log", icon: History },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const CATEGORY_DESCRIPTIONS: Record<ArchiveCategory, string> = {
  "never-migrated":
    "Legacy-portal users who never completed migration. These accounts are archived immediately when you run the pass.",
  "never-activated-nudge":
    "Users who signed up more than a month ago and haven't confirmed a shift yet. We'll nudge them once with a gentle email.",
  "never-activated-archive":
    "Users who signed up more than three months ago and still haven't confirmed a shift. Time to archive.",
  "inactive-warning":
    "Volunteers whose last confirmed shift was over 11 months ago. They'll receive a warning email with a one-click link to stay active.",
  "inactive-archive":
    "Volunteers who were warned at least 30 days ago and are now past the 12-month mark. Ready to archive.",
};

const CATEGORY_ACTIONS: Record<
  ArchiveCategory,
  { label: string; kind: "archive" | "warn" | "nudge"; reason?: string }
> = {
  "never-migrated": {
    label: "Archive",
    kind: "archive",
    reason: "NEVER_MIGRATED",
  },
  "never-activated-nudge": { label: "Send nudge", kind: "nudge" },
  "never-activated-archive": {
    label: "Archive",
    kind: "archive",
    reason: "NEVER_ACTIVATED",
  },
  "inactive-warning": { label: "Send warning", kind: "warn" },
  "inactive-archive": {
    label: "Archive",
    kind: "archive",
    reason: "INACTIVE_12_MONTHS",
  },
};

export function ArchivingTabs() {
  const [activeTab, setActiveTab] = useState<TabValue>("overview");
  const [overviewRefreshKey, setOverviewRefreshKey] = useState(0);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (TABS.some((t) => t.value === hash)) {
        setActiveTab(hash as TabValue);
      }
    };
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value as TabValue);
    window.history.replaceState(null, "", `#${value}`);
  };

  const bumpOverview = () => setOverviewRefreshKey((k) => k + 1);

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <ScrollableTabsList data-testid="archiving-tabs">
        {TABS.map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="flex items-center gap-2"
            data-testid={`tab-${value}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </TabsTrigger>
        ))}
      </ScrollableTabsList>

      <TabsContent
        value="overview"
        className="space-y-6"
        data-testid="tab-content-overview"
      >
        <ArchivingOverview
          refreshKey={overviewRefreshKey}
          onRunComplete={bumpOverview}
        />
      </TabsContent>

      {(
        [
          "never-migrated",
          "never-activated-nudge",
          "never-activated-archive",
          "inactive-warning",
          "inactive-archive",
        ] as const
      ).map((category) => {
        const action = CATEGORY_ACTIONS[category];
        return (
          <TabsContent
            key={category}
            value={category}
            className="space-y-6"
            data-testid={`tab-content-${category}`}
          >
            <PendingCategory
              category={category}
              description={CATEGORY_DESCRIPTIONS[category]}
              action={action}
              onMutation={bumpOverview}
            />
          </TabsContent>
        );
      })}

      <TabsContent
        value="log"
        className="space-y-6"
        data-testid="tab-content-log"
      >
        <ArchivingLog />
      </TabsContent>
    </Tabs>
  );
}

export { Archive };
