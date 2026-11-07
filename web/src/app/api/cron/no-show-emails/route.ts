import { NextResponse } from "next/server";

import { sendDueNoShowEmails } from "@/lib/no-show-emails.server";

/**
 * GET /api/cron/no-show-emails
 *
 * Sends the no-show follow-up email for shifts that have finished. Marking a
 * no-show only queues it (see no-show-emails.server.ts), so this has to run
 * for the email to go out at all. Every 15 minutes is plenty.
 *
 * Secured via CRON_SECRET, like the other cron routes.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    console.error(
      "[cron] CRON_SECRET is not set - no-show emails will never be sent"
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDueNoShowEmails();
  console.log(
    `[cron] No-show emails: ${result.sent} sent, ${result.failed} failed${
      result.skippedReason ? ` (skipped: ${result.skippedReason})` : ""
    }`
  );
  return NextResponse.json(result);
}
