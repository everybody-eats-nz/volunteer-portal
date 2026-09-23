import { prisma } from "@/lib/prisma";

export type ResetTokenStatus = "valid" | "missing" | "invalid" | "expired";

/**
 * Check a password reset token before showing the reset form, so a link that
 * has already been used (the token is cleared once the password is changed),
 * was superseded by a newer request, or has expired gets a clear message
 * instead of a form that only fails on submit.
 *
 * Deliberately not a server action: it's only ever called from the
 * reset-password server component.
 */
export async function getResetTokenStatus(
  token: string | null | undefined
): Promise<ResetTokenStatus> {
  if (!token) return "missing";

  const user = await prisma.user.findUnique({
    where: { passwordResetToken: token },
    select: { passwordResetTokenExpiresAt: true },
  });

  if (!user?.passwordResetTokenExpiresAt) return "invalid";
  if (user.passwordResetTokenExpiresAt < new Date()) return "expired";
  return "valid";
}
