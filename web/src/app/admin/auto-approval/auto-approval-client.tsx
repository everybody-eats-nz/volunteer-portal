"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileSearch,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ui/scrollable-tabs";
import { CoverageTab } from "./_components/coverage-tab";
import { DecisionsTab } from "./_components/decisions-tab";
import { OverviewTab } from "./_components/overview-tab";
import { RulesTab, type SerializedRuleClient } from "./_components/rules-tab";
import { useAdminOptions } from "./_components/shared";

const TABS = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "coverage", label: "Coverage", icon: Users },
  { value: "decisions", label: "Decisions", icon: FileSearch },
  { value: "rules", label: "Rules", icon: ShieldCheck },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export function AutoApprovalClient() {
  const [tab, setTab] = useState<TabValue>("overview");
  const { options } = useAdminOptions();

  const [rules, setRules] = useState<SerializedRuleClient[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const res = await fetch("/api/admin/auto-approval/rules");
      if (res.ok) {
        const json = await res.json();
        setRules(json.rules);
      }
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // Deep links: /admin/auto-approval#decisions lands straight on that tab.
  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (TABS.some((t) => t.value === hash)) setTab(hash as TabValue);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const changeTab = (value: string) => {
    setTab(value as TabValue);
    window.history.replaceState(null, "", `#${value}`);
  };

  return (
    <Tabs value={tab} onValueChange={changeTab} className="w-full">
      <ScrollableTabsList data-testid="auto-approval-tabs">
        {TABS.map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="flex items-center gap-2"
            data-testid={`tab-${value}`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </TabsTrigger>
        ))}
      </ScrollableTabsList>

      <TabsContent value="overview" className="mt-6">
        <OverviewTab onJumpToDecisions={() => changeTab("decisions")} />
      </TabsContent>

      <TabsContent value="coverage" className="mt-6">
        <CoverageTab options={options} />
      </TabsContent>

      <TabsContent value="decisions" className="mt-6">
        <DecisionsTab
          options={options}
          rules={rules.map((r) => ({ id: r.id, name: r.name }))}
        />
      </TabsContent>

      <TabsContent value="rules" className="mt-6">
        <RulesTab
          rules={rules}
          loading={rulesLoading}
          options={options}
          onRefresh={loadRules}
        />
      </TabsContent>
    </Tabs>
  );
}
