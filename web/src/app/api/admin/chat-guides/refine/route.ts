import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { refineContent } from "@/lib/refine-content";

// POST /api/admin/chat-guides/refine — clean raw imported/scraped text via the AI model
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { content, title } = body as { content?: string; title?: string };

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 },
      );
    }

    const refined = await refineContent(content, title, {
      distinctId: session.user.id,
    });
    if (!refined) {
      return NextResponse.json(
        { error: "The model returned an empty result — try again" },
        { status: 502 },
      );
    }

    return NextResponse.json({ refined });
  } catch (error) {
    console.error("Chat guide refine error:", error);
    return NextResponse.json(
      { error: "Failed to refine content" },
      { status: 500 },
    );
  }
}
