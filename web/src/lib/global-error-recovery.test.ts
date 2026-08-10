import { describe, it, expect } from "vitest";
import { claimGlobalErrorAutoReload } from "./global-error-recovery";

/** Minimal in-memory stand-in for `sessionStorage`. */
function makeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    size: () => map.size,
  };
}

describe("claimGlobalErrorAutoReload", () => {
  it("grants the first reload of a tab session", () => {
    expect(claimGlobalErrorAutoReload(makeStorage())).toBe(true);
  });

  it("refuses a second reload so a crash on every load cannot loop", () => {
    const storage = makeStorage();
    expect(claimGlobalErrorAutoReload(storage)).toBe(true);
    expect(claimGlobalErrorAutoReload(storage)).toBe(false);
    expect(claimGlobalErrorAutoReload(storage)).toBe(false);
  });

  it("records the claim before reloading, so the marker survives the reload", () => {
    const storage = makeStorage();
    claimGlobalErrorAutoReload(storage);
    expect(storage.size()).toBe(1);
  });

  it("refuses when storage is unavailable (server render, no window)", () => {
    expect(claimGlobalErrorAutoReload(undefined)).toBe(false);
    expect(claimGlobalErrorAutoReload(null)).toBe(false);
  });

  it("refuses when storage throws (private mode, blocked cookies)", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(claimGlobalErrorAutoReload(blocked)).toBe(false);
  });

  it("refuses when storage throws on write (quota exceeded)", () => {
    const readOnly = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(claimGlobalErrorAutoReload(readOnly)).toBe(false);
  });
});
