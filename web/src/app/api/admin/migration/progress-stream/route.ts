import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createSession } from "better-sse";
import { MigrationProgressEvent } from "@/types/nova-migration";

// Store sessions by sessionId for cross-request communication
const sessions = new Map<string, any>();

export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get session ID from query params
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // Create response with appropriate headers for SSE
    const responseInit: ResponseInit = {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disable Nginx buffering
        "Access-Control-Allow-Origin": "*",
      },
    };

    // Create a TransformStream for SSE
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Store the writer for this session
    sessions.set(sessionId, writer);

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
        sessions.delete(sessionId);
      }
    }, 30000); // Ping every 30 seconds

    // Clean up on disconnect
    request.signal.addEventListener("abort", () => {
      clearInterval(pingInterval);
      sessions.delete(sessionId);
      writer.close().catch(() => {});
      console.log(`[SSE] Session ${sessionId} disconnected`);
    });

    console.log(`[SSE] New session connected: ${sessionId}`);

    return new Response(stream.readable, responseInit);
  } catch (error) {
    console.error("SSE connection error:", error);
    return NextResponse.json(
      { error: "Failed to establish SSE connection" },
      { status: 500 }
    );
  }
}

// Helper function to send progress updates (called from other endpoints)
export async function sendProgress(
  sessionId: string,
  data: Partial<MigrationProgressEvent>
) {
  const writer = sessions.get(sessionId);

  if (!writer) {
    console.log(`[SSE] No active session for ${sessionId}`);
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const event: MigrationProgressEvent = {
      ...data,
      timestamp: new Date().toISOString(),
    } as MigrationProgressEvent;

    // Format as SSE event
    const message = `data: ${JSON.stringify(event)}\n\n`;

    await writer.write(encoder.encode(message));

    console.log(`[SSE] Sent ${data.type || "progress"} event to session ${sessionId}`);
    return true;
  } catch (error) {
    console.error(`[SSE] Failed to send to session ${sessionId}:`, error);
    sessions.delete(sessionId); // Remove dead session
    return false;
  }
}

// Export for use in other migration endpoints
export { sessions as migrationSessions };