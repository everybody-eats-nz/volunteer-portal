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

  // Fetch labels alongside a small preview of recently-tagged volunteers so
  // each card can show an avatar stack without loading every member upfront.
  const [labels, taggedVolunteers] = await Promise.all([
    prisma.customLabel.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { users: true } },
        users: {
          take: 5,
          orderBy: { assignedAt: "desc" },
          select: {
            user: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                email: true,
                profilePhotoUrl: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    // Distinct volunteers carrying at least one active label.
    prisma.user.count({
      where: { customLabels: { some: { label: { isActive: true } } } },
    }),
  ]);

  const initialLabels = labels.map((label) => ({
    ...label,
    previewUsers: label.users.map((u) => u.user),
  }));

  return (
    <AdminPageWrapper title="Custom Labels">
      <PageContainer>
        <CustomLabelsContent
          initialLabels={initialLabels}
          taggedVolunteers={taggedVolunteers}
        />
      </PageContainer>
    </AdminPageWrapper>
  );
}
