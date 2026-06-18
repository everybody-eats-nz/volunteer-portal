import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendPushToTokens, isExpoPushToken } from "./expo-push";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pushToken: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const deleteMany = vi.mocked(prisma.pushToken.deleteMany);

const TOKEN = "ExponentPushToken[abc123]";

/** Build a fetch Response stub that returns the given JSON body. */
function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function ticketResponse(tickets: unknown[]) {
  return jsonResponse({ data: tickets });
}

describe("isExpoPushToken", () => {
  it("accepts Expo token formats and rejects others", () => {
    expect(isExpoPushToken("ExponentPushToken[xyz]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[xyz]")).toBe(true);
    expect(isExpoPushToken("ExponentPushToken[]")).toBe(true);
    expect(isExpoPushToken("not-a-token")).toBe(false);
    expect(isExpoPushToken("")).toBe(false);
    // Defensive: guards against non-string values at runtime despite the type.
    expect(isExpoPushToken(null as unknown as string)).toBe(false);
  });
});

describe("dispatchMessages (via sendPushToTokens)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    deleteMany.mockReset().mockResolvedValue({ count: 1 });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does NOT delete the token on InvalidCredentials (server-side push-credential error)", async () => {
    fetchMock.mockResolvedValueOnce(
      ticketResponse([
        { status: "error", message: "creds", details: { error: "InvalidCredentials" } },
      ])
    );

    await sendPushToTokens([TOKEN], { title: "t", body: "b" });

    expect(deleteMany).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Push credentials misconfigured")
    );
  });

  it("does NOT delete the token on MismatchSenderId (server-side FCM error)", async () => {
    fetchMock.mockResolvedValueOnce(
      ticketResponse([
        { status: "error", message: "sender", details: { error: "MismatchSenderId" } },
      ])
    );

    await sendPushToTokens([TOKEN], { title: "t", body: "b" });

    expect(deleteMany).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Push credentials misconfigured")
    );
  });

  it("deletes the token on DeviceNotRegistered (token is permanently dead)", async () => {
    fetchMock.mockResolvedValueOnce(
      ticketResponse([
        { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } },
      ])
    );

    await sendPushToTokens([TOKEN], { title: "t", body: "b" });

    expect(deleteMany).toHaveBeenCalledWith({
      where: { token: { in: [TOKEN] } },
    });
  });

  it("logs and counts top-level Expo errors instead of silently succeeding", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ errors: [{ message: "An access token is required." }] })
    );

    await sendPushToTokens([TOKEN], { title: "t", body: "b" });

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Request rejected"),
      expect.stringContaining("access token")
    );
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("skips the request entirely when no tokens are valid", async () => {
    await sendPushToTokens(["garbage"], { title: "t", body: "b" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
