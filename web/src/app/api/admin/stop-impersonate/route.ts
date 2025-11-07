import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Must be impersonating to stop
    if (!session.impersonating) {
      return NextResponse.json(
        { error: "Not currently impersonating" },
        { status: 400 }
      );
    }

    // Return admin info to restore session
    return NextResponse.json({
      success: true,
      adminId: session.impersonating.adminId,
    });
  } catch (error) {
    console.error("Stop impersonation error:", error);
    return NextResponse.json(
      { error: "Failed to stop impersonation" },
      { status: 500 }
    );
  }
}
