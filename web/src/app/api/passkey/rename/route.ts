/**
 * PATCH /api/passkey/rename
 *
 * Update the device name of a passkey.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { validateDeviceName } from "@/lib/webauthn-utils";

export async function PATCH(req: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized. You must be logged in to rename passkeys." },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    const body = await req.json();
    const { passkeyId, deviceName } = body as {
      passkeyId: string;
      deviceName: string;
    };

    if (!passkeyId) {
      return NextResponse.json(
        { error: "Missing passkeyId" },
        { status: 400 }
      );
    }

    if (!deviceName) {
      return NextResponse.json(
        { error: "Missing deviceName" },
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

    // Validate and update device name
    const validatedDeviceName = validateDeviceName(deviceName);

    const updatedPasskey = await prisma.passkey.update({
      where: { id: passkeyId },
      data: {
        deviceName: validatedDeviceName,
      },
    });

    return NextResponse.json(
      {
        success: true,
        passkey: {
          id: updatedPasskey.id,
          deviceName: updatedPasskey.deviceName,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error renaming passkey:", error);
    return NextResponse.json(
      {
        error: "Failed to rename passkey",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
