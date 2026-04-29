import { Metadata } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { AnnouncementsContent } from "./announcements-content";

export const metadata: Metadata = {
  title: "Announcements | Admin",
  description: "Send targeted announcements to volunteers",
};

export default async function AnnouncementsPage() {
  await connection();

  const [announcements, labels, locations] = await Promise.all([
    prisma.announcement.findMany({
      include: {
        author: {
          select: { id: true, name: true, firstName: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customLabel.findMany({
      where: { isActive: true },
      select: { id: true, name: true, color: true, icon: true },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({
      where: { isActive: true },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AdminPageWrapper
      title="Announcements"
      description="Send targeted announcements to volunteers in the mobile feed"
    >
      <AnnouncementsContent
        initialAnnouncements={announcements.map((a) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
          expiresAt: a.expiresAt?.toISOString() ?? null,
          emailSentAt: a.emailSentAt?.toISOString() ?? null,
        }))}
        labels={labels}
        locations={locations.map((l) => l.name)}
      />
    </AdminPageWrapper>
  );
}
