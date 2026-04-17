import { NextRequest, NextResponse } from "next/server";
import { consumeExtensionToken } from "@/lib/archive-service";

/**
 * GET /api/archive/extend?token=...
 * Public endpoint — clicked from the 11-month warning email.
 * Extends the user's active status and redirects to a confirmation page.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(
      new URL("/archive/extended?status=invalid", request.url)
    );
  }

  const userId = await consumeExtensionToken(token);
  return NextResponse.redirect(
    new URL(
      `/archive/extended?status=${userId ? "success" : "invalid"}`,
      request.url
    )
  );
}
