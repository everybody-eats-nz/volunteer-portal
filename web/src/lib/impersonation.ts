import type { JWT } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

/**
 * Admin impersonation, applied to the NextAuth JWT.
 *
 * Both functions run inside the `jwt` callback on `trigger === "update"`. The
 * payload of that trigger is the raw body the browser posts to
 * `/api/auth/session`, so it is attacker-controlled: any signed-in user can
 * send any shape they like. Nothing here may therefore take an identity, a
 * role or the "who is the admin" record from the payload. The only thing read
 * from it is the id of the user to impersonate; everything else comes from the
 * signed token and the database.
 */

const IDENTITY_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  firstName: true,
  lastName: true,
  emailVerified: true,
  archivedAt: true,
} as const;

type IdentityRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: "ADMIN" | "VOLUNTEER";
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  archivedAt: Date | null;
};

function applyIdentity(token: JWT, user: IdentityRow): void {
  token.sub = user.id;
  token.name = user.name;
  token.email = user.email;
  token.role = user.role;
  token.phone = user.phone || undefined;
  token.firstName = user.firstName || undefined;
  token.lastName = user.lastName || undefined;
  token.emailVerified = user.emailVerified || false;
}

function readTargetUserId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const id = (payload as { targetUserId?: unknown }).targetUserId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Switch the token to the target user, if and only if the token's current
 * user is an active admin in the database and is not already impersonating.
 *
 * Returns whether the switch happened. On refusal the token is left untouched.
 */
export async function startImpersonation(
  token: JWT,
  payload: unknown,
): Promise<boolean> {
  // No nesting: an impersonated session has the target's rights only.
  if (token.impersonating) return false;

  const targetUserId = readTargetUserId(payload);
  if (!targetUserId || !token.sub) return false;

  // The role in the token is only as fresh as the last sign-in, so the admin
  // check reads the database.
  const admin = await prisma.user.findUnique({
    where: { id: token.sub },
    select: IDENTITY_SELECT,
  });
  if (!admin || admin.role !== "ADMIN" || admin.archivedAt) return false;

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: IDENTITY_SELECT,
  });
  if (!target) return false;

  token.impersonating = {
    adminId: admin.id,
    adminEmail: admin.email,
    adminName: admin.name,
  };
  applyIdentity(token, target);
  return true;
}

/**
 * Restore the admin recorded in the token when impersonation started.
 *
 * Returns whether the token was restored. If the admin account has since been
 * removed the token is left as it is (still marked as impersonating) rather
 * than turned into an ordinary session for the impersonated user.
 */
export async function stopImpersonation(token: JWT): Promise<boolean> {
  if (!token.impersonating) return false;

  const admin = await prisma.user.findUnique({
    where: { id: token.impersonating.adminId },
    select: IDENTITY_SELECT,
  });
  if (!admin) return false;

  token.impersonating = undefined;
  applyIdentity(token, admin);
  return true;
}
