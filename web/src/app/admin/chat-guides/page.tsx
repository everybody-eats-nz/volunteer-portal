import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { ScrollText } from "lucide-react";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled, FeatureFlag } from "@/lib/posthog-server";

import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { Button } from "@/components/ui/button";
import { ChatGuidesContent } from "./chat-guides-content";

export default async function ChatGuidesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/chat-guides");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const chatGuidesEnabled = await isFeatureEnabled(
    FeatureFlag.CHAT_GUIDES,
    session.user.id,
  );
  if (!chatGuidesEnabled) {
    notFound();
  }

  const [chatResources, allResources, chatSettings] = await Promise.all([
    // Resources currently included in chat
    prisma.resource.findMany({
      where: { includeInChat: true },
      include: {
        uploader: {
          select: { id: true, firstName: true, lastName: true, name: true },
        },
      },
      orderBy: { title: "asc" },
    }),
    // All published resources (for adding to chat)
    prisma.resource.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        title: true,
        type: true,
        category: true,
        includeInChat: true,
        chatContent: true,
      },
      orderBy: { title: "asc" },
    }),
    // Chat prompt settings
    prisma.siteSetting.findMany({
      where: { key: { in: ["CHAT_SYSTEM_PROMPT", "CHAT_SUGGESTED_QUESTIONS"] } },
    }),
  ]);

  const systemPrompt = chatSettings.find((s) => s.key === "CHAT_SYSTEM_PROMPT")?.value ?? "";
  const suggestedQuestions = chatSettings.find((s) => s.key === "CHAT_SUGGESTED_QUESTIONS")?.value ?? "[]";

  // Estimate total token count (rough: ~4 chars per token)
  const totalChars = chatResources.reduce(
    (sum, r) => sum + (r.chatContent?.length ?? 0),
    0,
  );
  const estimatedTokens = Math.round(totalChars / 4);

  return (
    <AdminPageWrapper
      title="Chat Guides"
      description="Manage which resources are included as context for the mobile AI chat assistant. Volunteers can ask the assistant questions and it will answer based on these resources."
      actions={
        <Button variant="outline" asChild>
          <Link href="/admin/chat-guides/logs">
            <ScrollText className="mr-2 h-4 w-4" />
            View Logs
          </Link>
        </Button>
      }
    >
      <ChatGuidesContent
        initialChatResources={chatResources}
        allResources={allResources}
        estimatedTokens={estimatedTokens}
        initialSystemPrompt={systemPrompt}
        initialSuggestedQuestions={suggestedQuestions}
      />
    </AdminPageWrapper>
  );
}
