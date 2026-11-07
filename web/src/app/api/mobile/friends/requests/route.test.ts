import { vi, describe, it, expect, beforeEach } from "vitest";

vi.stubEnv("AUTH_SECRET", "test-secret");

vi.mock("@/lib/mobile-auth", () => ({
  requireMobileUser: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  friendRequestLimiter: vi.fn(),
}));

vi.mock("@/lib/friend-request-service", () => ({
  FRIEND_REQUEST_MESSAGE_MAX_LENGTH: 500,
  sendFriendRequestFromUserToUser: vi.fn(),
  sendFriendRequestFromUserToEmail: vi.fn(),
}));

import { POST } from "./route";
import { requireMobileUser } from "@/lib/mobile-auth";
import { friendRequestLimiter } from "@/lib/rate-limit";
import {
  sendFriendRequestFromUserToEmail,
  sendFriendRequestFromUserToUser,
} from "@/lib/friend-request-service";

type Mock = ReturnType<typeof vi.fn>;
const mockRequireMobileUser = requireMobileUser as Mock;
const mockLimiter = friendRequestLimiter as Mock;
const mockToUser = sendFriendRequestFromUserToUser as Mock;
const mockToEmail = sendFriendRequestFromUserToEmail as Mock;

function call(body: unknown) {
  return POST(
    new Request("http://localhost/api/mobile/friends/requests", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

describe("POST /api/mobile/friends/requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireMobileUser.mockResolvedValue({
      user: { id: "user-1" },
      userId: "user-1",
    });
    mockLimiter.mockReturnValue({
      success: true,
      limit: 5,
      remaining: 4,
      resetTime: Date.now() + 60_000,
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireMobileUser.mockResolvedValue(null);

    const response = await call({ email: "friend@example.com" });

    expect(response.status).toBe(401);
    expect(mockToEmail).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that isn't JSON", async () => {
    const response = await call("not json");

    expect(response.status).toBe(400);
  });

  describe("by toUserId (suggested friends)", () => {
    it("sends the request without touching the rate limit", async () => {
      mockToUser.mockResolvedValue({ ok: true, requestId: "req-1" });

      const response = await call({ toUserId: "user-2" });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, requestId: "req-1" });
      expect(mockToUser).toHaveBeenCalledWith("user-1", "user-2");
      expect(mockLimiter).not.toHaveBeenCalled();
    });

    it("requires toUserId when there is no email", async () => {
      const response = await call({});

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "toUserId is required",
      });
      expect(mockToUser).not.toHaveBeenCalled();
    });
  });

  describe("choosing the path", () => {
    it("treats any body with an email key as an email request", async () => {
      // An email key wins even beside a toUserId, so a malformed email is
      // reported rather than silently falling back to the id.
      const response = await call({ toUserId: "user-2", email: null });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Enter a valid email address",
      });
      expect(mockToUser).not.toHaveBeenCalled();
      expect(mockToEmail).not.toHaveBeenCalled();
    });

    it("sends by email when both are given and the email is valid", async () => {
      mockToEmail.mockResolvedValue({ ok: true, requestId: "req-3" });

      const response = await call({
        toUserId: "user-2",
        email: "friend@example.com",
      });

      expect(response.status).toBe(200);
      expect(mockToEmail).toHaveBeenCalledWith(
        "user-1",
        "friend@example.com",
        { message: undefined }
      );
      expect(mockToUser).not.toHaveBeenCalled();
    });
  });

  describe("by email (Add a friend)", () => {
    it("sends the request with the trimmed email and message", async () => {
      mockToEmail.mockResolvedValue({ ok: true, requestId: "req-2" });

      const response = await call({
        email: "  Friend@Example.com ",
        message: "  Kia ora!  ",
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, requestId: "req-2" });
      expect(mockToEmail).toHaveBeenCalledWith(
        "user-1",
        "Friend@Example.com",
        { message: "Kia ora!" }
      );
      expect(mockLimiter).toHaveBeenCalledWith("user:user-1");
    });

    it("rejects an invalid email before spending the rate limit", async () => {
      const response = await call({ email: "not-an-email" });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Enter a valid email address",
      });
      expect(mockLimiter).not.toHaveBeenCalled();
      expect(mockToEmail).not.toHaveBeenCalled();
    });

    it("rejects a message over the length limit", async () => {
      const response = await call({
        email: "friend@example.com",
        message: "x".repeat(501),
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Keep your message under 500 characters",
      });
      expect(mockToEmail).not.toHaveBeenCalled();
    });

    it("returns 429 once the rate limit is spent", async () => {
      mockLimiter.mockReturnValue({
        success: false,
        limit: 5,
        remaining: 0,
        resetTime: Date.now() + 120_000,
      });

      const response = await call({ email: "friend@example.com" });

      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.retryAfter).toBeGreaterThan(0);
      expect(mockToEmail).not.toHaveBeenCalled();
    });

    it("passes on the service's error and status", async () => {
      mockToEmail.mockResolvedValue({
        ok: false,
        error: "No volunteer has signed up with that email",
        status: 404,
      });

      const response = await call({ email: "nobody@example.com" });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: "No volunteer has signed up with that email",
      });
    });
  });
});
