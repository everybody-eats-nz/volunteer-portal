import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { FileText, Users, Clock, CheckCircle } from "lucide-react";

import { authOptions } from "@/lib/auth-options";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { ParentalConsentTable } from "./parental-consent-table";

/**
 * Admin page for managing parental consent approvals
 * Shows all volunteers under 18 who require parental consent
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

  return (
    <PageContainer>
      <AdminPageWrapper
        title="Parental Consent Management"
        description="Manage parental consent approvals for volunteers under 18"
      >
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-card text-card-foreground p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <h3 className="tracking-tight text-sm font-medium">
                  Pending Approval
                </h3>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-orange-600">
                -
              </div>
            </div>
            
            <div className="rounded-lg border bg-card text-card-foreground p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <h3 className="tracking-tight text-sm font-medium">
                  Approved
                </h3>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-green-600">
                -
              </div>
            </div>
            
            <div className="rounded-lg border bg-card text-card-foreground p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <h3 className="tracking-tight text-sm font-medium">
                  Total Under 18
                </h3>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                -
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  How Parental Consent Works
                </h4>
                <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Volunteers under 18 see a notice during registration to download the consent form</li>
                    <li>They must print, complete, and email the signed form to volunteers@everybodyeats.nz</li>
                    <li>When you receive the signed form, approve their consent below</li>
                    <li>Once approved, they can access all volunteer features</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Consent Management Table */}
          <ParentalConsentTable />
        </div>
      </AdminPageWrapper>
    </PageContainer>
  );
}