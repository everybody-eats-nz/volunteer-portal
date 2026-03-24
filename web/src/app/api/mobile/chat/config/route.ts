import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { isFeatureEnabled, FeatureFlag } from "@/lib/posthog-server";

/**
 * GET /api/mobile/chat/config
 *
 * Returns chat configuration for the mobile app (suggested questions).
 */
export async function GET(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = await isFeatureEnabled(FeatureFlag.CHAT_GUIDES, auth.userId);
  if (!enabled) {
    return NextResponse.json({ error: "Chat guides not enabled" }, { status: 404 });
  }

  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "CHAT_SUGGESTED_QUESTIONS" },
    });

    const suggestedQuestions = setting?.value
      ? JSON.parse(setting.value)
      : [
          { emoji: "🍽️", label: "What happens on a typical shift?" },
          { emoji: "🔪", label: "Kitchen safety tips" },
          { emoji: "👥", label: "What are the volunteer grades?" },
          { emoji: "📍", label: "Where are the kitchens?" },
        ];

    return NextResponse.json({ suggestedQuestions });
  } catch (error) {
    console.error("Error fetching chat config:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat config" },
      { status: 500 },
    );
  }
}
