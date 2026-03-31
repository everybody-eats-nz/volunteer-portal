import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const suggestedQuestionSchema = z.object({
  emoji: z.string().min(1),
  label: z.string().min(1),
});

const updateSchema = z.object({
  systemPrompt: z.string().optional(),
  suggestedQuestions: z.array(suggestedQuestionSchema).optional(),
});

// PATCH /api/admin/chat-guides/settings — update chat prompt settings
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = updateSchema.parse(body);
    const userId = session.user.id;

    const updates: Promise<unknown>[] = [];

    if (parsed.systemPrompt !== undefined) {
      updates.push(
        prisma.siteSetting.upsert({
          where: { key: "CHAT_SYSTEM_PROMPT" },
          update: { value: parsed.systemPrompt, updatedBy: userId },
          create: {
            key: "CHAT_SYSTEM_PROMPT",
            value: parsed.systemPrompt,
            description: "System prompt for the mobile AI chat assistant",
            category: "CHAT",
            updatedBy: userId,
          },
        }),
      );
    }

    if (parsed.suggestedQuestions !== undefined) {
      updates.push(
        prisma.siteSetting.upsert({
          where: { key: "CHAT_SUGGESTED_QUESTIONS" },
          update: {
            value: JSON.stringify(parsed.suggestedQuestions),
            updatedBy: userId,
          },
          create: {
            key: "CHAT_SUGGESTED_QUESTIONS",
            value: JSON.stringify(parsed.suggestedQuestions),
            description: "Suggested questions shown on the mobile chat welcome screen",
            category: "CHAT",
            updatedBy: userId,
          },
        }),
      );
    }

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating chat settings:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
