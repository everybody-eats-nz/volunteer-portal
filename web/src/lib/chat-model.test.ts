import { describe, it, expect } from "vitest";
import {
  DEFAULT_CHAT_MODEL,
  resolveChatModel,
  isValidChatModelId,
} from "./chat-model";

describe("resolveChatModel", () => {
  it("returns the first non-blank source", () => {
    expect(resolveChatModel("openai/gpt-5", "anthropic/claude-sonnet-4")).toBe(
      "openai/gpt-5",
    );
  });

  it("skips null, undefined, empty, and whitespace-only sources", () => {
    expect(
      resolveChatModel(undefined, null, "", "   ", "google/gemini-2.5-flash"),
    ).toBe("google/gemini-2.5-flash");
  });

  it("trims the resolved value", () => {
    expect(resolveChatModel("  openai/gpt-5  ")).toBe("openai/gpt-5");
  });

  it("falls back to the default when every source is blank", () => {
    expect(resolveChatModel(undefined, "", "  ")).toBe(DEFAULT_CHAT_MODEL);
    expect(resolveChatModel()).toBe(DEFAULT_CHAT_MODEL);
  });

  it("respects source order (override wins over setting wins over env)", () => {
    const override = "openai/gpt-5";
    const setting = "anthropic/claude-3.7-sonnet";
    const env = "google/gemini-2.5-flash";
    expect(resolveChatModel(override, setting, env)).toBe(override);
    expect(resolveChatModel(undefined, setting, env)).toBe(setting);
    expect(resolveChatModel("", "", env)).toBe(env);
  });
});

describe("isValidChatModelId", () => {
  it("accepts provider/model slugs, including optional tags", () => {
    expect(isValidChatModelId("anthropic/claude-sonnet-4")).toBe(true);
    expect(isValidChatModelId("openai/gpt-4o-mini")).toBe(true);
    expect(isValidChatModelId("anthropic/claude-3.5-sonnet:beta")).toBe(true);
  });

  it("rejects blank, spaced, or over-long input", () => {
    expect(isValidChatModelId("")).toBe(false);
    expect(isValidChatModelId("not a model")).toBe(false);
    expect(isValidChatModelId("a".repeat(101))).toBe(false);
  });
});
