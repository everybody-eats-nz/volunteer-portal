import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { marked } from "marked";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getEmailService } from "@/lib/email-service";
import { getBaseUrl } from "@/lib/utils";
import {
  countAnnouncementRecipients,
  findAnnouncementRecipients,
} from "@/lib/announcement-targeting";

/**
 * GET /api/admin/announcements
 *
 * Returns all announcements with author info and recipient counts.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const announcements = await prisma.announcement.findMany({
    include: {
      author: {
        select: { id: true, name: true, firstName: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const results = await Promise.all(
    announcements.map(async (ann) => {
      const recipientCount = await countAnnouncementRecipients({
        targetLocations: ann.targetLocations,
        targetGrades: ann.targetGrades,
        targetLabelIds: ann.targetLabelIds,
        targetUserIds: ann.targetUserIds,
        targetShiftIds: ann.targetShiftIds,
      });
      return {
        ...ann,
        createdAt: ann.createdAt.toISOString(),
        expiresAt: ann.expiresAt?.toISOString() ?? null,
        emailSentAt: ann.emailSentAt?.toISOString() ?? null,
        recipientCount,
      };
    })
  );

  return NextResponse.json({ announcements: results });
}

/**
 * POST /api/admin/announcements
 *
 * Creates a new announcement and (optionally) sends it as an email to all
 * matched volunteers. Email dispatch runs after the response is returned so
 * the request stays snappy on large recipient lists.
 *
 * Body: {
 *   title, body,
 *   imageUrl?, expiresAt?,
 *   targetLocations?, targetGrades?, targetLabelIds?,
 *   targetUserIds?, targetShiftIds?,
 *   sendEmail?
 * }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const adminUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true },
  });
  if (!adminUser) {
    return NextResponse.json({ error: "Admin user not found" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    title,
    body: announcementBody,
    imageUrl,
    expiresAt,
    targetLocations,
    targetGrades,
    targetLabelIds,
    targetUserIds,
    targetShiftIds,
    sendEmail,
  } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!announcementBody?.trim()) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  const targeting = {
    targetLocations: Array.isArray(targetLocations) ? targetLocations : [],
    targetGrades: Array.isArray(targetGrades) ? targetGrades : [],
    targetLabelIds: Array.isArray(targetLabelIds) ? targetLabelIds : [],
    targetUserIds: Array.isArray(targetUserIds) ? targetUserIds : [],
    targetShiftIds: Array.isArray(targetShiftIds) ? targetShiftIds : [],
  };

  const announcement = await prisma.announcement.create({
    data: {
      title: title.trim(),
      body: announcementBody.trim(),
      imageUrl: imageUrl?.trim() || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: adminUser.id,
      sendEmail: Boolean(sendEmail),
      ...targeting,
    },
    include: {
      author: {
        select: { id: true, name: true, firstName: true, email: true },
      },
    },
  });

  const recipientCount = await countAnnouncementRecipients(targeting);

  // Fire-and-forget email dispatch — keeps the admin response snappy.
  if (sendEmail) {
    void dispatchAnnouncementEmails(announcement.id).catch((err) => {
      console.error("[announcements] email dispatch failed", err);
    });
  }

  return NextResponse.json({
    announcement: {
      ...announcement,
      createdAt: announcement.createdAt.toISOString(),
      expiresAt: announcement.expiresAt?.toISOString() ?? null,
      emailSentAt: announcement.emailSentAt?.toISOString() ?? null,
      recipientCount,
    },
  });
}

/**
 * Render the announcement body as HTML and email each matched volunteer via
 * the Campaign Monitor "Announcement" smart email template. Stamps
 * `emailSentAt` once dispatch finishes (regardless of individual failures —
 * Promise.allSettled lets one bad address not block the rest).
 */
async function dispatchAnnouncementEmails(announcementId: string) {
  const ann = await prisma.announcement.findUnique({
    where: { id: announcementId },
  });
  if (!ann) return;

  const recipients = await findAnnouncementRecipients({
    targetLocations: ann.targetLocations,
    targetGrades: ann.targetGrades,
    targetLabelIds: ann.targetLabelIds,
    targetUserIds: ann.targetUserIds,
    targetShiftIds: ann.targetShiftIds,
  });

  const bodyHtml = await marked.parse(ann.body, { async: true });
  const baseUrl = getBaseUrl();
  const feedLink = `${baseUrl}/dashboard`;
  // Fall back to a 1×1 white pixel so the template can drop the conditional
  // around the image — the pixel is invisible against any background.
  const imageUrl = ann.imageUrl ?? `${baseUrl}/email/blank-pixel.png`;
  const emailService = getEmailService();

  await Promise.allSettled(
    recipients.map((r) =>
      emailService.sendAnnouncement({
        to: r.email,
        firstName: r.firstName ?? r.name ?? "there",
        title: ann.title,
        bodyHtml,
        imageUrl,
        feedLink,
      })
    )
  );

  await prisma.announcement.update({
    where: { id: announcementId },
    data: { emailSentAt: new Date() },
  });
}
