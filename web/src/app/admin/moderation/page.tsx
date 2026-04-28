import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AlertTriangle, Ban, CheckCircle, Clock } from "lucide-react";
import type { Metadata } from "next";

import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { prisma } from "@/lib/prisma";
import { ModerationContent } from "./moderation-content";

export const metadata: Metadata = {
  title: "Moderation | Admin",
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
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between pb-2">
                <h3 className="text-sm font-medium tracking-tight">
                  Pending Reports
                </h3>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-orange-600">
                {pendingReports}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Requires review within 24 hours
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between pb-2">
                <h3 className="text-sm font-medium tracking-tight">
                  Resolved Reports
                </h3>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-green-600">
                {resolvedReports}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between pb-2">
                <h3 className="text-sm font-medium tracking-tight">
                  Active Blocks
                </h3>
                <Ban className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">{activeBlocks}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Users blocked by other users
              </p>
            </div>
          </div>

          {/* 24-hour reminder */}
          {pendingReports > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 p-4">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  {pendingReports} pending{" "}
                  {pendingReports === 1 ? "report requires" : "reports require"}{" "}
                  attention
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-0.5">
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
