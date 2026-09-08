import { NextResponse } from "next/server";
import { requireMobileUser, type MobileUser } from "@/lib/mobile-auth";
import { getDriverProfile } from "@/lib/van/drivers";
import type { DriverStatus } from "@/generated/client";

/**
 * One driver gate for every `/api/mobile/van/*` route, the way
 * `admin-guard.ts` is one admin gate for the van admin routes.
 *
 * These endpoints exist at all because `/api/van/*` authenticates with a
 * NextAuth cookie and the app carries a JWT instead. Widening those handlers
 * to also accept a bearer token would take CSRF protection off the cookie path
 * of the same route that writes the odometer chain — a browser can be made to
 * post to a cookie-authenticated endpoint, and "or a bearer token" is how that
 * protection quietly stops applying. So the app gets its own thin handlers
 * over the same functions in `lib/van/`, and the write logic stays single.
 */

export type VanGuardDenial = { denied: NextResponse };

export type MobileDriver = {
  user: MobileUser;
  userId: string;
  status: DriverStatus;
  denied?: never;
};

/**
 * The only gate on driving: an APPROVED `DriverProfile`. Never a role check —
 * a volunteer who also drives stays a volunteer, and an outside borrower who
 * drives never becomes an admin.
 */
export async function requireMobileDriver(
  request: Request
): Promise<MobileDriver | VanGuardDenial> {
  const auth = await requireMobileUser(request);
  if (!auth) {
    return {
      denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const profile = await getDriverProfile(auth.userId);
  if (profile?.status !== "APPROVED") {
    return {
      denied: NextResponse.json(
        {
          error: "Your driver account is not approved yet.",
          driverStatus: profile?.status ?? null,
        },
        { status: 403 }
      ),
    };
  }

  return { user: auth.user, userId: auth.userId, status: profile.status };
}
