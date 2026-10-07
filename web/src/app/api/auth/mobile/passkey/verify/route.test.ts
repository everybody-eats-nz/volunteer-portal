import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

// Mock dependencies before importing the route
vi.mock("@/lib/prisma", () => ({
  prisma: {
    passkey: { findUnique: vi.fn(), update: vi.fn() },
    user: { update: vi.fn() },
  },
}));

vi.mock("@/lib/webauthn-utils", () => ({
  verifyAndConsumeChallenge: vi.fn(),
  // The credentialId lookup only needs a deterministic buffer - the value is
  // irrelevant because prisma.passkey.findUnique is mocked.
  base64URLToBuffer: vi.fn(() => new Uint8Array([1, 2, 3])),
  bufferToBase64URL: vi.fn(() => "cred-id-b64url"),
}));

vi.mock("@/lib/webauthn-config", () => ({
  rpID: "example.com",
  expectedOrigin: "https://example.com",
}));

vi.mock("@/lib/archive-service", () => ({
  unarchiveUser: vi.fn(),
}));

vi.mock("@simplewebauthn/server", () => ({
  verifyAuthenticationResponse: vi.fn(),
}));

vi.mock("@/lib/mobile-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mobile-auth")>()),
  signMobileToken: vi.fn(),
}));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { verifyAndConsumeChallenge } from "@/lib/webauthn-utils";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { unarchiveUser } from "@/lib/archive-service";
import { signMobileToken } from "@/lib/mobile-auth";

const mockFindPasskey = vi.mocked(prisma.passkey.findUnique);
const mockUpdatePasskey = vi.mocked(prisma.passkey.update);
const mockUpdateUser = vi.mocked(prisma.user.update);
const mockVerifyChallenge = vi.mocked(verifyAndConsumeChallenge);
const mockVerifyAssertion = vi.mocked(verifyAuthenticationResponse);
const mockUnarchive = vi.mocked(unarchiveUser);
const mockSignToken = vi.mocked(signMobileToken);

function buildAuthenticationResponse(): AuthenticationResponseJSON {
  const clientDataJSON = Buffer.from(
    JSON.stringify({
      challenge: "test-challenge",
      origin: "https://example.com",
      type: "webauthn.get",
    })
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

function buildPasskey(userOverrides: Record<string, unknown> = {}) {
  return {
    id: "passkey-1",
    credentialId: Buffer.from([1, 2, 3]),
    credentialPublicKey: Buffer.from([4, 5, 6]),
    counter: BigInt(5),
    transports: ["internal"],
    user: {
      id: "user-1",
      name: "Aroha Williams",
      email: "aroha@example.com",
      role: "VOLUNTEER",
      profilePhotoUrl: null,
      profileCompleted: true,
      firstName: "Aroha",
      lastName: "Williams",
      phone: "021 123 4567",
      dateOfBirth: new Date("1995-06-15"),
      emergencyContactName: "Hemi Williams",
      emergencyContactPhone: "021 765 4321",
      volunteerAgreementAccepted: true,
      healthSafetyPolicyAccepted: true,
      archivedAt: null,
      ...userOverrides,
    },
  };
}

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/mobile/passkey/verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Sensible defaults: challenge OK, assertion verified, counter advanced.
  mockVerifyChallenge.mockResolvedValue(undefined as never);
  mockVerifyAssertion.mockResolvedValue({
    verified: true,
    authenticationInfo: { newCounter: 6 },
  } as never);
  mockUpdatePasskey.mockResolvedValue({} as never);
  mockUpdateUser.mockResolvedValue({} as never);
  mockUnarchive.mockResolvedValue(undefined);
  mockSignToken.mockResolvedValue("signed-jwt");
});

describe("POST /api/auth/mobile/passkey/verify", () => {
  it("issues a token for an active user without touching archive state", async () => {
    mockFindPasskey.mockResolvedValue(buildPasskey() as never);

    const res = await POST(
      makeRequest({ authenticationResponse: buildAuthenticationResponse() })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.token).toBe("signed-jwt");
    expect(data.user).toMatchObject({ id: "user-1", email: "aroha@example.com" });
    expect(mockUnarchive).not.toHaveBeenCalled();
  });

  it("selects archivedAt so archived users can be detected", async () => {
    mockFindPasskey.mockResolvedValue(buildPasskey() as never);

    await POST(makeRequest({ authenticationResponse: buildAuthenticationResponse() }));

    expect(mockFindPasskey).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          user: { select: expect.objectContaining({ archivedAt: true }) },
        },
      })
    );
  });

  it("reactivates an archived user before issuing the token", async () => {
    mockFindPasskey.mockResolvedValue(
      buildPasskey({ archivedAt: new Date("2026-01-01") }) as never
    );

    const res = await POST(
      makeRequest({ authenticationResponse: buildAuthenticationResponse() })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.token).toBe("signed-jwt");
    expect(mockUnarchive).toHaveBeenCalledWith({
      userId: "user-1",
      triggerSource: "SELF_REACTIVATION",
      actorId: "user-1",
    });
    // The token is only useful once getMobileUser stops rejecting the user.
    expect(mockUnarchive.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignToken.mock.invocationCallOrder[0]
    );
  });

  it("does not reactivate or issue a token when the assertion fails", async () => {
    mockFindPasskey.mockResolvedValue(
      buildPasskey({ archivedAt: new Date("2026-01-01") }) as never
    );
    mockVerifyAssertion.mockResolvedValue({ verified: false } as never);

    const res = await POST(
      makeRequest({ authenticationResponse: buildAuthenticationResponse() })
    );

    expect(res.status).toBe(400);
    expect(mockUnarchive).not.toHaveBeenCalled();
    expect(mockSignToken).not.toHaveBeenCalled();
  });

  it("does not reactivate when the passkey counter goes backwards", async () => {
    mockFindPasskey.mockResolvedValue(
      buildPasskey({ archivedAt: new Date("2026-01-01") }) as never
    );
    mockVerifyAssertion.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 5 },
    } as never);

    const res = await POST(
      makeRequest({ authenticationResponse: buildAuthenticationResponse() })
    );

    expect(res.status).toBe(403);
    expect(mockUnarchive).not.toHaveBeenCalled();
    expect(mockSignToken).not.toHaveBeenCalled();
  });

  it("returns 500 without a token when reactivation fails", async () => {
    mockFindPasskey.mockResolvedValue(
      buildPasskey({ archivedAt: new Date("2026-01-01") }) as never
    );
    mockUnarchive.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(
      makeRequest({ authenticationResponse: buildAuthenticationResponse() })
    );

    expect(res.status).toBe(500);
    expect(mockSignToken).not.toHaveBeenCalled();
  });
});
