import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Redirect authenticated users away from the homepage
  if (request.nextUrl.pathname === "/") {
    const token = await getToken({ req: request });
    if (token) {
      const role = token.role as string | undefined;
      const destination = role === "ADMIN" ? "/admin" : "/dashboard";
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
