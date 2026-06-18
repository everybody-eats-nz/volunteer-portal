import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Liveness probe for container orchestration (Coolify/Docker healthchecks).
 * Intentionally does not touch the database: a DB outage should surface as
 * application errors, not as a container restart loop.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
