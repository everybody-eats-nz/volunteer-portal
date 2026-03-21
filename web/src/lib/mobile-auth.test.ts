import { vi, describe, it, expect, beforeEach } from "vitest";

// Must set env before importing the module
vi.stubEnv("AUTH_SECRET", "test-secret-for-mobile-auth-tests");

// Mock Prisma before importing mobile-auth
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import {
  signMobileToken,
  verifyMobileToken,
  getMobileUser,
  toMobileUser,
} from "./mobile-auth";

describe("Mobile Authentication", () => {
  describe("signMobileToken / verifyMobileToken", () => {
    it("should sign and verify a valid JWT token", async () => {
      const token = await signMobileToken("user-123", "test@example.com");

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts

      const payload = await verifyMobileToken(token);
      expect(payload.sub).toBe("user-123");
      expect(payload.email).toBe("test@example.com");
      expect(payload.iss).toBe("everybody-eats");
      expect(payload.aud).toBe("mobile");
    });

    it("should reject a tampered token", async () => {
      const token = await signMobileToken("user-123", "test@example.com");
      const tampered = token.slice(0, -5) + "XXXXX";

      await expect(verifyMobileToken(tampered)).rejects.toThrow();
    });

    it("should reject a completely invalid string", async () => {
      await expect(verifyMobileToken("not-a-jwt")).rejects.toThrow();
    });
  });

  describe("toMobileUser", () => {
    it("should map a DB user to the mobile shape", () => {
      const result = toMobileUser({
        id: "user-1",
        name: "Aroha Williams",
        email: "aroha@example.com",
        role: "VOLUNTEER",
        profilePhotoUrl: "https://example.com/photo.jpg",
        profileCompleted: true,
        firstName: "Aroha",
        lastName: "Williams",
        phone: "021 123 4567",
        dateOfBirth: new Date("1995-01-01"),
        emergencyContactName: "Hemi",
        emergencyContactPhone: "021 765 4321",
        volunteerAgreementAccepted: true,
        healthSafetyPolicyAccepted: true,
      });

      expect(result).toEqual({
        id: "user-1",
        name: "Aroha Williams",
        email: "aroha@example.com",
        role: "VOLUNTEER",
        image: "https://example.com/photo.jpg",
        profileComplete: true,
      });
    });

    it("should detect incomplete profiles", () => {
      const result = toMobileUser({
        id: "user-2",
        name: null,
        email: "new@example.com",
        role: "VOLUNTEER",
        profilePhotoUrl: null,
        profileCompleted: false,
        firstName: null,
        lastName: null,
        phone: null,
        dateOfBirth: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        volunteerAgreementAccepted: false,
        healthSafetyPolicyAccepted: false,
      });

      expect(result.profileComplete).toBe(false);
    });
  });

  describe("getMobileUser", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return null for a request with no Authorization header", async () => {
      const request = new Request("http://localhost/api/test");
      const result = await getMobileUser(request);
      expect(result).toBeNull();
    });

    it("should return null for a non-Bearer token", async () => {
      const request = new Request("http://localhost/api/test", {
        headers: { Authorization: "Basic abc123" },
      });
      const result = await getMobileUser(request);
      expect(result).toBeNull();
    });

    it("should return null for an invalid JWT", async () => {
      const request = new Request("http://localhost/api/test", {
        headers: { Authorization: "Bearer invalid-token" },
      });
      const result = await getMobileUser(request);
      expect(result).toBeNull();
    });

    it("should return the user for a valid token", async () => {
      const { prisma } = await import("@/lib/prisma");
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        role: "VOLUNTEER",
        profilePhotoUrl: null,
        profileCompleted: true,
        firstName: "Test",
        lastName: "User",
        phone: "021 111 2222",
        dateOfBirth: new Date("1990-01-01"),
        emergencyContactName: "Contact",
        emergencyContactPhone: "021 333 4444",
        volunteerAgreementAccepted: true,
        healthSafetyPolicyAccepted: true,
      });

      const token = await signMobileToken("user-1", "test@example.com");
      const request = new Request("http://localhost/api/test", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await getMobileUser(request);
      expect(result).not.toBeNull();
      expect(result!.id).toBe("user-1");
      expect(result!.email).toBe("test@example.com");
    });

    it("should return null if the user no longer exists in DB", async () => {
      const { prisma } = await import("@/lib/prisma");
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const token = await signMobileToken("deleted-user", "gone@example.com");
      const request = new Request("http://localhost/api/test", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await getMobileUser(request);
      expect(result).toBeNull();
    });
  });
});
