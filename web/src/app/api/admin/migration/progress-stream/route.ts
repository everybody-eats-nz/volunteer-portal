import { NextRequest, NextResponse } from "next/server";
import { addMigrationSession, removeMigrationSession } from "@/lib/migration-sse-utils";
import {
  validateSSERequest,
  getSSEHeaders,
  checkRateLimit,
  validateConnectionToken
} from "@/lib/sse-security";

export async function GET(request: NextRequest) {
  try {
    // Validate session with admin role requirement
    const validation = await validateSSERequest(request, "ADMIN");

    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error || "Unauthorized" },
        { status: 401, headers: validation.headers }
      );
    }

    const { userId } = validation;

    if (!userId) {
      return NextResponse.json(
        { error: "Invalid admin session" },
        { status: 401, headers: validation.headers }
      );
    }

    // Get session ID from query params
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    const connectionToken = url.searchParams.get("token");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400, headers: validation.headers }
      );
    }

    // Rate limiting for migration streams (more restrictive)
    const rateLimitKey = `sse-migration:${userId}`;
    if (!checkRateLimit(rateLimitKey, 3, 60000)) { // 3 migration streams per minute
      return NextResponse.json(
        { error: "Migration stream rate limit exceeded" },
        { status: 429, headers: validation.headers }
      );
    }

    // Validate connection token if provided
    if (connectionToken && !validateConnectionToken(connectionToken, userId, sessionId)) {
      return NextResponse.json(
        { error: "Invalid migration connection token" },
        { status: 403, headers: validation.headers }
      );
    }

    // Create response with secure headers
    const responseHeaders = getSSEHeaders(validation.headers);

    // Create a TransformStream for SSE
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Store the writer for this session
    addMigrationSession(sessionId, writer);

    // Send initial connection event
    writer.write(
      encoder.encode(
        `data: ${JSON.stringify({
          type: "connected",
          message: "Progress stream connected",
          timestamp: new Date().toISOString(),
        })}\n\n`
      )
    );

    // Keep connection alive with periodic pings
    const pingInterval = setInterval(async () => {
      try {
        await writer.write(encoder.encode(":ping\n\n"));
      } catch (error) {
        clearInterval(pingInterval);
        removeMigrationSession(sessionId);
      }
    }, 30000); // Ping every 30 seconds

    // Clean up on disconnect
    request.signal.addEventListener("abort", () => {
      clearInterval(pingInterval);
      removeMigrationSession(sessionId);
      writer.close().catch(() => {});
      console.log(`[SSE] Session ${sessionId} disconnected`);
    });

    console.log(`[SSE] New session connected: ${sessionId}`);

    return new Response(stream.readable, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("SSE connection error:", error);
    return NextResponse.json(
      { error: "Failed to establish SSE connection" },
      { status: 500 }
    );
  }
}
