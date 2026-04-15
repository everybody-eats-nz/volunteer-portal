import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

/**
 * POST /api/mobile/users/[id]/block
 *
 * Blocks a user. The blocked user's content is immediately hidden from the
 * blocker's feed and comments. Notifies admin as required by Apple Guideline 1.2.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;
  const { id: blockedId } = await params;

  if (!blockedId || blockedId === userId) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  // Confirm target user exists
  const target = await prisma.user.findUnique({
    where: { id: blockedId },
    select: { id: true, firstName: true, name: true, email: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Upsert block (idempotent)
  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: userId, blockedId } },
    update: {},
    create: { blockerId: userId, blockedId },
  });

  // Notify admin asynchronously
  notifyAdminOfBlock(userId, blockedId, target).catch((err) => {
    console.error("[block] Admin notification failed:", err);
  });

  return NextResponse.json({ ok: true, blocked: true });
}

/**
 * DELETE /api/mobile/users/[id]/block
 *
 * Unblocks a previously blocked user.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = auth;
  const { id: blockedId } = await params;

  await prisma.userBlock
    .delete({
      where: { blockerId_blockedId: { blockerId: userId, blockedId } },
    })
    .catch(() => {
      // Already unblocked — ignore
    });

  return NextResponse.json({ ok: true, blocked: false });
}

async function notifyAdminOfBlock(
  blockerId: string,
  blockedId: string,
  blockedUser: { firstName: string | null; name: string | null; email: string }
) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  const apiKey = process.env.CAMPAIGN_MONITOR_API_KEY;

  const blockedName =
    blockedUser.firstName ?? blockedUser.name ?? blockedUser.email;

  if (!adminEmail) {
    console.log(
      `[block] User ${blockerId} blocked ${blockedId} (${blockedName}). Set ADMIN_NOTIFICATION_EMAIL to receive alerts.`
    );
    return;
  }

  if (!apiKey || apiKey === "dummy-key-for-dev") {
    console.log(
      `[block] Would email ${adminEmail}: User block — ${blockerId} blocked ${blockedName} (dev mode)`
    );
    return;
  }

  const subject = `[Everybody Eats] User blocked — action may be required`;
  const html = `
    <p>A volunteer has blocked another user.</p>
    <ul>
      <li><strong>Blocked user:</strong> ${blockedName} (ID: ${blockedId})</li>
      <li><strong>Blocked by:</strong> User ID ${blockerId}</li>
      <li><strong>Time:</strong> ${new Date().toISOString()}</li>
    </ul>
    <p>If this is a result of abusive behaviour, please review and take action within 24 hours.</p>
    <p>This block is in effect and the blocked user's content is already hidden from the reporter's feed.</p>
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
