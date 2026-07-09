import { NextResponse } from "next/server";
import { streamText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildChatSystemMessages,
  getStaticChatContext,
  getVolunteerChatContext,
} from "@/lib/chat-context";

// Streaming a long answer can exceed the default 30s API budget
export const maxDuration = 90;

/* ─── Validation ──────────────────────────────────────────────── */

// Roles are restricted to user/assistant so a client can never inject its own
// system messages; lengths are capped server-side (the app's input caps are
// advisory only). The content cap allows for long assistant answers replayed
// in the history; the app caps user input at 1000 chars.
const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
});

// Only the most recent turns are sent to the model, so long conversations
// don't grow token usage without bound.
const MAX_HISTORY_MESSAGES = 20;

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 30,
});

/* ─── POST handler ────────────────────────────────────────────── */

/**
 * POST /api/mobile/chat
 *
 * Streaming AI chat endpoint for the mobile app.
 * Static context (resources, locations, shift types, system prompt) is cached
 * for 5 min and sent with an Anthropic prompt-cache breakpoint; volunteer
 * context (name, upcoming shifts, achievements) is fetched per request.
 */
export async function POST(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = chatLimiter(`chat:${auth.userId}`);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many messages — please wait a few minutes and try again" },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((limit.resetTime - Date.now()) / 1000)),
          ),
        },
      },
    );
  }

  try {
    const parsed = chatRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid messages payload" },
        { status: 400 },
      );
    }
    const messages = parsed.data.messages.slice(-MAX_HISTORY_MESSAGES);

    const [staticCtx, volunteerContext] = await Promise.all([
      getStaticChatContext(),
      getVolunteerChatContext(auth.userId),
    ]);

    const modelId = staticCtx.modelId;
    console.log("[mobile-chat] Starting streamText", {
      modelId,
      hasApiKey: !!process.env.OPENROUTER_API_KEY,
      messageCount: messages.length,
    });

    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    const result = streamText({
      model: openrouter(modelId),
      messages: [
        ...buildChatSystemMessages(staticCtx, volunteerContext),
        ...messages,
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: "mobile-chat",
        metadata: { posthog_distinct_id: auth.userId },
      },
      onError: ({ error }) => {
        console.error("[mobile-chat] streamText error:", error);
      },
      onFinish: async ({ text }) => {
        try {
          await prisma.chatLog.create({
            data: {
              userId: auth.userId,
              userMessage: lastUserMessage,
              assistantResponse: text,
              conversation: messages,
              model: modelId,
            },
          });
        } catch (err) {
          console.error("[mobile-chat] Failed to write ChatLog:", err);
        }
      },
    });

    // Keep generating server-side even if the app disconnects mid-stream, so
    // onFinish always runs and the ChatLog is never silently dropped.
    result.consumeStream();

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 },
    );
  }
}
