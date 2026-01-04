/**
 * DELETE /api/passkey/delete
 *
 * Delete a passkey for the authenticated user.
 * Safety check: Prevents deleting the last authentication method.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { userHasAlternativeAuth } from "@/lib/webauthn-utils";

export async function DELETE(req: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized. You must be logged in to delete passkeys." },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    const body = await req.json();
    const { passkeyId } = body as { passkeyId: string };

    if (!passkeyId) {
      return NextResponse.json(
        { error: "Missing passkeyId" },
        { status: 400 }
      );
    }

    // Verify passkey belongs to this user
    const passkey = await prisma.passkey.findUnique({
      where: { id: passkeyId },
    });

    if (!passkey) {
      return NextResponse.json(
        { error: "Passkey not found" },
        { status: 404 }
      );
    }

    if (passkey.userId !== userId) {
      return NextResponse.json(
        { error: "This passkey does not belong to you" },
        { status: 403 }
      );
    }

    // Safety check: Ensure user has alternative authentication method
    const hasAlternative = await userHasAlternativeAuth(userId, passkeyId);

    if (!hasAlternative) {
      return NextResponse.json(
        {
          error: "Cannot delete your last authentication method",
          message: "You must have at least one way to log in (password or another passkey)",
        },
        { status: 400 }
      );
    }

    // Delete the passkey
    await prisma.passkey.delete({
      where: { id: passkeyId },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Passkey deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting passkey:", error);
    return NextResponse.json(
      {
        error: "Failed to delete passkey",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
