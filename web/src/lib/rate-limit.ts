import { NextRequest } from "next/server";

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting (in production, use Redis)
const store: RateLimitStore = {};

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

export function rateLimit(options: RateLimitOptions) {
  return (identifier: string): { success: boolean; limit: number; remaining: number; resetTime: number } => {
    const now = Date.now();
    const key = `rate_limit:${identifier}`;
    
    // Initialize or reset if window has passed
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + options.windowMs,
      };
    }
    
    // Check if limit exceeded
    if (store[key].count >= options.maxRequests) {
      return {
        success: false,
        limit: options.maxRequests,
        remaining: 0,
        resetTime: store[key].resetTime,
      };
    }
    
    // Increment count
    store[key].count++;
    
    return {
      success: true,
      limit: options.maxRequests,
      remaining: options.maxRequests - store[key].count,
      resetTime: store[key].resetTime,
    };
  };
}

// Helper function to get client identifier
export function getClientIdentifier(req: NextRequest, userId?: string): string {
  // Use user ID if available, otherwise fall back to IP
  if (userId) {
    return `user:${userId}`;
  }
  
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : "unknown";
  return `ip:${ip}`;
}

// Pre-configured rate limiters for different use cases
export const friendRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 friend requests per 15 minutes
});

export const generalApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
});