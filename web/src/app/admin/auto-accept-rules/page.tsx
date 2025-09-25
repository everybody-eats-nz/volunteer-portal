"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Edit, Trash2, BarChart } from "lucide-react";

import { getVolunteerGradeInfo } from "@/lib/volunteer-grades";

import { RuleFormDialog } from "@/components/auto-accept/rule-form-dialog";
import { RuleStatsDialog } from "@/components/auto-accept/rule-stats-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useAdminPageTitle } from "@/hooks/use-admin-page-title";
import { useToast } from "@/hooks/use-toast";

interface AutoAcceptRule {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  global: boolean;
  shiftTypeId: string | null;
  location: string | null;
  shiftType: { id: string; name: string } | null;
  minVolunteerGrade: string | null;
  minCompletedShifts: number | null;
  minAttendanceRate: number | null;
  minAccountAgeDays: number | null;
  maxDaysInAdvance: number | null;
  requireShiftTypeExperience: boolean;
  criteriaLogic: "AND" | "OR";
  stopOnMatch: boolean;
  creator: { id: string; name: string | null; email: string };
  _count: { approvals: number };
  createdAt: string;
  updatedAt: string;
}

export default function AutoAcceptRulesPage() {
  const [rules, setRules] = useState<AutoAcceptRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<AutoAcceptRule | null>(null);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const { toast } = useToast();

  const handleShowStats = useCallback(() => setShowStatsDialog(true), []);
  const handleAddRule = useCallback(() => {
    setSelectedRule(null);
    setShowRuleDialog(true);
  }, []);

  const headerActions = useMemo(() => (
    <>
      <Button variant="outline" onClick={handleShowStats}>
        <BarChart className="mr-2 h-4 w-4" />
        View Stats
      </Button>
      <Button onClick={handleAddRule}>
        <Plus className="mr-2 h-4 w-4" />
        Add Rule
      </Button>
    </>
  ), [handleShowStats, handleAddRule]);

  useAdminPageTitle("Auto Accept Rules", "Configure automatic approval rules for shift signups based on volunteer grades and criteria", headerActions);

  useEffect(() => {
    fetchRules();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- fetchRules is stable and should only run on mount

  const fetchRules = async () => {
    try {
      const response = await fetch("/api/admin/auto-accept-rules");
      if (!response.ok) throw new Error("Failed to fetch rules");
      const data = await response.json();
      setRules(data);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load auto-accept rules",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async (ruleId: string) => {
    try {
      const response = await fetch(
        `/api/admin/auto-accept-rules/${ruleId}/toggle`,
        { method: "POST" }
      );
      if (!response.ok) throw new Error("Failed to toggle rule");
      const data = await response.json();

      setRules(rules.map((r) => (r.id === ruleId ? data.rule : r)));

      toast({
        title: "Success",
        description: data.message,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to toggle rule",
        variant: "destructive",
      });
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;

    try {
      const response = await fetch(`/api/admin/auto-accept-rules/${ruleId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete rule");
      const data = await response.json();

      setRules(rules.filter((r) => r.id !== ruleId));

      toast({
        title: "Success",
        description: data.message,
      });

      if (data.warning) {
        toast({
          title: "Warning",
          description: data.warning,
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete rule",
        variant: "destructive",
      });
    }
  };

  const formatCriteria = (rule: AutoAcceptRule) => {
    const criteria = [];

    if (rule.minVolunteerGrade) {
      const gradeInfo = getVolunteerGradeInfo(
        rule.minVolunteerGrade as "GREEN" | "YELLOW" | "PINK"
      );
      criteria.push(`Min Grade: ${gradeInfo.label}`);
    }
    if (rule.minCompletedShifts !== null) {
      criteria.push(`Min Shifts: ${rule.minCompletedShifts}`);
    }
    if (rule.minAttendanceRate !== null) {
      criteria.push(`Min Attendance: ${rule.minAttendanceRate}%`);
    }
    if (rule.minAccountAgeDays !== null) {
      criteria.push(`Account Age: ${rule.minAccountAgeDays} days`);
    }
    if (rule.maxDaysInAdvance !== null) {
      criteria.push(`Max ${rule.maxDaysInAdvance} days ahead`);
    }
    if (rule.requireShiftTypeExperience) {
      criteria.push("Shift type experience required");
    }

    return criteria;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading auto-accept rules...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Active Rules</CardTitle>
          <CardDescription>
            Rules are evaluated in priority order. Higher priority rules are
            checked first.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <div className="text-center py-8 text-gray-500 p-6">
              No auto-accept rules configured yet. Create your first rule to get
              started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow data-testid="auto-accept-rules-table-header">
                    <TableHead className="w-16">Enabled</TableHead>
                    <TableHead className="min-w-48">Name</TableHead>
                    <TableHead className="w-20">Scope</TableHead>
                    <TableHead className="w-24">Location</TableHead>
                    <TableHead className="w-16">Priority</TableHead>
                    <TableHead className="min-w-48">Criteria</TableHead>
                    <TableHead className="w-24">Logic</TableHead>
                    <TableHead className="w-16">Uses</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={() => toggleRule(rule.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="max-w-96">
                          <div
                            className="font-medium truncate"
                            title={rule.name}
                          >
                            {rule.name}
                          </div>
                          {rule.description && (
                            <div className="text-xs text-muted-foreground whitespace-normal break-words">
                              {rule.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {rule.global ? (
                          <Badge variant="secondary">Global</Badge>
                        ) : (
                          <Badge variant="outline">
                            {rule.shiftType?.name || "Unknown"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {rule.location ? (
                          <Badge variant="outline">{rule.location}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">All</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rule.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 max-w-48">
                          {formatCriteria(rule).map((criterion, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-muted-foreground truncate"
                              title={criterion}
                            >
                              {criterion}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            variant={
                              rule.criteriaLogic === "AND"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {rule.criteriaLogic}
                          </Badge>
                          {rule.stopOnMatch && (
                            <Badge variant="outline" className="block">
                              Stop on match
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rule._count.approvals}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRule(rule);
                              setShowRuleDialog(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <RuleFormDialog
        open={showRuleDialog}
        onOpenChange={setShowRuleDialog}
        rule={selectedRule || undefined}
        onSuccess={() => {
          setShowRuleDialog(false);
          fetchRules();
        }}
      />

      <RuleStatsDialog
        open={showStatsDialog}
        onOpenChange={setShowStatsDialog}
      />
    </div>
  );
}
