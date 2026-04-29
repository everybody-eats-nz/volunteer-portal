import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PHID_COOKIE = "eea_phid";
const PHID_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function middleware(request: NextRequest) {
  // Authenticated users skip the homepage entirely
  if (request.nextUrl.pathname === "/") {
    const token = await getToken({ req: request });
    if (token) {
      const role = token.role as string | undefined;
      const destination = role === "ADMIN" ? "/admin" : "/dashboard";
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  // Ensure every visitor to a public funnel entry point has a stable
  // anonymous distinct_id used as the PostHog A/B-test bucketing key.
  const response = NextResponse.next();
  if (!request.cookies.has(PHID_COOKIE)) {
    response.cookies.set(PHID_COOKIE, crypto.randomUUID(), {
      maxAge: PHID_MAX_AGE,
      sameSite: "lax",
      path: "/",
      httpOnly: false, // readable by client-side analytics if ever needed
    });
  }

  return response;
}

export const config = {
  // Funnel-relevant public paths. Cookie persists once set, so the entry
  // points just need to guarantee it's installed at first contact.
  matcher: ["/", "/register", "/login", "/shifts/:path*"],
};
