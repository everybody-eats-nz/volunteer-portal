import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import {
  saveYearInReviewSettings,
  selectableYears,
} from "@/lib/year-in-review-settings";
import { countYearInReviewPeople } from "@/lib/year-in-review.server";

const settingsSchema = z.object({
  enabled: z.boolean(),
  year: z.number().int(),
});

/**
 * PUT /api/admin/year-in-review
 *
 * Switches the Year in mahi video on or off for everyone and picks its year.
 * Returns how many people have a video for that year.
 */
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !selectableYears().includes(parsed.data.year)) {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }

  await saveYearInReviewSettings(parsed.data, session.user.id);
  const people = await countYearInReviewPeople(parsed.data.year);

  return NextResponse.json({ settings: parsed.data, people });
}
