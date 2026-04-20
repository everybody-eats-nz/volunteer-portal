import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth";
import { isExpoPushToken } from "@/lib/services/expo-push";

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android"]),
  deviceName: z.string().max(120).optional(),
});

const deleteSchema = z.object({
  token: z.string().min(1),
});

/**
 * POST /api/mobile/push-tokens
 *
 * Upsert an Expo push token for the authenticated mobile user. If the token
 * already exists against another user (e.g. device was logged in as someone
 * else), reassign it to this user — the new owner is the source of truth.
 */
export async function POST(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { token, platform, deviceName } = parsed.data;

    if (!isExpoPushToken(token)) {
      return NextResponse.json(
        { error: "Invalid Expo push token" },
        { status: 400 }
      );
    }

    const now = new Date();

    await prisma.pushToken.upsert({
      where: { token },
      create: {
        token,
        platform,
        deviceName,
        userId: auth.userId,
        lastUsedAt: now,
      },
      update: {
        userId: auth.userId,
        platform,
        deviceName,
        lastUsedAt: now,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push token register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mobile/push-tokens
 *
 * Remove a push token (called on logout). Only deletes tokens owned by the
 * authenticated user so a stolen token can't be used to clear another
 * account's registrations.
 */
export async function DELETE(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await prisma.pushToken.deleteMany({
      where: { token: parsed.data.token, userId: auth.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push token delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
