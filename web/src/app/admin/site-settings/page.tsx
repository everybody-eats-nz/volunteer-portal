import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { SiteSettingsForm } from "@/components/site-settings-form";
import { Card, CardContent } from "@/components/ui/card";

export default async function SiteSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const settings = await prisma.siteSetting.findMany({
    orderBy: { category: "asc" },
  });

  return (
    <AdminPageWrapper
      title="Site Settings"
      description="Configure site-wide settings and URLs"
    >
      <PageContainer>
        <div className="space-y-6">
          <Card className="hover:bg-muted/30 transition-colors">
            <Link href="/admin/site-settings/messaging-hours" className="block">
              <CardContent className="py-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-emerald-700" />
                  <div>
                    <p className="font-medium">Messaging hours</p>
                    <p className="text-sm text-muted-foreground">
                      Per-day, per-location reply windows shown to volunteers
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Link>
          </Card>
          <SiteSettingsForm settings={settings} />
        </div>
      </PageContainer>
    </AdminPageWrapper>
  );
}
