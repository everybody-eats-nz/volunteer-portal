import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { signMobileToken, toMobileUser } from "@/lib/mobile-auth";
import { unarchiveUser } from "@/lib/archive-service";
import { ArchiveTriggerSource } from "@/generated/client";

// Cached across invocations on the same server instance. `jose` handles key
// rotation and stale-key refetch internally — see createRemoteJWKSet docs.
const appleJWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

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
          actorId: user.id,
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
  const expectedAud =
    process.env.APPLE_MOBILE_BUNDLE_ID || process.env.APPLE_CLIENT_ID;

  if (!expectedAud) {
    throw new Error(
      "APPLE_MOBILE_BUNDLE_ID (or APPLE_CLIENT_ID) must be set to verify Apple tokens",
    );
  }

  // Full JWS verification: fetches Apple's public keys, picks the one whose
  // kid matches the token header, validates signature + iss + aud + exp.
  const { payload } = await jwtVerify(idToken, appleJWKS, {
    issuer: "https://appleid.apple.com",
    audience: expectedAud,
  });

  // Name is only included on the first auth; clients must persist it themselves.
  // Apple's email_verified is a string ("true"/"false") in some responses and
  // a boolean in others.
  return {
    email: (payload.email as string) ?? "",
    name: null,
    image: null,
    providerUserId: (payload.sub as string) ?? "",
    emailVerified:
      payload.email_verified === true ||
      payload.email_verified === "true",
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
