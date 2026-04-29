import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { marked } from "marked";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getEmailService } from "@/lib/email-service";
import { createNotificationsForUsers } from "@/lib/notifications";
import { getBaseUrl } from "@/lib/utils";
import {
  AnnouncementTargeting,
  countAnnouncementRecipients,
  findAnnouncementRecipients,
  targetingFromAnnouncement,
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
      const recipientCount = await countAnnouncementRecipients(
        targetingFromAnnouncement(ann)
      );
      return {
        ...ann,
        createdAt: ann.createdAt.toISOString(),
        expiresAt: ann.expiresAt?.toISOString() ?? null,
        emailSentAt: ann.emailSentAt?.toISOString() ?? null,
        notificationSentAt: ann.notificationSentAt?.toISOString() ?? null,
        recipientCount,
      };
    })
  );

  return NextResponse.json({ announcements: results });
}

/**
 * POST /api/admin/announcements
 *
 * Creates a new announcement and (optionally) dispatches it as an email
 * and/or in-app push notification to all matched volunteers. Both dispatch
 * paths run fire-and-forget after the response is returned so the request
 * stays snappy on large recipient lists.
 *
 * Body: {
 *   title, body,
 *   imageUrl?, expiresAt?,
 *   targetLocations?, targetGrades?, targetLabelIds?,
 *   targetUserIds?, targetShiftIds?,
 *   sendEmail?, sendNotification?
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
    return NextResponse.json(
      { error: "Admin user not found" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
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
    sendNotification,
  } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!announcementBody?.trim()) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  const targeting: AnnouncementTargeting = {
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
      sendNotification: Boolean(sendNotification),
      ...targeting,
    },
    include: {
      author: {
        select: { id: true, name: true, firstName: true, email: true },
      },
    },
  });

  const recipientCount = await countAnnouncementRecipients(targeting);

  // Fire-and-forget dispatch paths — keep the admin response snappy.
  if (sendEmail) {
    void dispatchAnnouncementEmails(announcement.id).catch((err) => {
      console.error("[announcements] email dispatch failed", err);
    });
  }
  if (sendNotification) {
    void dispatchAnnouncementNotifications(announcement.id).catch((err) => {
      console.error("[announcements] notification dispatch failed", err);
    });
  }

  return NextResponse.json({
    announcement: {
      ...announcement,
      createdAt: announcement.createdAt.toISOString(),
      expiresAt: announcement.expiresAt?.toISOString() ?? null,
      emailSentAt: announcement.emailSentAt?.toISOString() ?? null,
      notificationSentAt:
        announcement.notificationSentAt?.toISOString() ?? null,
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

  const recipients = await findAnnouncementRecipients(
    targetingFromAnnouncement(ann)
  );

  // Wrap the rendered markdown in a container with explicit colour and font
  // so the email body doesn't inherit the template's muted body styling
  // (Campaign Monitor's default body region is grey, which makes admin-
  // authored copy look ghosted). Inline styles are required — most email
  // clients strip <style> tags.
  const renderedBody = await marked.parse(ann.body, { async: true });
  const bodyHtml = `<div style="color:#fff;">${renderedBody}</div>`;
  const baseUrl = getBaseUrl();
  const feedLink = `${baseUrl}/dashboard`;
  // Fall back to a 200×1 white spacer so the template can drop the
  // conditional around the image. The wide aspect ratio means email clients
  // that scale the image to column width keep the height ≈ 3px (vs. a 1×1
  // that becomes a square the full width of the column).
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

/**
 * Strip markdown to a plain-text preview suitable for an OS-level push
 * notification body (and the in-app inbox message). Drops links, formatting
 * marks, list bullets, and collapses whitespace.
 */
function markdownToPreview(markdown: string, maxLength = 140): string {
  const stripped = markdown
    // images: ![alt](url) → alt
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    // links: [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // headings, blockquotes, list markers at line start
    .replace(/^[ \t]*(?:#{1,6}|>|[-*+]|\d+\.)[ \t]+/gm, "")
    // emphasis marks: **bold**, *italic*, _italic_, `code`
    .replace(/[*_`]+/g, "")
    // collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > maxLength
    ? `${stripped.slice(0, maxLength - 1).trimEnd()}…`
    : stripped;
}

/**
 * Create an in-app notification (with push) for every matched volunteer.
 * Uses createNotificationsForUsers which handles batched DB inserts, SSE
 * fan-out to connected web sessions, and a single batched Expo push call
 * with per-user badge counts. Stamps `notificationSentAt` on completion.
 */
async function dispatchAnnouncementNotifications(announcementId: string) {
  const ann = await prisma.announcement.findUnique({
    where: { id: announcementId },
  });
  if (!ann) return;

  const recipients = await findAnnouncementRecipients(
    targetingFromAnnouncement(ann)
  );
  if (recipients.length === 0) {
    await prisma.announcement.update({
      where: { id: announcementId },
      data: { notificationSentAt: new Date() },
    });
    return;
  }

  await createNotificationsForUsers({
    userIds: recipients.map((r) => r.id),
    type: "ANNOUNCEMENT",
    title: ann.title,
    message: markdownToPreview(ann.body),
    // Mobile app routes /dashboard to the home tab where announcements
    // surface in the activity feed; web users land on the same page.
    actionUrl: "/dashboard",
    relatedId: ann.id,
  });

  await prisma.announcement.update({
    where: { id: announcementId },
    data: { notificationSentAt: new Date() },
  });
}
