import { generateText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { prisma } from "@/lib/prisma";
import { resolveChatModel } from "@/lib/chat-model";

const REFINE_SYSTEM_PROMPT = `You clean up raw, imported web page or PDF text into concise knowledge-base content for an AI volunteer assistant.

Rules:
- Remove navigation menus, buttons, cookie/boilerplate text, repeated whitespace, stray quote/encoding artifacts, and broken mid-sentence line breaks.
- PRESERVE every factual detail exactly as written: names, roles, addresses, phone numbers, email addresses, opening hours, dates, policies, and prices. Never drop or alter a fact.
- Organise the result into clean, readable Markdown — short headings and bullet lists where they help.
- Do NOT invent information, summarise away detail, or add any commentary.
- Output ONLY the refined content, with no preamble or closing remarks.`;

/**
 * Clean raw scraped/imported text into knowledge-base Markdown using the
 * configured chat model. Shared by the admin refine endpoint and the nightly
 * website-content refresh cron. Returns the refined text, or null if the
 * model returned nothing.
 */
export async function refineContent(
  content: string,
  title?: string,
  options: { distinctId?: string } = {},
): Promise<string | null> {
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
    experimental_telemetry: {
      isEnabled: true,
      functionId: "chat-guide-refine",
      // Anonymous when run by the refresh cron
      metadata: options.distinctId
        ? { posthog_distinct_id: options.distinctId }
        : {},
    },
  });

  const refined = text.trim();
  return refined || null;
}
