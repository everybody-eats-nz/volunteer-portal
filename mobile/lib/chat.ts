import * as SecureStore from "expo-secure-store";
import { fetch as expoFetch } from "expo/fetch";
import { API_URL } from "./api";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type StreamCallbacks = {
  onStart: () => void;
  onToken: (token: string) => void;
  onFinish: () => void;
  /** Called when the request or stream fails. `status` is the HTTP status when the server responded. */
  onError: (error: string, status?: number) => void;
};

/**
 * Stream a chat response from the AI assistant.
 * Uses expo/fetch which supports ReadableStream (RN's built-in fetch does not).
 *
 * Pass an AbortSignal to cancel mid-stream (stop button / screen unmount).
 * An abort is a deliberate user action, not a failure: the partial response
 * is kept and onFinish is called.
 */
export async function chatWithAssistant(
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const token = await SecureStore.getItemAsync("auth_token");

  let response: Awaited<ReturnType<typeof expoFetch>>;
  try {
    response = await expoFetch(`${API_URL}/api/mobile/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) return;
    callbacks.onError(
      error instanceof Error ? error.message : "Request failed"
    );
    return;
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Request failed");
    callbacks.onError(errorBody, response.status);
    return;
  }

  callbacks.onStart();

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError("No response stream available");
    return;
  }

  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        callbacks.onToken(chunk);
      }
    }
  } catch (error) {
    // A user-initiated stop surfaces as a read error — keep what streamed.
    if (signal?.aborted) {
      callbacks.onFinish();
      return;
    }
    callbacks.onError(
      error instanceof Error ? error.message : "Stream reading failed"
    );
    return;
  }

  callbacks.onFinish();
}
