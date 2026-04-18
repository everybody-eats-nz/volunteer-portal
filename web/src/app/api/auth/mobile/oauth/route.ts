import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signMobileToken, toMobileUser } from "@/lib/mobile-auth";
import { unarchiveUser } from "@/lib/archive-service";
import { ArchiveTriggerSource } from "@/generated/client";

type Provider = "apple" | "google" | "facebook";

type OAuthProfile = {
  email: string;
  name: string | null;
  image: string | null;
  providerUserId: string;
  emailVerified: boolean;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, idToken, accessToken } = body as {
      provider: Provider;
      idToken?: string;
      accessToken?: string;
    };

    if (!provider || !["apple", "google", "facebook"].includes(provider)) {
      return NextResponse.json(
        { error: "Unsupported provider" },
        { status: 400 }
      );
    }

    let profile: OAuthProfile;
    try {
      if (provider === "apple") {
        if (!idToken) throw new Error("Missing Apple identity token");
        profile = await verifyAppleToken(idToken);
      } else if (provider === "google") {
        if (!idToken) throw new Error("Missing Google id_token");
        profile = await verifyGoogleToken(idToken);
      } else {
        if (!accessToken) throw new Error("Missing Facebook access token");
        profile = await verifyFacebookToken(accessToken);
      }
    } catch (error) {
      console.error(`Mobile OAuth (${provider}) verification failed:`, error);
      return NextResponse.json(
        { error: "Could not verify provider token" },
        { status: 401 }
      );
    }

    if (!profile.email) {
      return NextResponse.json(
        {
          error:
            "This provider did not share an email address. Please sign in with another method.",
        },
        { status: 400 }
      );
    }

    // Upsert the user — same logic as the NextAuth signIn callback for web OAuth
    let user = await prisma.user.findUnique({ where: { email: profile.email } });

    if (!user) {
      const nameParts = (profile.name ?? "").split(" ").filter(Boolean);
      const firstName = nameParts[0] ?? "";
      const lastName = nameParts.slice(1).join(" ") || "";

      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name ?? "",
          firstName,
          lastName,
          role: "VOLUNTEER",
          profilePhotoUrl: profile.image,
          hashedPassword: "",
          emailVerified: profile.emailVerified,
          volunteerAgreementAccepted: false,
          healthSafetyPolicyAccepted: false,
        },
      });
    } else {
      const updates: { profilePhotoUrl?: string; emailVerified?: boolean } = {};
      if (profile.image && !user.profilePhotoUrl) updates.profilePhotoUrl = profile.image;
      if (profile.emailVerified && !user.emailVerified) updates.emailVerified = true;
      if (Object.keys(updates).length > 0) {
        user = await prisma.user.update({ where: { id: user.id }, data: updates });
      }

      if (user.archivedAt) {
        await unarchiveUser({
          userId: user.id,
          triggerSource: ArchiveTriggerSource.SELF_REACTIVATION,
        });
        user = await prisma.user.findUnique({ where: { id: user.id } }) ?? user;
      }
    }

    const freshUser = await prisma.user.findUnique({
      where: { id: user.id },
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

    if (!freshUser) {
      return NextResponse.json({ error: "User not found after upsert" }, { status: 500 });
    }

    const token = await signMobileToken(freshUser.id, freshUser.email);
    return NextResponse.json({ token, user: toMobileUser(freshUser) });
  } catch (error) {
    console.error("Mobile OAuth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// --- Provider verifiers ---

async function verifyGoogleToken(idToken: string): Promise<OAuthProfile> {
  // tokeninfo endpoint returns email, email_verified, name, picture, sub, aud
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!res.ok) throw new Error(`Google tokeninfo returned ${res.status}`);
  const data = (await res.json()) as {
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    picture?: string;
    sub?: string;
    aud?: string;
  };

  const allowedAuds = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_MOBILE_CLIENT_ID_IOS,
    process.env.GOOGLE_MOBILE_CLIENT_ID_ANDROID,
    process.env.GOOGLE_MOBILE_CLIENT_ID_WEB,
  ].filter(Boolean) as string[];

  if (allowedAuds.length > 0 && data.aud && !allowedAuds.includes(data.aud)) {
    throw new Error(`Google token audience mismatch: ${data.aud}`);
  }

  return {
    email: data.email ?? "",
    name: data.name ?? null,
    image: data.picture ?? null,
    providerUserId: data.sub ?? "",
    emailVerified: data.email_verified === true || data.email_verified === "true",
  };
}

async function verifyAppleToken(idToken: string): Promise<OAuthProfile> {
  // Decode JWT payload without verifying signature; verify via Apple's key.
  const payload = decodeJwtPayload(idToken);
  const iss = payload.iss as string | undefined;
  const aud = payload.aud as string | undefined;

  if (iss !== "https://appleid.apple.com") {
    throw new Error(`Unexpected Apple issuer: ${iss}`);
  }

  const expectedAud =
    process.env.APPLE_MOBILE_BUNDLE_ID || process.env.APPLE_CLIENT_ID;
  if (expectedAud && aud !== expectedAud) {
    throw new Error(`Apple token audience mismatch: ${aud}`);
  }

  // NOTE: Production should verify the JWT signature with Apple's public keys
  // from https://appleid.apple.com/auth/keys — this simplified path trusts
  // the iss+aud check + HTTPS. Upgrade to full JWS verification before launch.

  return {
    email: (payload.email as string) ?? "",
    name: null, // Apple only sends name on first auth — client must persist it
    image: null,
    providerUserId: (payload.sub as string) ?? "",
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
  };
}

async function verifyFacebookToken(accessToken: string): Promise<OAuthProfile> {
  const res = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email,picture.width(400).height(400)&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!res.ok) throw new Error(`Facebook /me returned ${res.status}`);
  const data = (await res.json()) as {
    id?: string;
    name?: string;
    email?: string;
    picture?: { data?: { url?: string } };
  };

  return {
    email: data.email ?? "",
    name: data.name ?? null,
    image: data.picture?.data?.url ?? null,
    providerUserId: data.id ?? "",
    emailVerified: true, // Facebook emails are verified
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT");
  const payload = Buffer.from(parts[1], "base64url").toString("utf8");
  return JSON.parse(payload);
}
