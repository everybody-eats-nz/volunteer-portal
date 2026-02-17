import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateSurveyToken, getSurveyUrl } from "./survey-tokens";

describe("survey-tokens", () => {
  describe("generateSurveyToken", () => {
    it("should generate a 64-character hex string", () => {
      const token = generateSurveyToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });

    it("should generate unique tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateSurveyToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe("getSurveyUrl", () => {
    const originalEnv = process.env.NEXTAUTH_URL;

    beforeEach(() => {
      process.env.NEXTAUTH_URL = "https://example.com";
    });

    afterEach(() => {
      process.env.NEXTAUTH_URL = originalEnv;
    });

    it("should construct URL with token", () => {
      const token = "abc123";
      const url = getSurveyUrl(token);
      expect(url).toBe("https://example.com/surveys/abc123");
    });

    it("should use provided baseUrl over environment variable", () => {
      const token = "abc123";
      const url = getSurveyUrl(token, "https://custom.com");
      expect(url).toBe("https://custom.com/surveys/abc123");
    });

    it("should fallback to localhost if no NEXTAUTH_URL", () => {
      delete process.env.NEXTAUTH_URL;
      const token = "abc123";
      const url = getSurveyUrl(token);
      expect(url).toBe("http://localhost:3000/surveys/abc123");
    });

    it("should handle tokens with special characters", () => {
      const token = "abc123def456";
      const url = getSurveyUrl(token);
      expect(url).toContain(token);
    });
  });
});
