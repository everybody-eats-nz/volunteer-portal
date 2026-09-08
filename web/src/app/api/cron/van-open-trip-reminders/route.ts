import { NextResponse } from "next/server";
import { remindLeftOpenTrips } from "@/lib/van/reminders";

/**
 * GET /api/cron/van-open-trip-reminders
 *
 * Nudges drivers whose trip is still open. Runs hourly; the job itself decides
 * whether the hour is a civilised one to push at, so the schedule does not
 * have to encode NZ daylight saving.
 *
 * Secured via CRON_SECRET, like the other cron routes.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await remindLeftOpenTrips();
  console.log(
    `[cron] Van trips left open: ${result.found} found, ${result.sent} reminded` +
      (result.skipped ? ` (${result.skipped})` : "")
  );

  return NextResponse.json(result);
}
