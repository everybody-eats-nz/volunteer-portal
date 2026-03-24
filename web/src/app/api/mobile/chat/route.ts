import { NextResponse } from "next/server";
import { streamText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { isFeatureEnabled, FeatureFlag } from "@/lib/posthog-server";

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
- If a volunteer has incomplete profile or missing agreements (shown in their info), gently encourage them to complete those

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
        where: { date: { gte: thirtyDaysAgo } },
        _sum: { mealsServed: true },
        _count: true,
      }),
      prisma.mealsServed.aggregate({
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

/* ─── Per-user context (fresh every request) ──────────────────── */

async function getUserContext(userId: string) {
  const now = new Date();

  // Get user's existing signup shift IDs to exclude from available shifts
  const userSignupShiftIds = await prisma.signup.findMany({
    where: { userId, status: { in: ["CONFIRMED", "PENDING", "WAITLISTED"] } },
    select: { shiftId: true },
  });
  const signedUpShiftIds = new Set(userSignupShiftIds.map((s) => s.shiftId));

  const [volunteer, upcomingShifts, achievements, completedCount, availableShifts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        name: true,
        volunteerGrade: true,
        availableDays: true,
        availableLocations: true,
        completedShiftAdjustment: true,
        profileCompleted: true,
        volunteerAgreementAccepted: true,
        healthSafetyPolicyAccepted: true,
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
    prisma.userAchievement.findMany({
      where: { userId },
      select: {
        achievement: { select: { name: true, description: true, category: true } },
        unlockedAt: true,
      },
      orderBy: { unlockedAt: "desc" },
      take: 10,
    }),
    prisma.signup.count({
      where: {
        userId,
        status: "CONFIRMED",
        shift: { end: { lt: now } },
      },
    }),
    // Next 5 available shifts (ones the user hasn't signed up for)
    prisma.shift.findMany({
      where: {
        start: { gte: now },
        id: { notIn: [...signedUpShiftIds] },
      },
      select: {
        id: true,
        start: true,
        end: true,
        location: true,
        capacity: true,
        shiftType: { select: { name: true } },
        _count: { select: { signups: { where: { status: "CONFIRMED" } } } },
      },
      orderBy: { start: "asc" },
      take: 8,
    }),
  ]);

  const totalShifts = completedCount + (volunteer?.completedShiftAdjustment ?? 0);
  const volunteerName = volunteer?.firstName || volunteer?.name || "Volunteer";

  // Profile completeness nudges
  const nudges: string[] = [];
  if (!volunteer?.profileCompleted) {
    nudges.push("Profile is incomplete — encourage them to fill it out in the Profile tab");
  }
  if (!volunteer?.volunteerAgreementAccepted) {
    nudges.push("Has not yet accepted the volunteer agreement");
  }
  if (!volunteer?.healthSafetyPolicyAccepted) {
    nudges.push("Has not yet accepted the health & safety policy");
  }

  const volunteerContext = [
    `## About This Volunteer`,
    `Name: ${volunteerName}`,
    `Grade: ${volunteer?.volunteerGrade ?? "GREEN"} (GREEN = new, YELLOW = experienced, PINK = shift leader)`,
    `Completed shifts: ${totalShifts}`,
    volunteer?.availableLocations
      ? `Preferred locations: ${volunteer.availableLocations}`
      : null,
    volunteer?.availableDays ? `Available days: ${volunteer.availableDays}` : null,
    nudges.length > 0
      ? `\nAction items for this volunteer:\n${nudges.map((n) => `- ${n}`).join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const shiftsContext =
    upcomingShifts.length > 0
      ? "## Your Upcoming Shifts\n" +
        upcomingShifts
          .map((s) => {
            const date = s.shift.start.toLocaleDateString("en-NZ", {
              weekday: "long",
              day: "numeric",
              month: "long",
            });
            const startTime = s.shift.start.toLocaleTimeString("en-NZ", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const endTime = s.shift.end.toLocaleTimeString("en-NZ", {
              hour: "2-digit",
              minute: "2-digit",
            });
            return `- ${date}, ${startTime}–${endTime} at ${s.shift.location ?? "TBC"} (${s.shift.shiftType.name}) — ${s.status}`;
          })
          .join("\n")
      : "## Your Upcoming Shifts\nNo upcoming shifts booked yet.";

  const achievementsContext =
    achievements.length > 0
      ? "## Your Achievements\n" +
        achievements
          .map((a) => `- ${a.achievement.name}: ${a.achievement.description}`)
          .join("\n")
      : "";

  // Available shifts they could sign up for
  const openShifts = availableShifts.filter(
    (s) => s._count.signups < s.capacity,
  );
  const availableShiftsContext =
    openShifts.length > 0
      ? "## Available Shifts to Join\n" +
        openShifts
          .map((s) => {
            const date = s.start.toLocaleDateString("en-NZ", {
              weekday: "long",
              day: "numeric",
              month: "long",
            });
            const startTime = s.start.toLocaleTimeString("en-NZ", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const endTime = s.end.toLocaleTimeString("en-NZ", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const spotsLeft = s.capacity - s._count.signups;
            return `- ${date}, ${startTime}–${endTime} at ${s.location ?? "TBC"} (${s.shiftType.name}) — ${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`;
          })
          .join("\n") +
        "\nTell volunteers they can sign up via the Shifts tab in the app."
      : "";

  return { volunteerContext, shiftsContext, achievementsContext, availableShiftsContext };
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
 * Per-user context (profile, shifts, achievements) is fetched fresh each request.
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

    // Fetch static (cached) and per-user context in parallel
    const [staticCtx, userCtx] = await Promise.all([
      getStaticContext(),
      getUserContext(auth.userId),
    ]);

    // Assemble full system prompt
    const dynamicContext = [
      userCtx.volunteerContext,
      userCtx.shiftsContext,
      userCtx.availableShiftsContext,
      staticCtx.locationsContext,
      staticCtx.shiftTypesContext,
      staticCtx.communityStatsContext,
      userCtx.achievementsContext,
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
