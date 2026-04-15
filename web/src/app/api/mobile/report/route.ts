import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

const VALID_TARGET_TYPES = ["comment", "post", "user"] as const;

const VALID_REASONS = [
  "Offensive or abusive content",
  "Spam",
  "Harassment",
  "Hate speech",
  "Other",
] as const;

/**
 * POST /api/mobile/report
 *
 * Submits a content or user report. Satisfies Apple Guideline 1.2 requirement
 * for a mechanism to flag objectionable content and abusive users.
 *
 * Body: { targetType: 'comment'|'post'|'user', targetId: string, reason: string }
 */
export async function POST(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;

  const body = await request.json().catch(() => null);
  const { targetType, targetId, reason } = body ?? {};

  if (
    !targetType ||
    !VALID_TARGET_TYPES.includes(targetType) ||
    typeof targetId !== "string" ||
    !targetId.trim() ||
    typeof reason !== "string" ||
    !reason.trim()
  ) {
    return NextResponse.json({ error: "Invalid report data" }, { status: 400 });
  }

  const sanitizedReason = VALID_REASONS.includes(reason as (typeof VALID_REASONS)[number])
    ? reason
    : "Other";

  // Prevent duplicate reports from the same user for the same item
  const existing = await prisma.contentReport.findFirst({
    where: { reporterId: userId, targetType, targetId },
  });
  if (existing) {
    // Silently succeed — user already reported this, no need to double-report
    return NextResponse.json({ ok: true });
  }

  await prisma.contentReport.create({
    data: {
      reporterId: userId,
      targetType,
      targetId: targetId.trim(),
      reason: sanitizedReason,
    },
  });

  // Notify admin asynchronously (don't block the response)
  notifyAdmin(userId, targetType, targetId, sanitizedReason).catch((err) => {
    console.error("[report] Admin notification failed:", err);
  });

  return NextResponse.json({ ok: true });
}

async function notifyAdmin(
  reporterId: string,
  targetType: string,
  targetId: string,
  reason: string
) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  const apiKey = process.env.CAMPAIGN_MONITOR_API_KEY;

  if (!adminEmail) {
    console.log(
      `[report] Content report received (ADMIN_NOTIFICATION_EMAIL not set): ${targetType} — "${reason}"`
    );
    return;
  }

  if (!apiKey || apiKey === "dummy-key-for-dev") {
    console.log(
      `[report] Would email ${adminEmail}: New ${targetType} report — "${reason}" (dev mode)`
    );
    return;
  }

  const subject = `[Everybody Eats] Content report: ${targetType}`;
  const html = `
    <p>A volunteer has reported ${targetType} content.</p>
    <ul>
      <li><strong>Type:</strong> ${targetType}</li>
      <li><strong>Item ID:</strong> ${targetId}</li>
      <li><strong>Reason:</strong> ${reason}</li>
      <li><strong>Reporter ID:</strong> ${reporterId}</li>
    </ul>
    <p>Please review this within 24 hours and take appropriate action.</p>
    <p>Log in to the admin panel to manage this report.</p>
  `;

  const response = await fetch(
    "https://api.createsend.com/api/v3.3/transactional/classicemail/send",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${apiKey}:x`).toString("base64")}`,
      },
      body: JSON.stringify({
        To: adminEmail,
        From: adminEmail,
        Subject: subject,
        Html: html,
        ConsentToTrack: "Unchanged",
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Campaign Monitor error: ${response.status} ${text}`);
  }
}
