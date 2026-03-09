"use client";

import { motion } from "motion/react";
import { slideUpVariants } from "@/lib/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Clock,
  FileCheck,
  CheckCircle,
} from "lucide-react";

export interface LowFillShift {
  id: string;
  name: string;
  confirmed: number;
  capacity: number;
  fillRate: number;
}

interface AdminDashboardAttentionProps {
  pendingSignups: number;
  lowFillShifts: LowFillShift[];
  pendingParentalConsent: number;
}

const itemStyles = {
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800/50",
    icon: "text-amber-600 dark:text-amber-400",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800/50",
    icon: "text-red-600 dark:text-red-400",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800/50",
    icon: "text-blue-600 dark:text-blue-400",
  },
};

export function AdminDashboardAttention({
  pendingSignups,
  lowFillShifts,
  pendingParentalConsent,
}: AdminDashboardAttentionProps) {
  const hasItems =
    pendingSignups > 0 ||
    lowFillShifts.length > 0 ||
    pendingParentalConsent > 0;

  return (
    <motion.div
      variants={slideUpVariants}
      initial="hidden"
      animate="visible"
    >
      <Card>
        <CardHeader>
          <CardTitle
            data-testid="needs-attention-heading"
            className="flex items-center gap-2"
          >
            {hasItems ? (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Needs Attention
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                All Clear
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasItems ? (
            <div className="space-y-2" data-testid="attention-items">
              {pendingSignups > 0 && (
                <Link
                  href="/admin/shifts"
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors hover:opacity-80",
                    itemStyles.amber.bg,
                    itemStyles.amber.border
                  )}
                >
                  <Clock
                    className={cn("h-5 w-5 shrink-0", itemStyles.amber.icon)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {pendingSignups} pending signup
                      {pendingSignups !== 1 ? "s" : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Awaiting review and approval
                    </div>
                  </div>
                  <Badge variant="warning">{pendingSignups}</Badge>
                </Link>
              )}

              {lowFillShifts.length > 0 && (
                <Link
                  href="/admin/shifts"
                  data-testid="low-signup-rates-text"
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors hover:opacity-80",
                    itemStyles.red.bg,
                    itemStyles.red.border
                  )}
                >
                  <AlertTriangle
                    className={cn("h-5 w-5 shrink-0", itemStyles.red.icon)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {lowFillShifts.length} shift
                      {lowFillShifts.length !== 1 ? "s" : ""} understaffed
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Below 50% volunteer capacity
                    </div>
                  </div>
                  <Badge variant="destructive">{lowFillShifts.length}</Badge>
                </Link>
              )}

              {pendingParentalConsent > 0 && (
                <Link
                  href="/admin/parental-consent"
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors hover:opacity-80",
                    itemStyles.blue.bg,
                    itemStyles.blue.border
                  )}
                >
                  <FileCheck
                    className={cn("h-5 w-5 shrink-0", itemStyles.blue.icon)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {pendingParentalConsent} consent form
                      {pendingParentalConsent !== 1 ? "s" : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Parental consent awaiting approval
                    </div>
                  </div>
                  <Badge variant="secondary">{pendingParentalConsent}</Badge>
                </Link>
              )}

              {lowFillShifts.length > 0 && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="w-full mt-1"
                  data-testid="review-all-button"
                >
                  <Link href="/admin/shifts">Review All Shifts</Link>
                </Button>
              )}
            </div>
          ) : (
            <p
              className="text-muted-foreground text-sm"
              data-testid="good-signup-rates-message"
            >
              All upcoming shifts have good signup rates!{" "}
              <span data-testid="celebration-emoji">🎉</span>
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
