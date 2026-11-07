import { vi, describe, it, expect, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth-options", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/rate-limit", () => ({
  friendRequestLimiter: vi.fn(),
  getClientIdentifier: (_req: unknown, userId: string) => `user:${userId}`,
}));
vi.mock("@/lib/friend-request-service", () => ({
  FRIEND_REQUEST_MESSAGE_MAX_LENGTH: 500,
  sendFriendRequestFromUserToEmail: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { friendRequestLimiter } from "@/lib/rate-limit";
import { sendFriendRequestFromUserToEmail } from "@/lib/friend-request-service";
import { POST } from "./route";

type Mock = ReturnType<typeof vi.fn>;
const mockSession = getServerSession as Mock;
const mockUserFind = prisma.user.findUnique as unknown as Mock;
const mockLimiter = friendRequestLimiter as Mock;
const mockToEmail = sendFriendRequestFromUserToEmail as Mock;

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }) as unknown as NextRequest
  );
}

describe("POST /api/friends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.mockResolvedValue({ user: { email: "me@example.com" } });
    mockUserFind.mockResolvedValue({ id: "user-1", email: "me@example.com" });
    mockLimiter.mockReturnValue({
      success: true,
      limit: 5,
      remaining: 4,
      resetTime: Date.now() + 60_000,
    });
  });

  it("returns 401 without a session", async () => {
    mockSession.mockResolvedValue(null);

    const response = await post({ email: "friend@example.com" });

    expect(response.status).toBe(401);
    expect(mockToEmail).not.toHaveBeenCalled();
  });

  it("returns 201 with the request id when sent", async () => {
    mockToEmail.mockResolvedValue({ ok: true, requestId: "req-1" });

    const response = await post({
      email: "friend@example.com",
      message: "Kia ora!",
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      message: "Friend request sent successfully",
      requestId: "req-1",
    });
    expect(mockToEmail).toHaveBeenCalledWith("user-1", "friend@example.com", {
      message: "Kia ora!",
    });
  });

  it("returns 400 for an invalid email", async () => {
    const response = await post({ email: "nope" });

    expect(response.status).toBe(400);
    expect(mockToEmail).not.toHaveBeenCalled();
  });

  it("returns 429 once the rate limit is spent", async () => {
    mockLimiter.mockReturnValue({
      success: false,
      limit: 5,
      remaining: 0,
      resetTime: Date.now() + 60_000,
    });

    const response = await post({ email: "friend@example.com" });

    expect(response.status).toBe(429);
    expect(mockToEmail).not.toHaveBeenCalled();
  });

  // The route now takes its errors from the shared service, so the status
  // codes are the service's: 404 unknown email, 403 requests turned off,
  // 409 already connected or already sent.
  it.each([
    [404, "No volunteer has signed up with that email"],
    [403, "User is not accepting friend requests"],
    [409, "Friendship already exists or is pending"],
    [409, "Friend request already sent"],
  ])("passes on the service's %i: %s", async (status, error) => {
    mockToEmail.mockResolvedValue({ ok: false, error, status });

    const response = await post({ email: "friend@example.com" });

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  });
});
