import { MigrationProgressEvent } from "@/types/nova-migration";

// Store sessions by sessionId for cross-request communication
const sessions = new Map<string, WritableStreamDefaultWriter>();

// Helper function to send progress updates (called from other endpoints)
export async function sendProgress(
  sessionId: string,
  data: Partial<MigrationProgressEvent>
): Promise<boolean> {
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

    console.log(
      `[SSE] Sent ${data.type || "progress"} event to session ${sessionId}`
    );
    return true;
  } catch (error) {
    console.error(`[SSE] Failed to send to session ${sessionId}:`, error);
    sessions.delete(sessionId); // Remove dead session
    return false;
  }
}

// Export sessions for external access
export function addMigrationSession(sessionId: string, writer: WritableStreamDefaultWriter) {
  sessions.set(sessionId, writer);
}

export function removeMigrationSession(sessionId: string) {
  sessions.delete(sessionId);
}

export function getMigrationSessionCount(): number {
  return sessions.size;
}