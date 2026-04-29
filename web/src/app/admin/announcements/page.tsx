import { Metadata } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { AnnouncementsContent } from "./announcements-content";

export const metadata: Metadata = {
  title: "Announcements | Admin",
  description: "Send targeted announcements to volunteers",
};

interface PageProps {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
}

function csv(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(",") : value;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function AnnouncementsPage({ searchParams }: PageProps) {
  await connection();

  const sp = await searchParams;
  const prefillUserIds = csv(sp.userIds);
  const prefillShiftIds = csv(sp.shiftIds);
  const prefillLocations = csv(sp.locations);
  const prefillGrades = csv(sp.grades);
  const prefillLabelIds = csv(sp.labels);
  const prefillSendEmail = sp.sendEmail === "1" || sp.sendEmail === "true";
  const hasPrefill =
    prefillUserIds.length > 0 ||
    prefillShiftIds.length > 0 ||
    prefillLocations.length > 0 ||
    prefillGrades.length > 0 ||
    prefillLabelIds.length > 0 ||
    prefillSendEmail;

  const [announcements, labels, locations, prefillUsers, prefillShifts] =
    await Promise.all([
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
      prefillUserIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: prefillUserIds } },
            select: {
              id: true,
              email: true,
              name: true,
              firstName: true,
              lastName: true,
            },
          })
        : Promise.resolve([]),
      prefillShiftIds.length > 0
        ? prisma.shift.findMany({
            where: { id: { in: prefillShiftIds } },
            select: {
              id: true,
              start: true,
              end: true,
              location: true,
              shiftType: { select: { name: true } },
              _count: {
                select: {
                  signups: {
                    where: {
                      status: {
                        in: [
                          "CONFIRMED",
                          "PENDING",
                          "WAITLISTED",
                          "REGULAR_PENDING",
                          "NO_SHOW",
                        ],
                      },
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
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
        prefill={
          hasPrefill
            ? {
                locations: prefillLocations,
                grades: prefillGrades,
                labelIds: prefillLabelIds,
                sendEmail: prefillSendEmail,
                users: prefillUsers,
                shifts: prefillShifts.map((s) => ({
                  id: s.id,
                  start: s.start.toISOString(),
                  end: s.end.toISOString(),
                  location: s.location,
                  shiftTypeName: s.shiftType.name,
                  signupCount: s._count.signups,
                })),
              }
            : null
        }
      />
    </AdminPageWrapper>
  );
}
