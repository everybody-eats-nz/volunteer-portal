import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth-options";

/**
 * One admin gate for every van admin route, so a new endpoint cannot forget it.
 * Returns the admin's user id, or a response to hand straight back.
 */
export async function requireVanAdmin(): Promise<
  { userId: string; denied?: never } | { userId?: never; denied: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN") {
    return { denied: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) };
  }
  return { userId: session.user.id };
}
