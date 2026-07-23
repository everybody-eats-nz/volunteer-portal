import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import {
  applyLocationMerge,
  planLocationMerge,
  LocationMergeError,
} from "@/lib/location-merge";

// POST - Preview or apply a location merge.
// Body: { from: string, into: string, apply?: boolean }
// Without apply (or apply: false) this is a read-only dry run; with
// apply: true the merge plan is recomputed and executed in one transaction.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { from, into, apply } = body as {
      from?: unknown;
      into?: unknown;
      apply?: unknown;
    };

    if (typeof from !== "string" || typeof into !== "string") {
      return NextResponse.json(
        { error: "from and into location names are required" },
        { status: 400 }
      );
    }

    const plan =
      apply === true
        ? await applyLocationMerge(from, into)
        : await planLocationMerge(from, into);

    return NextResponse.json({ plan, applied: apply === true });
  } catch (error) {
    if (error instanceof LocationMergeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to merge locations:", error);
    return NextResponse.json(
      { error: "Failed to merge locations" },
      { status: 500 }
    );
  }
}
