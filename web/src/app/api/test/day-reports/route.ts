import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Test-only endpoint: delete every day report (and, by cascade, its event
 * income and expenses) at one location, so e2e tests leave no records behind.
 * Only available in development/test environments.
 */
export async function DELETE(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const location = request.nextUrl.searchParams.get("location");
  if (!location) {
    return NextResponse.json(
      { error: "Location parameter required" },
      { status: 400 }
    );
  }

  const { count } = await prisma.mealsServed.deleteMany({
    where: { location },
  });
  return NextResponse.json({ deleted: count });
}
