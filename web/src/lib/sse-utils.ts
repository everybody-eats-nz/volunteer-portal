import { MigrationProgressEvent } from "@/types/nova-migration";

// Import the sendProgress function from the migration SSE utils
import { sendProgress as sendProgressToStream } from "./migration-sse-utils";

/**
 * Sends progress updates to connected SSE clients using better-sse
 * @param sessionId - Unique identifier for the migration session
 * @param data - Partial progress event data to send
 */
export async function sendProgress(
  sessionId: string,
  data: Partial<MigrationProgressEvent>
) {
  console.log(`[SSE-UTILS] Sending progress for session: ${sessionId}`);
  console.log(`[SSE-UTILS] Event type: ${data.type}, message: ${data.message}`);

  // Send to the better-sse stream
  try {
    const success = await sendProgressToStream(sessionId, data);

    if (success) {
      console.log(`[SSE-UTILS] Successfully sent progress update for ${sessionId}`);
    } else {
      console.log(`[SSE-UTILS] No active stream for session ${sessionId}`);
    }
  } catch (error) {
    console.error(`[SSE-UTILS] Failed to send progress update:`, error);
  }
}
