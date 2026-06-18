import { prisma } from "@/lib/prisma";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPT_URL = "https://exp.host/--/api/v2/push/getReceipts";
const MAX_CHUNK = 100; // Expo's per-request message limit

/**
 * Expo error codes we branch on. `DeviceNotRegistered` is the only one that
 * means the token is permanently dead; the credential codes point at a
 * server-side APNs/FCM misconfiguration and must NOT delete the token.
 */
const EXPO_ERROR = {
  DEVICE_NOT_REGISTERED: "DeviceNotRegistered",
  INVALID_CREDENTIALS: "InvalidCredentials",
  MISMATCH_SENDER_ID: "MismatchSenderId",
} as const;

/**
 * Required when the Expo project has "Enhanced Security for Push Notifications"
 * enabled — without it Expo rejects every send with a top-level error. Optional
 * otherwise. Set EXPO_ACCESS_TOKEN in the server environment if pushes silently
 * stop working after enabling enhanced security.
 */
const EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN;

function expoHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
  };
  if (EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`;
  }
  return headers;
}

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
 * Send a push notification to every registered device across a set of users,
 * in one batched Expo request (chunked to the 100-message limit).
 *
 * `badgeByUserId` lets callers set a per-user badge value (each recipient's
 * own unread count) while sharing a single payload. Falls back to
 * `payload.badge` when a user isn't in the map.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: ExpoPushPayload,
  badgeByUserId?: Map<string, number>
): Promise<void> {
  if (userIds.length === 0) return;

  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
    select: { token: true, userId: true },
  });

  if (tokens.length === 0) return;

  const messages = tokens
    .filter((t) => isExpoPushToken(t.token))
    .map((t) =>
      buildMessage(t.token, {
        ...payload,
        badge: badgeByUserId?.get(t.userId) ?? payload.badge,
      })
    );

  await dispatchMessages(messages);
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

  const messages: ExpoPushMessage[] = valid.map((token) =>
    buildMessage(token, payload)
  );

  await dispatchMessages(messages);
}

function buildMessage(
  token: string,
  payload: ExpoPushPayload
): ExpoPushMessage {
  return {
    to: token,
    title: payload.title,
    body: payload.body,
    data: payload.data,
    sound: payload.sound === null ? undefined : "default",
    badge: payload.badge,
    // Android notification channel (configured on the client side)
    channelId: payload.channelId ?? "default",
  };
}

async function dispatchMessages(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const invalidTokens: string[] = [];
  // Receipt id -> token, so a later receipt check can report which device a
  // delivery failure belongs to. Accepted tickets ("ok") only mean Expo queued
  // the push; APNs/FCM credential and delivery errors surface in the receipt.
  const receiptToToken = new Map<string, string>();
  let okCount = 0;
  let errorCount = 0;

  for (let i = 0; i < messages.length; i += MAX_CHUNK) {
    const chunk = messages.slice(i, i + MAX_CHUNK);

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: expoHeaders(),
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        console.error(
          `[EXPO_PUSH] HTTP ${response.status} sending chunk of ${chunk.length}`
        );
        continue;
      }

      const json = (await response.json()) as ExpoPushResponse;

      // Top-level errors mean the whole request was rejected (e.g. missing
      // access token when enhanced security is on, malformed payload). These
      // were previously dropped — making every device look "fine" while
      // nothing was ever delivered.
      if (json.errors?.length) {
        errorCount += chunk.length;
        console.error(
          `[EXPO_PUSH] Request rejected for chunk of ${chunk.length}:`,
          JSON.stringify(json.errors)
        );
        continue;
      }

      const tickets = json.data ?? [];

      tickets.forEach((ticket, index) => {
        const token = chunk[index].to;
        if (ticket.status === "error") {
          errorCount++;
          const code = ticket.details?.error;
          console.warn(
            `[EXPO_PUSH] Ticket error (${code ?? "unknown"}) for token ${token}: ${ticket.message}`
          );
          // Only DeviceNotRegistered means the token is permanently dead.
          // InvalidCredentials/MismatchSenderId are *server-side* push-credential
          // problems (APNs key / FCM sender) — deleting the token here would
          // wipe a perfectly valid device and mask the real misconfiguration.
          if (code === EXPO_ERROR.DEVICE_NOT_REGISTERED) {
            invalidTokens.push(token);
          } else if (
            code === EXPO_ERROR.INVALID_CREDENTIALS ||
            code === EXPO_ERROR.MISMATCH_SENDER_ID
          ) {
            console.error(
              `[EXPO_PUSH] Push credentials misconfigured (${code}) — check the project's APNs key / FCM credentials. Token kept.`
            );
          }
        } else {
          okCount++;
          if (ticket.id) receiptToToken.set(ticket.id, token);
        }
      });
    } catch (err) {
      console.error("[EXPO_PUSH] Fetch failed:", err);
    }
  }

  console.log(
    `[EXPO_PUSH] Dispatched ${messages.length} message(s): ${okCount} accepted, ${errorCount} error(s)`
  );

  if (invalidTokens.length > 0) {
    await prisma.pushToken
      .deleteMany({ where: { token: { in: invalidTokens } } })
      .catch((err) =>
        console.error("[EXPO_PUSH] Failed to cleanup invalid tokens:", err)
      );
  }

  // Fire-and-forget receipt check. Delivery-level failures (bad APNs/FCM
  // credentials, unregistered devices) only appear here, not in the send
  // response, so this is usually the only place "accepted but never arrived"
  // becomes visible. Runs on a long-lived server; harmless if it never
  // resolves.
  if (receiptToToken.size > 0) {
    void checkReceiptsLater(receiptToToken);
  }
}

/**
 * Poll Expo for delivery receipts after a short delay and log any errors.
 * Expo recommends waiting before fetching receipts; 15s is enough for most
 * pushes while keeping the diagnostic close to the triggering event.
 */
async function checkReceiptsLater(
  receiptToToken: Map<string, string>
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 15_000));

  const ids = [...receiptToToken.keys()];
  const deadTokens: string[] = [];

  try {
    const response = await fetch(EXPO_RECEIPT_URL, {
      method: "POST",
      headers: expoHeaders(),
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
      console.error(`[EXPO_PUSH] Receipt fetch HTTP ${response.status}`);
      return;
    }

    const json = (await response.json()) as {
      data?: Record<
        string,
        { status: "ok" | "error"; message?: string; details?: { error?: string } }
      >;
      errors?: { message: string }[];
    };

    if (json.errors?.length) {
      console.error(
        "[EXPO_PUSH] Receipt request error:",
        JSON.stringify(json.errors)
      );
      return;
    }

    for (const [id, receipt] of Object.entries(json.data ?? {})) {
      if (receipt.status === "error") {
        const code = receipt.details?.error;
        const token = receiptToToken.get(id);
        console.warn(
          `[EXPO_PUSH] Delivery failed (${code ?? "unknown"}) for token ${token}: ${receipt.message}`
        );
        if (code === EXPO_ERROR.DEVICE_NOT_REGISTERED && token) {
          deadTokens.push(token);
        } else if (
          code === EXPO_ERROR.INVALID_CREDENTIALS ||
          code === EXPO_ERROR.MISMATCH_SENDER_ID
        ) {
          console.error(
            `[EXPO_PUSH] Delivery rejected (${code}) — APNs/FCM push credentials are misconfigured for this project.`
          );
        }
      }
    }

    if (deadTokens.length > 0) {
      await prisma.pushToken
        .deleteMany({ where: { token: { in: deadTokens } } })
        .catch((err) =>
          console.error("[EXPO_PUSH] Failed to cleanup dead tokens:", err)
        );
    }
  } catch (err) {
    console.error("[EXPO_PUSH] Receipt check failed:", err);
  }
}

export function isExpoPushToken(token: string): boolean {
  return (
    typeof token === "string" &&
    (token.startsWith("ExponentPushToken[") ||
      token.startsWith("ExpoPushToken["))
  );
}
