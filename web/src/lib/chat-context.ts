import type { ModelMessage } from "ai";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SYSTEM_PROMPT, resolveChatModel } from "@/lib/chat-model";

/**
 * Shared context building for the AI chat assistant.
 *
 * The mobile chat route and the admin preview route both compose their system
 * prompt from two layers:
 *
 * 1. Static context — knowledge-base resources, locations, shift roles,
 *    community stats, and the admin-configured system prompt. Identical for
 *    every user, cached in-process for 5 minutes, and sent with an Anthropic
 *    prompt-cache breakpoint so repeat requests only pay for it once.
 * 2. Volunteer context — the requesting user's name, completed shift count,
 *    upcoming shifts, and achievements. Fetched fresh per request.
 */

export type StaticChatContext = {
  systemPrompt: string;
  modelId: string;
  resourceContext: string;
  locationsContext: string;
  shiftTypesContext: string;
  communityStatsContext: string;
  fetchedAt: number;
};

let staticCache: StaticChatContext | null = null;
const STATIC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Drop the cached static context (e.g. after admin settings change). */
export function invalidateStaticChatContext(): void {
  staticCache = null;
}

export async function getStaticChatContext(
  options: { fresh?: boolean } = {},
): Promise<StaticChatContext> {
  if (
    !options.fresh &&
    staticCache &&
    Date.now() - staticCache.fetchedAt < STATIC_CACHE_TTL_MS
  ) {
    return staticCache;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [resources, promptSetting, modelSetting, locations, shiftTypes, totalVolunteers, recentMeals, totalMeals, recentShifts] =
    await Promise.all([
      prisma.resource.findMany({
        // Chat inclusion is controlled solely by `includeInChat`; it is
        // independent of hub publication so chat-only guides (which are
        // unpublished) still feed the assistant.
        where: { includeInChat: true, chatContent: { not: null } },
        select: { title: true, category: true, chatContent: true },
        orderBy: { category: "asc" },
      }),
      prisma.siteSetting.findUnique({ where: { key: "CHAT_SYSTEM_PROMPT" } }),
      prisma.siteSetting.findUnique({ where: { key: "CHAT_MODEL" } }),
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
      // Recent shifts, for a fallback meals estimate when none are recorded.
      // A single dinner service spans several shifts (kitchen, front of
      // house, dish pit…), so estimates must count distinct services — a
      // (location, date) pair — not shifts.
      prisma.shift.findMany({
        where: { start: { gte: thirtyDaysAgo }, end: { lt: new Date() } },
        select: { start: true, location: true },
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

  // Use recorded meals data, but fall back to defaultMealsServed per distinct
  // service if data is sparse
  const avgDefault = locations.length > 0
    ? Math.round(locations.reduce((s, l) => s + l.defaultMealsServed, 0) / locations.length)
    : 60;

  const recentServiceCount = new Set(
    recentShifts.map(
      (s) => `${s.location ?? ""}|${s.start.toISOString().slice(0, 10)}`,
    ),
  ).size;

  const hasRecordedMeals = (recentMeals._sum.mealsServed ?? 0) > 0;
  const recentMealsEstimate = hasRecordedMeals
    ? recentMeals._sum.mealsServed!
    : recentServiceCount * avgDefault;
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
    modelId: resolveChatModel(modelSetting?.value, process.env.OPENROUTER_MODEL),
    resourceContext,
    locationsContext,
    shiftTypesContext,
    communityStatsContext,
    fetchedAt: Date.now(),
  };

  return staticCache;
}

/**
 * Build the per-user context block: who the volunteer is, their upcoming
 * shifts, and their achievements. Fetched fresh on every request.
 */
export async function getVolunteerChatContext(userId: string): Promise<string> {
  const now = new Date();

  const [volunteer, upcomingShifts, achievements, completedShiftsCount] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          firstName: true,
          name: true,
          completedShiftAdjustment: true,
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
          achievement: { select: { name: true, description: true } },
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
    ]);

  const volunteerName = volunteer?.firstName || volunteer?.name || "Volunteer";
  const volunteerContext = [
    "## About This Volunteer",
    `Name: ${volunteerName}`,
    `Shifts completed: ${completedShiftsCount + (volunteer?.completedShiftAdjustment ?? 0)}`,
  ].join("\n");

  const shiftsContext =
    upcomingShifts.length > 0
      ? "## Your Upcoming Shifts\n" +
        upcomingShifts
          .map((s) => {
            const date = s.shift.start.toLocaleDateString("en-NZ", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "Pacific/Auckland",
            });
            const time = s.shift.start.toLocaleTimeString("en-NZ", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Pacific/Auckland",
            });
            return `- ${date} at ${time}, ${s.shift.location ?? "TBC"} (${s.shift.shiftType.name})`;
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

  return [volunteerContext, shiftsContext, achievementsContext]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Compose the two system messages sent to the model.
 *
 * The static message carries an Anthropic prompt-cache breakpoint (via the
 * OpenRouter provider), so the expensive part — the whole knowledge base — is
 * cached across requests. The volunteer context varies per user and goes in a
 * second, uncached system message after the breakpoint.
 */
export function buildChatSystemMessages(
  staticCtx: StaticChatContext,
  volunteerContext: string,
): ModelMessage[] {
  const staticSystem = [
    staticCtx.systemPrompt,
    staticCtx.locationsContext,
    staticCtx.shiftTypesContext,
    staticCtx.communityStatsContext,
    "Here is your knowledge base:\n---\n" + staticCtx.resourceContext + "\n---",
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    {
      role: "system" as const,
      content: staticSystem,
      providerOptions: {
        openrouter: { cacheControl: { type: "ephemeral" } },
      },
    },
    ...(volunteerContext
      ? [{ role: "system" as const, content: volunteerContext }]
      : []),
  ];
}
