import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { createHash } from "crypto";

/**
 * Get secure CORS headers based on environment
 */
export function getSecureCORSHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();

  // Check if origin is allowed
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowedOrigin ? origin : getAllowedOrigins()[0],
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Cache-Control, Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}

/**
 * Get allowed origins based on environment
 */
function getAllowedOrigins(): string[] {
  const baseOrigins = [
    process.env.NEXTAUTH_URL || "http://localhost:3000",
  ];

  // In development, allow localhost variations
  if (process.env.NODE_ENV === "development") {
    baseOrigins.push(
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://localhost:3000"
    );
  }

  // Add production domains from environment
  if (process.env.ALLOWED_ORIGINS) {
    baseOrigins.push(...process.env.ALLOWED_ORIGINS.split(","));
  }

  return baseOrigins.filter(Boolean);
}

/**
 * Generate a secure connection token for SSE streams
 */
export function generateConnectionToken(userId: string, sessionId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || "fallback-secret";
  const timestamp = Date.now().toString();
  const payload = `${userId}:${sessionId}:${timestamp}`;

  return createHash("sha256")
    .update(payload + secret)
    .digest("hex")
    .substring(0, 32);
}

/**
 * Validate a connection token
 */
export function validateConnectionToken(
  token: string,
  userId: string,
  sessionId: string,
  maxAge: number = 300000 // 5 minutes
): boolean {
  try {
    const secret = process.env.NEXTAUTH_SECRET || "fallback-secret";

    // Generate expected token for comparison
    const currentTime = Date.now();

    // Check against tokens generated within the last maxAge milliseconds
    for (let i = 0; i < maxAge; i += 1000) {
      const testTimestamp = (currentTime - i).toString();
      const testPayload = `${userId}:${sessionId}:${testTimestamp}`;
      const expectedToken = createHash("sha256")
        .update(testPayload + secret)
        .digest("hex")
        .substring(0, 32);

      if (token === expectedToken) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("[SSE Security] Token validation error:", error);
    return false;
  }
}

/**
 * Validate session and generate secure headers for SSE
 */
export async function validateSSERequest(
  request: NextRequest,
  requiredRole?: "ADMIN" | "VOLUNTEER"
): Promise<{
  isValid: boolean;
  userId?: string;
  userRole?: string;
  headers: Record<string, string>;
  error?: string;
}> {
  try {
    // Validate session
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return {
        isValid: false,
        headers: getSecureCORSHeaders(request),
        error: "Unauthorized: No valid session"
      };
    }

    // Check role if required
    if (requiredRole && session.user.role !== requiredRole) {
      return {
        isValid: false,
        headers: getSecureCORSHeaders(request),
        error: `Unauthorized: Required role ${requiredRole}`
      };
    }

    return {
      isValid: true,
      userId: session.user.id,
      userRole: session.user.role,
      headers: getSecureCORSHeaders(request),
    };
  } catch (error) {
    console.error("[SSE Security] Session validation error:", error);
    return {
      isValid: false,
      headers: getSecureCORSHeaders(request),
      error: "Internal security validation error"
    };
  }
}

/**
 * Rate limiting for SSE connections
 */
const connectionAttempts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  maxAttempts: number = 10,
  windowMs: number = 60000 // 1 minute
): boolean {
  const now = Date.now();
  const userAttempts = connectionAttempts.get(identifier);

  if (!userAttempts || now > userAttempts.resetTime) {
    // Reset or initialize
    connectionAttempts.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (userAttempts.count >= maxAttempts) {
    return false; // Rate limited
  }

  userAttempts.count++;
  return true;
}

/**
 * Get standard SSE security headers
 */
export function getSSEHeaders(corsHeaders: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no", // Disable Nginx buffering
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    ...corsHeaders,
  };
}