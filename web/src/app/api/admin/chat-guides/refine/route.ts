import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { resolveChatModel } from "@/lib/chat-model";

const REFINE_SYSTEM_PROMPT = `You clean up raw, imported web page or PDF text into concise knowledge-base content for an AI volunteer assistant.

Rules:
- Remove navigation menus, buttons, cookie/boilerplate text, repeated whitespace, stray quote/encoding artifacts, and broken mid-sentence line breaks.
- PRESERVE every factual detail exactly as written: names, roles, addresses, phone numbers, email addresses, opening hours, dates, policies, and prices. Never drop or alter a fact.
- Organise the result into clean, readable Markdown — short headings and bullet lists where they help.
- Do NOT invent information, summarise away detail, or add any commentary.
- Output ONLY the refined content, with no preamble or closing remarks.`;

// POST /api/admin/chat-guides/refine — clean raw imported/scraped text via the AI model
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { content, title } = body as { content?: string; title?: string };

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 },
      );
    }

    const modelSetting = await prisma.siteSetting.findUnique({
      where: { key: "CHAT_MODEL" },
    });
    const modelId = resolveChatModel(
      modelSetting?.value,
      process.env.OPENROUTER_MODEL,
    );

    const { text } = await generateText({
      model: openrouter(modelId),
      system: REFINE_SYSTEM_PROMPT,
      prompt: title
        ? `Title: ${title}\n\nRaw content to refine:\n\n${content}`
        : `Raw content to refine:\n\n${content}`,
    });

    const refined = text.trim();
    if (!refined) {
      return NextResponse.json(
        { error: "The model returned an empty result — try again" },
        { status: 502 },
      );
    }

    return NextResponse.json({ refined });
  } catch (error) {
    console.error("Chat guide refine error:", error);
    return NextResponse.json(
      { error: "Failed to refine content" },
      { status: 500 },
    );
  }
}
