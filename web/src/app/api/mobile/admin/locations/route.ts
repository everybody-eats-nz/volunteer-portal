import { NextResponse } from "next/server";
import { requireMobileAdmin } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/mobile/admin/locations
 *
 * The active restaurants, by name, for the admin location filter. Mirrors the
 * web `/api/admin/locations` route but is authed with the mobile JWT. Returns a
 * plain string list — the filter only ever sends the name back as `?location=`.
 */
export async function GET(req: Request) {
  const auth = await requireMobileAdmin(req);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const locations = await prisma.location.findMany({
    where: { isActive: true },
    select: { name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ locations: locations.map((l) => l.name) });
}
