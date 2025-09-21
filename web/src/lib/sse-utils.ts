import { MigrationProgressEvent } from "@/types/nova-migration";

// Store for SSE connections
const connections = new Map<string, ReadableStreamDefaultController>();
const progressData = new Map<string, MigrationProgressEvent>();

/**
 * Registers an SSE connection for a given session ID
 * @param sessionId - Unique identifier for the migration session
 * @param controller - ReadableStreamDefaultController for the SSE connection
 */
export function registerConnection(
  sessionId: string,
  controller: ReadableStreamDefaultController
) {
  connections.set(sessionId, controller);
}

/**
 * Removes an SSE connection for a given session ID
 * @param sessionId - Unique identifier for the migration session
 */
export function removeConnection(sessionId: string) {
  connections.delete(sessionId);
  progressData.delete(sessionId);
}

/**
 * Gets stored progress data for a session
 * @param sessionId - Unique identifier for the migration session
 * @returns Stored progress data or undefined if none exists
 */
export function getProgressData(
  sessionId: string
): MigrationProgressEvent | undefined {
  return progressData.get(sessionId);
}

/**
 * Stores progress data for a session
 * @param sessionId - Unique identifier for the migration session
 * @param data - Progress event data to store
 */
export function setProgressData(
  sessionId: string,
  data: MigrationProgressEvent
) {
  progressData.set(sessionId, data);
}

/**
 * Sends progress updates to connected SSE clients
 * @param sessionId - Unique identifier for the migration session
 * @param data - Partial progress event data to send
 */
export function sendProgress(
  sessionId: string,
  data: Partial<MigrationProgressEvent>
) {
  console.log(`[SSE-UTILS] Looking for connection for session: ${sessionId}`);
  console.log(`[SSE-UTILS] Active connections: ${connections.size}`);

  const controller = connections.get(sessionId);
  if (controller) {
    console.log(
      `[SSE-UTILS] Found controller, sending data:`,
      data.message || data.type
    );

    // Store progress data
    const progressEvent: MigrationProgressEvent = {
      ...data,
      timestamp: new Date().toISOString(),
    } as MigrationProgressEvent;
    progressData.set(sessionId, progressEvent);

    try {
      // Send data to SSE stream
      const event = `data: ${JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
      })}\n\n`;
      controller.enqueue(new TextEncoder().encode(event));
      console.log(
        `[SSE-UTILS] Successfully sent progress update for ${sessionId}`
      );
    } catch (e) {
      console.error(
        `[SSE-UTILS] Failed to send progress update for ${sessionId}:`,
        e
      );
      // Remove dead connection
      connections.delete(sessionId);
    }
  } else {
    console.log(`[SSE-UTILS] No controller found for session ${sessionId}`);
  }
}

/**
 * Gets the number of active SSE connections
 * @returns Number of active connections
 */
export function getConnectionCount(): number {
  return connections.size;
}
