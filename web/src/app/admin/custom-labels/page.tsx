import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { PageContainer } from "@/components/page-container";
import { CustomLabelsContent } from "./custom-labels-content";

export default async function CustomLabelsPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const labels = await prisma.customLabel.findMany({
    where: {
      isActive: true,
    },
    include: {
      _count: {
        select: {
          users: true,
        },
      },
    },
    orderBy: [
      { createdAt: "desc" },
    ],
  });

  return (
    <AdminPageWrapper title="Custom Labels">
      <PageContainer>
        <CustomLabelsContent initialLabels={labels} />
      </PageContainer>
    </AdminPageWrapper>
  );
}