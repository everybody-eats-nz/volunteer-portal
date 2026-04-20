import { prisma } from "@/lib/prisma";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_CHUNK = 100; // Expo's per-request message limit

export interface ExpoPushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
}

interface ExpoPushMessage extends ExpoPushPayload {
  to: string;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoPushResponse {
  data?: ExpoPushTicket[];
  errors?: { message: string }[];
}

/**
 * Send a push notification to every registered device for the given user.
 * Invalid tokens are removed from the database so future sends skip them.
 */
export async function sendPushToUser(
  userId: string,
  payload: ExpoPushPayload
): Promise<void> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId },
    select: { token: true },
  });

  if (tokens.length === 0) return;

  await sendPushToTokens(
    tokens.map((t) => t.token),
    payload
  );
}

/**
 * Send a push notification to a raw list of Expo tokens.
 * Handles chunking, Expo ticket errors, and invalid-token cleanup.
 */
export async function sendPushToTokens(
  tokens: string[],
  payload: ExpoPushPayload
): Promise<void> {
  const valid = tokens.filter(isExpoPushToken);
  if (valid.length === 0) return;

  const messages: ExpoPushMessage[] = valid.map((token) => ({
    to: token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: payload.sound === null ? undefined : "default",
    badge: payload.badge,
    // Android notification channel (configured on the client side)
    channelId: payload.channelId ?? "default",
  }));

  const invalidTokens: string[] = [];

  for (let i = 0; i < messages.length; i += MAX_CHUNK) {
    const chunk = messages.slice(i, i + MAX_CHUNK);

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        console.error(
          `[EXPO_PUSH] HTTP ${response.status} sending chunk of ${chunk.length}`
        );
        continue;
      }

      const json = (await response.json()) as ExpoPushResponse;
      const tickets = json.data ?? [];

      tickets.forEach((ticket, index) => {
        if (ticket.status === "error") {
          const code = ticket.details?.error;
          const token = chunk[index].to;
          console.warn(
            `[EXPO_PUSH] Ticket error (${code ?? "unknown"}) for token ${token}: ${ticket.message}`
          );
          if (
            code === "DeviceNotRegistered" ||
            code === "InvalidCredentials"
          ) {
            invalidTokens.push(token);
          }
        }
      });
    } catch (err) {
      console.error("[EXPO_PUSH] Fetch failed:", err);
    }
  }

  if (invalidTokens.length > 0) {
    await prisma.pushToken
      .deleteMany({ where: { token: { in: invalidTokens } } })
      .catch((err) =>
        console.error("[EXPO_PUSH] Failed to cleanup invalid tokens:", err)
      );
  }
}

export function isExpoPushToken(token: string): boolean {
  return (
    typeof token === "string" &&
    (token.startsWith("ExponentPushToken[") ||
      token.startsWith("ExpoPushToken["))
  );
}
