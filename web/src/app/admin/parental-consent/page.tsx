import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { FileText, Users, Clock, CheckCircle } from "lucide-react";

import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { KpiTile } from "@/components/admin/kpi-tile";
import { ParentalConsentTable } from "./parental-consent-table";
import { prisma } from "@/lib/prisma";
import { getUsersRequiringParentalConsent } from "@/lib/parental-consent";

export const metadata: Metadata = {
  title: "Parental Consent",
};

/**
 * Admin page for managing parental consent approvals
 * Shows all volunteers under 16 who require parental consent
 */
export default async function AdminParentalConsentPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/parental-consent");
  }
  if (role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Get statistics for volunteers requiring parental consent
  // Note: We use requiresParentalConsent flag to stay consistent with the table data
  const [totalUnder16, pendingApproval, approved, consentUsers] = await Promise.all([
    // Total volunteers requiring parental consent
    prisma.user.count({
      where: {
        role: "VOLUNTEER",
        requiresParentalConsent: true,
        archivedAt: null,
      },
    }),
    // Pending approval (requiring consent but not yet received)
    prisma.user.count({
      where: {
        role: "VOLUNTEER",
        requiresParentalConsent: true,
        archivedAt: null,
        parentalConsentReceived: false,
      },
    }),
    // Approved (requiring consent and received)
    prisma.user.count({
      where: {
        role: "VOLUNTEER",
        requiresParentalConsent: true,
        archivedAt: null,
        parentalConsentReceived: true,
      },
    }),
    getUsersRequiringParentalConsent(),
  ]);

  return (
    <PageContainer>
      <AdminPageWrapper
        title="Parental Consent Management"
        description="Manage parental consent approvals for volunteers under 16"
      >
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiTile
              icon={<Clock />}
              label="Pending approval"
              value={pendingApproval}
              tone={pendingApproval > 0 ? "pending" : "neutral"}
              data-testid="consent-pending-card"
              valueTestId="consent-pending-count"
            />
            <KpiTile
              icon={<CheckCircle />}
              label="Approved"
              value={approved}
              tone="sun"
              data-testid="consent-approved-card"
              valueTestId="consent-approved-count"
            />
            <KpiTile
              icon={<Users />}
              label="Total under 16"
              value={totalUnder16}
              tone="forest"
              data-testid="consent-total-card"
              valueTestId="consent-total-count"
            />
          </div>

          {/* Instructions */}
          <div className="rounded-lg border bg-primary-light p-4">
            <div className="flex items-start gap-3">
              <FileText
                className="mt-0.5 h-5 w-5 shrink-0 text-primary-text"
                aria-hidden="true"
              />
              <div>
                <h4 className="text-sm font-semibold text-primary-text">
                  How Parental Consent Works
                </h4>
                <div className="mt-1 text-sm text-foreground/80">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      Volunteers under 16 see a notice during registration to
                      download the consent form
                    </li>
                    <li>
                      They must print, complete, and email the signed form to
                      volunteer@everybodyeats.nz
                    </li>
                    <li>
                      When you receive the signed form, approve their consent
                      below
                    </li>
                    <li>
                      Once approved, they can access all volunteer features
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Consent Management Table */}
          <ParentalConsentTable initialUsers={consentUsers} />
        </div>
      </AdminPageWrapper>
    </PageContainer>
  );
}
