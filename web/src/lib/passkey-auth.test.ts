import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { verifyPasskeyAuthentication } from "./passkey-auth";
import { prisma } from "./prisma";
import { verifyAndConsumeChallenge } from "./webauthn-utils";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { unarchiveUser } from "./archive-service";

// --- Mocks ---------------------------------------------------------------

vi.mock("./prisma", () => ({
  prisma: {
    passkey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("./webauthn-utils", () => ({
  verifyAndConsumeChallenge: vi.fn(),
  // credentialId lookup only needs a deterministic buffer — the value is
  // irrelevant because prisma.passkey.findUnique is mocked.
  base64URLToBuffer: vi.fn(() => new Uint8Array([1, 2, 3])),
  bufferToBase64URL: vi.fn(() => "cred-id-b64url"),
}));

vi.mock("./webauthn-config", () => ({
  rpID: "example.com",
  expectedOrigin: "https://example.com",
}));

vi.mock("./archive-service", () => ({
  unarchiveUser: vi.fn(),
}));

vi.mock("@simplewebauthn/server", () => ({
  verifyAuthenticationResponse: vi.fn(),
}));

// --- Helpers -------------------------------------------------------------

const mockFindUnique = vi.mocked(prisma.passkey.findUnique);
const mockUpdate = vi.mocked(prisma.passkey.update);
const mockVerifyChallenge = vi.mocked(verifyAndConsumeChallenge);
const mockVerifyAssertion = vi.mocked(verifyAuthenticationResponse);
const mockUnarchive = vi.mocked(unarchiveUser);

/**
 * Build a minimal AuthenticationResponseJSON. Only `.id` and
 * `.response.clientDataJSON` are read by the function (the rest is consumed by
 * the mocked `verifyAuthenticationResponse`).
 */
function buildResponse(challenge = "test-challenge"): AuthenticationResponseJSON {
  const clientDataJSON = Buffer.from(
    JSON.stringify({ challenge, origin: "https://example.com", type: "webauthn.get" })
  ).toString("base64url");

  return {
    id: "credential-id",
    rawId: "credential-id",
    response: {
      clientDataJSON,
      authenticatorData: "auth-data",
      signature: "sig",
    },
    clientExtensionResults: {},
    type: "public-key",
  } as unknown as AuthenticationResponseJSON;
}

function buildPasskey(overrides: Record<string, unknown> = {}) {
  const { user: userOverrides, ...rest } = overrides;
  return {
    id: "passkey-1",
    credentialId: Buffer.from([1, 2, 3]),
    credentialPublicKey: Buffer.from([4, 5, 6]),
    counter: BigInt(5),
    transports: ["internal"],
    ...rest,
    user: {
      id: "user-1",
      email: "kiaora@example.com",
      name: "Kia Ora",
      firstName: "Kia",
      lastName: "Ora",
      role: "VOLUNTEER",
      phone: "021000000",
      emailVerified: true,
      archivedAt: null,
      ...(userOverrides as Record<string, unknown>),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Sensible defaults: challenge OK, assertion verified, counter advanced.
  mockVerifyChallenge.mockResolvedValue(undefined as never);
  mockUpdate.mockResolvedValue({} as never);
  mockVerifyAssertion.mockResolvedValue({
    verified: true,
    authenticationInfo: { newCounter: 6 },
  } as never);
});

// --- Tests ---------------------------------------------------------------

describe("verifyPasskeyAuthentication", () => {
  it("returns 400 when authentication response is missing", async () => {
    const result = await verifyPasskeyAuthentication(
      undefined as unknown as AuthenticationResponseJSON
    );

    expect(result.verified).toBe(false);
    if (!result.verified) expect(result.status).toBe(400);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the passkey is not found", async () => {
    mockFindUnique.mockResolvedValue(null as never);

    const result = await verifyPasskeyAuthentication(buildResponse());

    expect(result.verified).toBe(false);
    if (!result.verified) {
      expect(result.status).toBe(404);
      expect(result.error).toBe("Passkey not found");
    }
  });

  it("returns 400 when the challenge is invalid or expired", async () => {
    mockFindUnique.mockResolvedValue(buildPasskey() as never);
    mockVerifyChallenge.mockRejectedValue(new Error("Challenge expired") as never);

    const result = await verifyPasskeyAuthentication(buildResponse());

    expect(result.verified).toBe(false);
    if (!result.verified) {
      expect(result.status).toBe(400);
      expect(result.error).toBe("Invalid or expired challenge");
    }
    // The assertion must not be verified if the challenge failed.
    expect(mockVerifyAssertion).not.toHaveBeenCalled();
  });

  it("returns 400 when assertion verification throws (invalid signature)", async () => {
    mockFindUnique.mockResolvedValue(buildPasskey() as never);
    mockVerifyAssertion.mockRejectedValue(new Error("bad signature") as never);

    const result = await verifyPasskeyAuthentication(buildResponse());

    expect(result.verified).toBe(false);
    if (!result.verified) {
      expect(result.status).toBe(400);
      expect(result.error).toBe("Failed to verify authentication");
    }
  });

  it("returns 400 when verification reports not verified", async () => {
    mockFindUnique.mockResolvedValue(buildPasskey() as never);
    mockVerifyAssertion.mockResolvedValue({
      verified: false,
      authenticationInfo: { newCounter: 6 },
    } as never);

    const result = await verifyPasskeyAuthentication(buildResponse());

    expect(result.verified).toBe(false);
    if (!result.verified) expect(result.status).toBe(400);
  });

  it("returns 403 when the counter did not increment (cloned credential)", async () => {
    mockFindUnique.mockResolvedValue(buildPasskey({ counter: BigInt(10) }) as never);
    mockVerifyAssertion.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 8 }, // lower than stored 10
    } as never);

    const result = await verifyPasskeyAuthentication(buildResponse());

    expect(result.verified).toBe(false);
    if (!result.verified) expect(result.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("succeeds when the authenticator does not support counters (counter = 0)", async () => {
    mockFindUnique.mockResolvedValue(buildPasskey({ counter: BigInt(0) }) as never);
    mockVerifyAssertion.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 0 },
    } as never);

    const result = await verifyPasskeyAuthentication(buildResponse());

    expect(result.verified).toBe(true);
    if (result.verified) expect(result.user.id).toBe("user-1");
  });

  it("returns the verified user and updates the counter on success", async () => {
    mockFindUnique.mockResolvedValue(buildPasskey() as never);

    const result = await verifyPasskeyAuthentication(buildResponse());

    expect(result.verified).toBe(true);
    if (result.verified) {
      expect(result.user).toEqual({
        id: "user-1",
        email: "kiaora@example.com",
        name: "Kia Ora",
        firstName: "Kia",
        lastName: "Ora",
        role: "VOLUNTEER",
        phone: "021000000",
        emailVerified: true,
      });
    }
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "passkey-1" },
      data: expect.objectContaining({ counter: BigInt(6) }),
    });
    expect(mockUnarchive).not.toHaveBeenCalled();
  });

  it("auto-reactivates an archived user on a successful assertion", async () => {
    mockFindUnique.mockResolvedValue(
      buildPasskey({ user: { archivedAt: new Date() } }) as never
    );

    const result = await verifyPasskeyAuthentication(buildResponse());

    expect(result.verified).toBe(true);
    expect(mockUnarchive).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", actorId: "user-1" })
    );
  });
});
