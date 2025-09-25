import { NextRequest } from "next/server";
import { notificationSSEManager } from "@/lib/notification-sse-manager";
import {
  validateSSERequest,
  getSSEHeaders,
  checkRateLimit,
  validateConnectionToken
} from "@/lib/sse-security";

export async function GET(request: NextRequest) {
  try {
    // Validate session and get secure headers
    const validation = await validateSSERequest(request);

    if (!validation.isValid) {
      return new Response(validation.error || "Unauthorized", {
        status: 401,
        headers: validation.headers,
      });
    }

    const { userId, userRole } = validation;

    if (!userId) {
      return new Response("Invalid session", {
        status: 401,
        headers: validation.headers,
      });
    }

    // Rate limiting per user
    const rateLimitKey = `sse-notifications:${userId}`;
    if (!checkRateLimit(rateLimitKey, 5, 60000)) { // 5 connections per minute
      return new Response("Rate limit exceeded", {
        status: 429,
        headers: validation.headers,
      });
    }

    // Check for optional connection token (for enhanced security)
    const url = new URL(request.url);
    const connectionToken = url.searchParams.get("token");
    const sessionId = url.searchParams.get("sessionId") || `session-${Date.now()}`;

    // Validate token if provided (optional for backward compatibility)
    if (connectionToken && !validateConnectionToken(connectionToken, userId, sessionId)) {
      return new Response("Invalid connection token", {
        status: 403,
        headers: validation.headers,
      });
    }

    // Create response with secure headers
    const responseHeaders = getSSEHeaders(validation.headers);

    // Create a TransformStream for SSE using Better-SSE approach
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Register the connection with our Better-SSE notification manager
    const validRole = userRole === "ADMIN" || userRole === "VOLUNTEER" ? userRole : undefined;
    notificationSSEManager.addConnection(userId, writer, validRole);

    // Send initial connection event
    await writer.write(
      encoder.encode(
        `data: ${JSON.stringify({
          type: "connected",
          userId,
          role: validRole,
          timestamp: Date.now(),
        })}\n\n`
      )
    );

    // Keep connection alive with periodic pings
    const pingInterval = setInterval(async () => {
      try {
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "heartbeat",
              timestamp: Date.now(),
            })}\n\n`
          )
        );
      } catch (error) {
        clearInterval(pingInterval);
        notificationSSEManager.removeConnection(userId, writer);
      }
    }, 30000); // Ping every 30 seconds

    // Clean up on disconnect
    request.signal.addEventListener("abort", () => {
      clearInterval(pingInterval);
      notificationSSEManager.removeConnection(userId, writer);
      writer.close().catch(() => {});
      console.log(`[SSE] Notification stream disconnected for user ${userId} (${validRole || "unknown role"})`);
    });

    console.log(`[SSE] New notification stream connected for user ${userId} (${validRole || "unknown role"})`);

    return new Response(stream.readable, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("SSE notification connection error:", error);
    return new Response("Failed to establish SSE connection", { status: 500 });
  }
}
