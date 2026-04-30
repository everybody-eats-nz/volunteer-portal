import * as SecureStore from "expo-secure-store";
import { fetch as expoFetch } from "expo/fetch";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://volunteers.everybodyeats.nz";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type StreamCallbacks = {
  onStart: () => void;
  onToken: (token: string) => void;
  onFinish: () => void;
  onError: (error: string) => void;
};

/**
 * Stream a chat response from the AI assistant.
 * Uses expo/fetch which supports ReadableStream (RN's built-in fetch does not).
 */
export async function chatWithAssistant(
  messages: ChatMessage[],
  callbacks: StreamCallbacks
): Promise<void> {
  const token = await SecureStore.getItemAsync("auth_token");

  const response = await expoFetch(`${API_URL}/api/mobile/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Request failed");
    callbacks.onError(errorBody);
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
    callbacks.onError(
      error instanceof Error ? error.message : "Stream reading failed"
    );
    return;
  }

  callbacks.onFinish();
}
