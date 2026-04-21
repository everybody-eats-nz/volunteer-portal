import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { subDays } from "date-fns";
import { ArrowLeft, Bot, MessageSquare, User as UserIcon } from "lucide-react";

import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isFeatureEnabled, FeatureFlag } from "@/lib/posthog-server";
import { formatInNZT } from "@/lib/timezone";

import { AdminPageWrapper } from "@/components/admin-page-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChatLogsSearch } from "./chat-logs-search";

const PAGE_SIZE = 50;

interface ChatLogsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ChatLogsPage({ searchParams }: ChatLogsPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/admin/chat-guides/logs");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const enabled = await isFeatureEnabled(FeatureFlag.CHAT_GUIDES, session.user.id);
  if (!enabled) notFound();

  const params = await searchParams;
  const page = Math.max(1, parseInt((params.page as string) ?? "1", 10) || 1);
  const q = ((params.q as string) ?? "").trim();

  const userFilter = q
    ? {
        user: {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
          ],
        },
      }
    : {};

  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);
  const thirtyDaysAgo = subDays(now, 30);

  const [logs, totalCount, last7Count, last30Count, uniqueUsers30] = await Promise.all([
    prisma.chatLog.findMany({
      where: userFilter,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
          },
        },
      },
    }),
    prisma.chatLog.count({ where: userFilter }),
    prisma.chatLog.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.chatLog.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.chatLog.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      distinct: ["userId"],
      select: { userId: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const buildPageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (p > 1) sp.set("page", String(p));
    if (q) sp.set("q", q);
    const qs = sp.toString();
    return `/admin/chat-guides/logs${qs ? `?${qs}` : ""}`;
  };

  return (
    <AdminPageWrapper
      title="Chat Logs"
      description="Conversations volunteers have had with the AI assistant. Logs are kept for 30 days."
    >
      <div className="space-y-6">
        {/* Back link */}
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/chat-guides">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Chat Guides
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{last7Count.toLocaleString()}</div>
              <p className="mt-1 text-xs text-muted-foreground">conversation turns</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{last30Count.toLocaleString()}</div>
              <p className="mt-1 text-xs text-muted-foreground">conversation turns</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unique users (30d)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{uniqueUsers30.length.toLocaleString()}</div>
              <p className="mt-1 text-xs text-muted-foreground">volunteers chatted with the assistant</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <ChatLogsSearch initialQuery={q} />

        {/* Result summary */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {totalCount === 0
              ? "No logs found"
              : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, totalCount)} of ${totalCount.toLocaleString()}`}
            {q && (
              <>
                {" "}
                for <span className="font-medium text-foreground">&ldquo;{q}&rdquo;</span>
              </>
            )}
          </span>
          {q && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/chat-guides/logs">Clear filter</Link>
            </Button>
          )}
        </div>

        {/* Logs */}
        {logs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-lg font-medium">No conversations yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {q
                  ? "Try a different search term"
                  : "Once volunteers chat with the assistant, their conversations will appear here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const displayName =
                log.user.firstName && log.user.lastName
                  ? `${log.user.firstName} ${log.user.lastName}`
                  : log.user.name || log.user.firstName || log.user.email;
              return (
                <details
                  key={log.id}
                  className="group rounded-lg border bg-card transition-colors hover:bg-muted/30 open:bg-muted/30"
                >
                  <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <UserIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link
                          href={`/admin/volunteers/${log.user.id}`}
                          className="font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {displayName}
                        </Link>
                        <span className="text-xs text-muted-foreground">{log.user.email}</span>
                        <Badge variant="secondary" className="ml-auto text-xs font-normal">
                          {formatInNZT(log.createdAt, "d MMM yyyy, h:mm a")}
                        </Badge>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-sm text-foreground">
                        {log.userMessage || <span className="italic text-muted-foreground">(empty message)</span>}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Click to view assistant reply · model: <code className="text-[10px]">{log.model}</code>
                      </p>
                    </div>
                  </summary>
                  <div className="space-y-3 border-t px-4 py-4">
                    <div>
                      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <UserIcon className="h-3 w-3" />
                        Volunteer
                      </div>
                      <div className="whitespace-pre-wrap rounded-md bg-background p-3 text-sm leading-relaxed">
                        {log.userMessage}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <Bot className="h-3 w-3" />
                        Assistant
                      </div>
                      <div className="whitespace-pre-wrap rounded-md bg-background p-3 text-sm leading-relaxed">
                        {log.assistantResponse || (
                          <span className="italic text-muted-foreground">(no reply recorded)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" asChild disabled={safePage <= 1}>
              {safePage <= 1 ? (
                <span aria-disabled="true">Previous</span>
              ) : (
                <Link href={buildPageHref(safePage - 1)}>Previous</Link>
              )}
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {safePage} of {totalPages}
            </span>
            <Button variant="outline" size="sm" asChild disabled={safePage >= totalPages}>
              {safePage >= totalPages ? (
                <span aria-disabled="true">Next</span>
              ) : (
                <Link href={buildPageHref(safePage + 1)}>Next</Link>
              )}
            </Button>
          </div>
        )}
      </div>
    </AdminPageWrapper>
  );
}
