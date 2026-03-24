import { NextResponse } from "next/server";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

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

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * POST /api/admin/chat-guides/preview
 *
 * Admin-only chat preview endpoint. Uses NextAuth session instead of JWT.
 * Builds the same context as the mobile endpoint so admins can test responses.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
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

    const userId = session.user.id;
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all context in parallel
    const [resources, promptSetting, volunteer, upcomingShifts, locations, shiftTypes, achievements, totalVolunteers, recentMeals] =
      await Promise.all([
        prisma.resource.findMany({
          where: { includeInChat: true, isPublished: true, chatContent: { not: null } },
          select: { title: true, category: true, chatContent: true },
          orderBy: { category: "asc" },
        }),
        prisma.siteSetting.findUnique({ where: { key: "CHAT_SYSTEM_PROMPT" } }),
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            firstName: true,
            name: true,
            volunteerGrade: true,
            availableDays: true,
            availableLocations: true,
          },
        }),
        prisma.signup.findMany({
          where: {
            userId,
            status: { in: ["CONFIRMED", "PENDING"] },
            shift: { start: { gte: now } },
          },
          select: {
            status: true,
            shift: {
              select: {
                start: true,
                end: true,
                location: true,
                shiftType: { select: { name: true } },
              },
            },
          },
          orderBy: { shift: { start: "asc" } },
          take: 10,
        }),
        prisma.location.findMany({
          where: { isActive: true },
          select: { name: true, address: true },
        }),
        prisma.shiftType.findMany({
          select: { name: true, description: true },
        }),
        prisma.userAchievement.findMany({
          where: { userId },
          select: {
            achievement: { select: { name: true, description: true } },
          },
          orderBy: { unlockedAt: "desc" },
          take: 10,
        }),
        prisma.user.count({ where: { role: "VOLUNTEER" } }),
        prisma.mealsServed.aggregate({
          where: { date: { gte: thirtyDaysAgo } },
          _sum: { mealsServed: true },
          _count: true,
        }),
      ]);

    const basePrompt = promptSetting?.value || DEFAULT_SYSTEM_PROMPT;

    // Build all context sections
    const resourceContext = resources
      .map((r) => `## ${r.title} (${r.category})\n${r.chatContent}`)
      .join("\n\n");

    const volunteerName = volunteer?.firstName || volunteer?.name || "Admin";
    const volunteerContext = [
      "## About This Volunteer",
      `Name: ${volunteerName}`,
      `Grade: ${volunteer?.volunteerGrade ?? "GREEN"} (GREEN = new, YELLOW = experienced, PINK = shift leader)`,
    ].join("\n");

    const shiftsContext =
      upcomingShifts.length > 0
        ? "## Your Upcoming Shifts\n" +
          upcomingShifts
            .map((s) => {
              const date = s.shift.start.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" });
              const time = s.shift.start.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" });
              return `- ${date} at ${time}, ${s.shift.location ?? "TBC"} (${s.shift.shiftType.name})`;
            })
            .join("\n")
        : "## Your Upcoming Shifts\nNo upcoming shifts booked yet.";

    const locationsContext = "## Kitchen Locations\n" +
      locations.map((l) => `- ${l.name}: ${l.address}`).join("\n");

    const shiftTypesContext = "## Shift Roles\n" +
      shiftTypes.map((t) => `- ${t.name}${t.description ? `: ${t.description}` : ""}`).join("\n");

    const avgPerService = recentMeals._count > 0
      ? Math.round((recentMeals._sum.mealsServed ?? 0) / recentMeals._count)
      : 60;

    const statsContext = [
      "## Community Impact",
      `Total volunteers: ${totalVolunteers}`,
      `Meals served (last 30 days): ~${(recentMeals._sum.mealsServed ?? 0).toLocaleString()}`,
      `Average meals per service: ~${avgPerService}`,
    ].join("\n");

    const achievementsContext = achievements.length > 0
      ? "## Your Achievements\n" + achievements.map((a) => `- ${a.achievement.name}: ${a.achievement.description}`).join("\n")
      : "";

    const dynamicContext = [volunteerContext, shiftsContext, locationsContext, shiftTypesContext, statsContext, achievementsContext]
      .filter(Boolean)
      .join("\n\n");

    const systemPrompt = basePrompt + "\n\n" + dynamicContext + "\n\nHere is your knowledge base:\n---\n" + resourceContext + "\n---";

    const modelId = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4";
    console.log("[chat-preview] Starting streamText", {
      modelId,
      hasApiKey: !!process.env.OPENROUTER_API_KEY,
      apiKeyLength: process.env.OPENROUTER_API_KEY?.length ?? 0,
      messageCount: messages.length,
      systemPromptLength: systemPrompt.length,
    });

    const result = streamText({
      model: openrouter(modelId),
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
