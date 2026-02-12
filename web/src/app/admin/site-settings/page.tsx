import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { SiteSettingsForm } from "@/components/site-settings-form";

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
        <SiteSettingsForm settings={settings} />
      </PageContainer>
    </AdminPageWrapper>
  );
}
