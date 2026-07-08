import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";

type SuggestedQuestion = { emoji: string; label: string };

const DEFAULT_SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  { emoji: "🍽️", label: "What happens on a typical shift?" },
  { emoji: "🔪", label: "Kitchen safety tips" },
  { emoji: "🏆", label: "How do achievements work?" },
  { emoji: "📍", label: "Where are the kitchens?" },
];

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

  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: "CHAT_SUGGESTED_QUESTIONS" },
    });

    let suggestedQuestions = DEFAULT_SUGGESTED_QUESTIONS;
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          suggestedQuestions = parsed;
        }
      } catch {
        console.error("[chat-config] Malformed CHAT_SUGGESTED_QUESTIONS setting, using defaults");
      }
    }

    return NextResponse.json({ suggestedQuestions });
  } catch (error) {
    console.error("Error fetching chat config:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat config" },
      { status: 500 },
    );
  }
}
