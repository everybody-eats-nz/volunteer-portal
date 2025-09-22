import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { notificationSSEManager } from "@/lib/notification-sse-manager";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = session.user?.id;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
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
        "Access-Control-Allow-Headers": "Cache-Control, Content-Type",
      },
    };

    // Create a TransformStream for SSE
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Register the connection with our notification manager
    notificationSSEManager.addConnection(userId, writer);

    // Send initial connection event
    await writer.write(
      encoder.encode(
        `data: ${JSON.stringify({
          type: "connected",
          userId,
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
      console.log(`[SSE] Notification stream disconnected for user ${userId}`);
    });

    console.log(`[SSE] New notification stream connected for user ${userId}`);

    return new Response(stream.readable, responseInit);
  } catch (error) {
    console.error("SSE notification connection error:", error);
    return new Response("Failed to establish SSE connection", { status: 500 });
  }
}