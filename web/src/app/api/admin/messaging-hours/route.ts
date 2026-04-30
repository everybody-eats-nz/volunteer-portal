import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  getAllLocationHours,
  upsertHoursForLocation,
} from "@/lib/services/messaging-hours";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const locations = await getAllLocationHours();
  return NextResponse.json({ locations });
}

interface UpsertBody {
  location?: unknown;
  hours?: unknown;
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN" || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: UpsertBody;
  try {
    body = (await req.json()) as UpsertBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.location !== "string" || !body.location) {
    return NextResponse.json({ error: "location is required" }, { status: 400 });
  }
  if (!Array.isArray(body.hours)) {
    return NextResponse.json({ error: "hours[] is required" }, { status: 400 });
  }

  const hours = body.hours as Array<{
    dayOfWeek: number;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
  }>;

  try {
    const result = await upsertHoursForLocation({
      location: body.location,
      hours,
      updatedBy: session.user.id,
    });
    return NextResponse.json({ location: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[admin messaging-hours PUT]", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
