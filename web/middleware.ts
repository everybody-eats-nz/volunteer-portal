import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Define route patterns and their required auth levels
// Default to admin access, explicitly allowlist public and user routes
const routeConfig = {
  // Public routes - accessible to everyone
  public: [
    "/",
    "/login",
    "/register", 
    "/verify-email", // Email verification page
    "/shifts", // Public shifts page
    "/api/auth", // NextAuth routes and auth endpoints
    "/api/migration", // Migration registration API
  ],
  
  // User routes - require login (volunteer access)
  user: [
    "/dashboard",
    "/profile", // Including /profile/edit and sub-routes
    "/achievements", 
    "/friends",
    "/shifts/mine", // User's personal shifts
    "/shifts/details", // Shift details and signup 
    "/group-bookings", // Group booking functionality
    "/api/profile",
    "/api/achievements", 
    "/api/friends",
    "/api/notifications",
    "/api/shifts", // User shift-related API calls
    "/api/group-bookings", // Group booking API
  ],
  
  // Everything else defaults to admin-only access
};

/**
 * Check if a path matches any pattern in the given array
 */
function matchesPattern(pathname: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    // Exact match
    if (pattern === pathname) return true;
    
    // Prefix match for API routes and nested paths
    if (pattern.endsWith("/") && pathname.startsWith(pattern)) return true;
    if (pathname.startsWith(pattern + "/")) return true;
    
    return false;
  });
}

/**
 * Determine the required auth level for a given path
 * Default to admin access for security - explicitly allowlist public and user routes
 */
function getRequiredAuthLevel(pathname: string): "public" | "user" | "admin" {
  if (matchesPattern(pathname, routeConfig.public)) return "public";
  if (matchesPattern(pathname, routeConfig.user)) return "user";
  return "admin"; // Default to admin-only access for security
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get the token from NextAuth
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET 
  });
  
  const requiredLevel = getRequiredAuthLevel(pathname);
  const isLoggedIn = !!token;
  const isAdmin = token?.role === "ADMIN";
  
  // Public routes - always allow
  if (requiredLevel === "public") {
    return NextResponse.next();
  }
  
  // User routes - require login
  if (requiredLevel === "user") {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }
  
  // Admin routes - require admin role
  if (requiredLevel === "admin") {
    if (!isLoggedIn) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    if (!isAdmin) {
      // Redirect non-admin users to dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    
    return NextResponse.next();
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$).*)',
  ],
};