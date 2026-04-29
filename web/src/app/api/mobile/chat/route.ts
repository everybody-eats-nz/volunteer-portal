import { NextResponse } from "next/server";
import { streamText } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { isFeatureEnabled, FeatureFlag } from "@/lib/posthog-server";

const DEFAULT_SYSTEM_PROMPT = `You are a friendly and helpful volunteer assistant for Everybody Eats, a charitable restaurant in Aotearoa New Zealand that serves free meals to the community. Your name is EE Assistant.

Key guidelines:
- Be warm, encouraging, and supportive — volunteers are giving their time for free
- Weave in te reo Māori naturally: "Kia ora", "ka pai" (well done), "whānau" (family/community), "mahi" (work), "ngā mihi" (thanks)
- Answer questions based ONLY on the knowledge base provided below
- If you don't know something or it's not in the knowledge base, say so honestly and suggest they contact the team directly
- Keep answers concise but thorough — volunteers are often on mobile
- Use emojis sparingly for warmth 🌿
- When volunteers ask what it's like to volunteer or want to see more, share the social media links below

Social media & links:
- Website: https://everybodyeats.nz
- Instagram: https://instagram.com/everybodyeatsnz
- Facebook: https://facebook.com/EverybodyEatsNZ`;

/* ─── Cached static context (shared across all users) ─────────── */

type StaticContext = {
  systemPrompt: string;
  resourceContext: string;
  locationsContext: string;
  shiftTypesContext: string;
  communityStatsContext: string;
  fetchedAt: number;
};

let staticCache: StaticContext | null = null;
const STATIC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getStaticContext(): Promise<StaticContext> {
  if (staticCache && Date.now() - staticCache.fetchedAt < STATIC_CACHE_TTL_MS) {
    return staticCache;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [resources, promptSetting, locations, shiftTypes, totalVolunteers, recentMeals, totalMeals, recentShiftCount] =
    await Promise.all([
      prisma.resource.findMany({
        where: { includeInChat: true, isPublished: true, chatContent: { not: null } },
        select: { title: true, category: true, chatContent: true },
        orderBy: { category: "asc" },
      }),
      prisma.siteSetting.findUnique({ where: { key: "CHAT_SYSTEM_PROMPT" } }),
      prisma.location.findMany({
        where: { isActive: true },
        select: { name: true, address: true, defaultMealsServed: true },
      }),
      prisma.shiftType.findMany({
        select: { name: true, description: true },
      }),
      prisma.user.count({ where: { role: "VOLUNTEER" } }),
      prisma.mealsServed.aggregate({
        where: {
          date: { gte: thirtyDaysAgo },
          mealsServed: { not: null },
        },
        _sum: { mealsServed: true },
        _count: true,
      }),
      prisma.mealsServed.aggregate({
        where: { mealsServed: { not: null } },
        _sum: { mealsServed: true },
      }),
      // Count recent shifts for fallback estimate
      prisma.shift.count({
        where: { start: { gte: thirtyDaysAgo }, end: { lt: new Date() } },
      }),
    ]);

  const resourceContext = resources
    .map((r) => `## ${r.title} (${r.category})\n${r.chatContent}`)
    .join("\n\n");

  const locationsContext =
    "## Kitchen Locations\n" +
    locations.map((l) => `- ${l.name}: ${l.address}`).join("\n");

  const shiftTypesContext =
    "## Shift Roles\n" +
    shiftTypes
      .map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ""}`)
      .join("\n");

  // Use recorded meals data, but fall back to defaultMealsServed * shift count if data is sparse
  const avgDefault = locations.length > 0
    ? Math.round(locations.reduce((s, l) => s + l.defaultMealsServed, 0) / locations.length)
    : 60;

  const hasRecordedMeals = (recentMeals._sum.mealsServed ?? 0) > 0;
  const recentMealsEstimate = hasRecordedMeals
    ? recentMeals._sum.mealsServed!
    : recentShiftCount * avgDefault;
  const totalMealsEstimate = (totalMeals._sum.mealsServed ?? 0) || 0;

  const avgPerService = hasRecordedMeals && recentMeals._count > 0
    ? Math.round(recentMeals._sum.mealsServed! / recentMeals._count)
    : avgDefault;

  const communityStatsContext = [
    "## Community Impact",
    `Total volunteers in the whānau: ${totalVolunteers}`,
    totalMealsEstimate > 0
      ? `Total meals served (all time): ~${totalMealsEstimate.toLocaleString()}`
      : null,
    `Meals served in the last 30 days: ~${recentMealsEstimate.toLocaleString()}${!hasRecordedMeals ? " (estimated)" : ""}`,
    `Average meals per service: ~${avgPerService}`,
  ]
    .filter(Boolean)
    .join("\n");

  staticCache = {
    systemPrompt: promptSetting?.value || DEFAULT_SYSTEM_PROMPT,
    resourceContext,
    locationsContext,
    shiftTypesContext,
    communityStatsContext,
    fetchedAt: Date.now(),
  };

  return staticCache;
}

/* ─── Types ───────────────────────────────────────────────────── */

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/* ─── POST handler ────────────────────────────────────────────── */

/**
 * POST /api/mobile/chat
 *
 * Streaming AI chat endpoint for the mobile app.
 * Static context (resources, locations, shift types, system prompt) is cached for 5 min.
 */
export async function POST(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = await isFeatureEnabled(FeatureFlag.CHAT_GUIDES, auth.userId);
  if (!enabled) {
    return NextResponse.json({ error: "Chat guides not enabled" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { messages } = body as { messages: ChatMessage[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 },
      );
    }

    const staticCtx = await getStaticContext();

    const dynamicContext = [
      staticCtx.locationsContext,
      staticCtx.shiftTypesContext,
      staticCtx.communityStatsContext,
    ]
      .filter(Boolean)
      .join("\n\n");

    const systemPrompt =
      staticCtx.systemPrompt +
      "\n\n" +
      dynamicContext +
      "\n\nHere is your knowledge base:\n---\n" +
      staticCtx.resourceContext +
      "\n---";

    // Stream response from OpenRouter
    const modelId = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4";
    console.log("[mobile-chat] Starting streamText", {
      modelId,
      hasApiKey: !!process.env.OPENROUTER_API_KEY,
      messageCount: messages.length,
      systemPromptLength: systemPrompt.length,
    });

    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    const result = streamText({
      model: openrouter(modelId),
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
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

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 },
    );
  }
}
