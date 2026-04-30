import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { setThreadStatus } from "@/lib/services/messaging";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;

  let status: "OPEN" | "RESOLVED" = "RESOLVED";
  try {
    const json = (await req.json().catch(() => ({}))) as { status?: unknown };
    if (json.status === "OPEN" || json.status === "RESOLVED") {
      status = json.status;
    }
  } catch {
    // Default to RESOLVED if no body
  }

  await setThreadStatus(id, status);
  return NextResponse.json({ ok: true, status });
}
