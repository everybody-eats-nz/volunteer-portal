import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser, toMobileUser } from "@/lib/mobile-auth";
import { isProfileComplete } from "@/lib/profile-completion";

/**
 * POST /api/auth/mobile/agreements
 *
 * Records that the authenticated volunteer has accepted both required
 * agreements (Volunteer Agreement + Health & Safety Policy). Used by the
 * mobile agreement gate, which OAuth sign-ups pass through before entering the
 * app — OAuth account creation can't capture these the way email sign-up does.
 *
 * Returns the refreshed mobile user so the client can clear the gate.
 */
export async function POST(request: Request) {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        firstName: true,
        phone: true,
        dateOfBirth: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Accepting the agreements may complete the profile if every other
    // required field is already present, so recompute the gate flag.
    const profileCompleted = isProfileComplete({
      firstName: existing.firstName,
      phone: existing.phone,
      dateOfBirth: existing.dateOfBirth,
      emergencyContactName: existing.emergencyContactName,
      emergencyContactPhone: existing.emergencyContactPhone,
      volunteerAgreementAccepted: true,
      healthSafetyPolicyAccepted: true,
    });

    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data: {
        volunteerAgreementAccepted: true,
        healthSafetyPolicyAccepted: true,
        profileCompleted,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePhotoUrl: true,
        profileCompleted: true,
        firstName: true,
        lastName: true,
        phone: true,
        dateOfBirth: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        volunteerAgreementAccepted: true,
        healthSafetyPolicyAccepted: true,
      },
    });

    return NextResponse.json({ user: toMobileUser(updated) });
  } catch (error) {
    console.error("Mobile agreement acceptance failed:", error);
    return NextResponse.json(
      { error: "Could not save your agreement. Please try again." },
      { status: 500 }
    );
  }
}
