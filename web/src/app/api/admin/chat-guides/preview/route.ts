import { NextResponse } from "next/server";
import { streamText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth-options";
import { resolveChatModel } from "@/lib/chat-model";
import {
  buildChatSystemMessages,
  getStaticChatContext,
  getVolunteerChatContext,
} from "@/lib/chat-context";

// Streaming a long answer can exceed the default 30s API budget
export const maxDuration = 90;

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

const previewRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
  model: z.string().optional(),
});

/**
 * POST /api/admin/chat-guides/preview
 *
 * Admin-only chat preview endpoint. Uses NextAuth session instead of JWT.
 * Builds context through the same shared helpers as the mobile endpoint
 * (static knowledge base + the admin's own volunteer context), so what admins
 * test is exactly what volunteers get.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const parsed = previewRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid messages payload" },
        { status: 400 },
      );
    }
    const { messages, model: modelOverride } = parsed.data;

    // fresh: admins iterate on the prompt and expect the preview to reflect
    // their edits immediately, not after the 5-min cache expires.
    const [staticCtx, volunteerContext] = await Promise.all([
      getStaticChatContext({ fresh: true }),
      getVolunteerChatContext(session.user.id),
    ]);

    // A per-request override (from the preview model picker) wins, so admins
    // can A/B models without changing the saved CHAT_MODEL setting.
    const modelId = resolveChatModel(modelOverride, staticCtx.modelId);
    console.log("[chat-preview] Starting streamText", {
      modelId,
      hasApiKey: !!process.env.OPENROUTER_API_KEY,
      messageCount: messages.length,
    });

    const result = streamText({
      model: openrouter(modelId),
      messages: [
        ...buildChatSystemMessages(staticCtx, volunteerContext),
        ...messages,
      ],
      experimental_telemetry: {
        isEnabled: true,
        functionId: "chat-guides-preview",
        metadata: { posthog_distinct_id: session.user.id },
      },
      onError: ({ error }) => {
        console.error("[chat-preview] streamText error:", error);
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Chat preview error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 },
    );
  }
}
