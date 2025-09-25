"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Clock, Award, Percent } from "lucide-react";

interface AutoApprovalStats {
  totalAutoApprovals: number;
  recentAutoApprovals: number;
  topRules: Array<{
    ruleId: string;
    ruleName: string;
    count: number;
  }>;
  overrideRate: number;
}

interface RuleStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RuleStatsDialog({ open, onOpenChange }: RuleStatsDialogProps) {
  const [stats, setStats] = useState<AutoApprovalStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchStats();
    }
  }, [open]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/auto-accept-rules/stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Auto-Approval Statistics</DialogTitle>
            <DialogDescription>
              Performance metrics for auto-accept rules
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading statistics...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const maxCount = Math.max(...stats.topRules.map(r => r.count), 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Auto-Approval Statistics</DialogTitle>
          <DialogDescription>
            Performance metrics for auto-accept rules
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Auto-Approvals
              </CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAutoApprovals}</div>
              <p className="text-xs text-muted-foreground">
                All-time automatic approvals
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Recent Activity
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentAutoApprovals}</div>
              <p className="text-xs text-muted-foreground">
                Auto-approvals in last 7 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Override Rate
              </CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.overrideRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-approvals later overridden
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Efficiency
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalAutoApprovals > 0 
                  ? ((1 - stats.overrideRate / 100) * 100).toFixed(0)
                  : 100}%
              </div>
              <p className="text-xs text-muted-foreground">
                Approval accuracy rate
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top Performing Rules</CardTitle>
            <CardDescription>
              Most frequently triggered auto-accept rules
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topRules.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No auto-approvals yet
              </div>
            ) : (
              <div className="space-y-4">
                {stats.topRules.map((rule) => (
                  <div key={rule.ruleId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{rule.ruleName}</div>
                      <Badge variant="outline">{rule.count} uses</Badge>
                    </div>
                    <Progress 
                      value={(rule.count / maxCount) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}