import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export interface AdminActor {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Resolves the calling admin, or returns the response to send back.
 * Callers do `const gate = await requireAdmin(); if ("response" in gate) return gate.response;`
 */
export async function requireAdmin(): Promise<
  { actor: AdminActor } | { response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user || user.role !== "ADMIN") {
    return {
      response: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    };
  }

  return { actor: { id: user.id, email: user.email, name: user.name } };
}

/**
 * Profile photos are sometimes stored as base64 `data:` URIs rather than
 * hosted URLs, and one of those is ~7KB. Inlining 25 of them turns a small
 * list response into a couple of hundred KB of payload, so list endpoints
 * drop them and let the avatar fall back to initials. Real hosted URLs are
 * tiny and pass through untouched.
 */
export function listSafePhotoUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("data:") ? null : url;
}
