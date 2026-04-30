import { Metadata } from "next";
import { connection } from "next/server";
import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { MessagesInbox } from "@/components/admin/messages/messages-inbox";
import { listThreadsForAdmin } from "@/lib/services/messaging";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Messages | Admin",
  description: "Direct messages with volunteers",
};

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  await connection();
  const sp = await searchParams;

  const [threads, locations] = await Promise.all([
    listThreadsForAdmin({ status: "OPEN", limit: 50 }),
    prisma.location.findMany({
      where: { isActive: true },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AdminPageWrapper
      title="Messages"
      description="Direct conversations with volunteers — any admin can reply"
    >
      <MessagesInbox
        initialThreads={serializeThreads(threads)}
        initialSelectedId={sp.thread ?? null}
        locations={locations.map((l) => l.name)}
      />
    </AdminPageWrapper>
  );
}

function serializeThreads(threads: Awaited<ReturnType<typeof listThreadsForAdmin>>) {
  return threads.map((t) => ({
    ...t,
    lastMessageAt: t.lastMessageAt.toISOString(),
    lastMessage: t.lastMessage
      ? {
          ...t.lastMessage,
          createdAt: t.lastMessage.createdAt.toISOString(),
        }
      : null,
  }));
}
