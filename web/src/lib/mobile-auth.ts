import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { prisma } from "@/lib/prisma";

const ISSUER = "everybody-eats";
const AUDIENCE = "mobile";
const EXPIRATION = "30d";

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET environment variable is required for mobile auth");
  }
  return new TextEncoder().encode(secret);
}

export type MobileUser = {
  id: string;
  name: string | null;
  email: string;
  role: "VOLUNTEER" | "ADMIN";
  image: string | null;
  profileComplete: boolean;
};

interface MobileTokenPayload extends JWTPayload {
  sub: string; // user id
  email: string;
}

/**
 * Sign a JWT for the mobile app.
 */
export async function signMobileToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ email } satisfies Omit<MobileTokenPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(getSecret());
}

/**
 * Verify a mobile JWT and return the payload.
 */
export async function verifyMobileToken(token: string): Promise<MobileTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  return payload as MobileTokenPayload;
}

/**
 * Select fields used to build a MobileUser response.
 */
const MOBILE_USER_SELECT = {
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
} as const;

/**
 * Convert a DB user (with the select above) to the mobile-friendly shape.
 */
export function toMobileUser(
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    profilePhotoUrl: string | null;
    profileCompleted: boolean;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    dateOfBirth: Date | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    volunteerAgreementAccepted: boolean;
    healthSafetyPolicyAccepted: boolean;
  }
): MobileUser {
  // Profile is "complete" if the key fields are filled in
  const profileComplete =
    user.profileCompleted ||
    Boolean(
      user.firstName &&
      user.phone &&
      user.dateOfBirth &&
      user.emergencyContactName &&
      user.emergencyContactPhone &&
      user.volunteerAgreementAccepted &&
      user.healthSafetyPolicyAccepted
    );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as "VOLUNTEER" | "ADMIN",
    image: user.profilePhotoUrl,
    profileComplete,
  };
}

/**
 * Extract and verify the mobile user from an incoming request.
 * Returns null if no valid token is present.
 */
export async function getMobileUser(request: Request): Promise<MobileUser | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);

  try {
    const payload = await verifyMobileToken(token);
    if (!payload.sub) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: MOBILE_USER_SELECT,
    });

    if (!user) return null;
    return toMobileUser(user);
  } catch {
    return null;
  }
}

/**
 * Like getMobileUser but also returns the raw DB user ID.
 * Useful for endpoints that need to query with the user's ID.
 */
export async function requireMobileUser(request: Request): Promise<{
  user: MobileUser;
  userId: string;
} | null> {
  const user = await getMobileUser(request);
  if (!user) return null;
  return { user, userId: user.id };
}
