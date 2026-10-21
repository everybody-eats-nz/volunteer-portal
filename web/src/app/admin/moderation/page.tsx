import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AlertTriangle, Ban, CheckCircle, Clock } from "lucide-react";
import type { Metadata } from "next";

import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { prisma } from "@/lib/prisma";
import { KpiTile } from "@/components/admin/kpi-tile";
import { STATUS_ICON, STATUS_TINTED } from "@/lib/status-styles";
import { cn } from "@/lib/utils";
import { ModerationContent } from "./moderation-content";

export const metadata: Metadata = {
  title: "Content Moderation",
  robots: { index: false, follow: false },
};

export default async function ModerationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/admin/moderation");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const [pendingReports, resolvedReports, activeBlocks] = await Promise.all([
    prisma.contentReport.count({ where: { status: "PENDING" } }),
    prisma.contentReport.count({ where: { status: "RESOLVED" } }),
    prisma.userBlock.count(),
  ]);

  return (
    <PageContainer>
      <AdminPageWrapper
        title="Content Moderation"
        description="Review flagged content and user blocks — Apple Guideline 1.2 compliance"
      >
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiTile
              tone={pendingReports > 0 ? "pending" : "neutral"}
              icon={<Clock />}
              label="Pending reports"
              value={pendingReports}
              hint="Review within 24 hours"
            />
            <KpiTile
              tone="forest"
              icon={<CheckCircle />}
              label="Resolved reports"
              value={resolvedReports}
            />
            <KpiTile
              tone="neutral"
              icon={<Ban />}
              label="Active blocks"
              value={activeBlocks}
              hint="Volunteers blocked by other volunteers"
            />
          </div>

          {/* 24-hour reminder */}
          {pendingReports > 0 && (
            <div
              role="status"
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4",
                STATUS_TINTED.pending
              )}
            >
              <AlertTriangle
                className={cn("h-5 w-5 mt-0.5 shrink-0", STATUS_ICON.pending)}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold">
                  {pendingReports} pending{" "}
                  {pendingReports === 1 ? "report needs" : "reports need"}{" "}
                  attention
                </p>
                <p className="text-sm mt-0.5">
                  Apple App Store Guideline 1.2 requires content reports to be
                  reviewed and acted on within 24 hours.
                </p>
              </div>
            </div>
          )}

          <ModerationContent />
        </div>
      </AdminPageWrapper>
    </PageContainer>
  );
}
