/**
 * GET /api/passkey/list
 *
 * List all passkeys registered for the authenticated user.
 * Returns sanitized data (no sensitive cryptographic material).
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized. You must be logged in to view passkeys." },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch user's passkeys
    const passkeys = await prisma.passkey.findMany({
      where: { userId },
      select: {
        id: true,
        deviceName: true,
        transports: true,
        createdAt: true,
        lastUsedAt: true,
        aaguid: true,
      },
      orderBy: {
        createdAt: "desc", // Most recent first
      },
    });

    // Format response (convert dates to ISO strings)
    const formattedPasskeys = passkeys.map((passkey) => ({
      id: passkey.id,
      deviceName: passkey.deviceName || "My Device",
      transports: passkey.transports,
      createdAt: passkey.createdAt.toISOString(),
      lastUsedAt: passkey.lastUsedAt?.toISOString() || null,
      aaguid: passkey.aaguid,
    }));

    return NextResponse.json(
      { passkeys: formattedPasskeys },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching passkeys:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch passkeys",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
