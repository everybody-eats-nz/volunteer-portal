"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  STATUS_ICON,
  STATUS_SOLID,
  STATUS_TINTED,
  type StatusTone,
} from "@/lib/status-styles";
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

/** Each attention row is a tinted panel in its status tone. */
function attentionRowClass(tone: StatusTone) {
  return cn(
    "flex items-center gap-3 p-3 rounded-lg border transition-colors hover:brightness-[0.97] dark:hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    STATUS_TINTED[tone]
  );
}

function CountPill({ tone, count }: { tone: StatusTone; count: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums",
        STATUS_SOLID[tone]
      )}
    >
      {count}
    </span>
  );
}

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
    <div>
      <Card>
        <CardHeader>
          <CardTitle
            data-testid="needs-attention-heading"
            className="flex items-center gap-2"
          >
            {hasItems ? (
              <>
                <AlertTriangle className={cn("h-5 w-5", STATUS_ICON.pending)} aria-hidden="true" />
                Needs attention
              </>
            ) : (
              <>
                <CheckCircle className={cn("h-5 w-5", STATUS_ICON.confirmed)} aria-hidden="true" />
                All clear
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
                  className={attentionRowClass("pending")}
                >
                  <Clock
                    className={cn("h-5 w-5 shrink-0", STATUS_ICON.pending)}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {pendingSignups} pending signup
                      {pendingSignups !== 1 ? "s" : ""}
                    </div>
                    <div className="text-xs opacity-80">
                      Awaiting review and approval
                    </div>
                  </div>
                  <CountPill tone="pending" count={pendingSignups} />
                </Link>
              )}

              {lowFillShifts.length > 0 && (
                <Link
                  href="/admin/shifts"
                  data-testid="low-signup-rates-text"
                  className={attentionRowClass("danger")}
                >
                  <AlertTriangle
                    className={cn("h-5 w-5 shrink-0", STATUS_ICON.danger)}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {lowFillShifts.length} shift
                      {lowFillShifts.length !== 1 ? "s" : ""} understaffed
                    </div>
                    <div className="text-xs opacity-80">
                      Below 50% volunteer capacity
                    </div>
                  </div>
                  <CountPill tone="danger" count={lowFillShifts.length} />
                </Link>
              )}

              {pendingParentalConsent > 0 && (
                <Link
                  href="/admin/parental-consent"
                  className={attentionRowClass("pending")}
                >
                  <FileCheck
                    className={cn("h-5 w-5 shrink-0", STATUS_ICON.pending)}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {pendingParentalConsent} consent form
                      {pendingParentalConsent !== 1 ? "s" : ""}
                    </div>
                    <div className="text-xs opacity-80">
                      Parental consent awaiting approval
                    </div>
                  </div>
                  <CountPill tone="pending" count={pendingParentalConsent} />
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
                  <Link href="/admin/shifts">Review all shifts</Link>
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
    </div>
  );
}
