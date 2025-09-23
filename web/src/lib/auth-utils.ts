import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export interface AuthResult {
  session: Awaited<ReturnType<typeof getServerSession>> | null;
  user: {
    id: string;
    email: string;
    role: "ADMIN" | "VOLUNTEER";
    name?: string;
    firstName?: string;
    lastName?: string;
  } | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
}

/**
 * Get authentication info for conditional rendering
 * Use this when you need to show/hide elements based on auth status
 * Route-level protection is handled by middleware
 */
export async function getAuthInfo(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  
  return {
    session,
    user: session?.user ? {
      id: session.user.id!,
      email: session.user.email!,
      role: session.user.role!,
      name: session.user.name || undefined,
      firstName: session.user.firstName || undefined,
      lastName: session.user.lastName || undefined,
    } : null,
    isLoggedIn: !!session?.user,
    isAdmin: session?.user?.role === "ADMIN",
  };
}

/**
 * Helper functions for common auth checks
 */
export const authHelpers = {
  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    const auth = await getAuthInfo();
    return auth.isLoggedIn;
  },

  /**
   * Check if user is admin
   */
  async isAdmin(): Promise<boolean> {
    const auth = await getAuthInfo();
    return auth.isAdmin;
  },

  /**
   * Get current user info if logged in
   */
  async getCurrentUser() {
    const auth = await getAuthInfo();
    return auth.user;
  },
};