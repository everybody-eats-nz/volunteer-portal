import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { notificationSSEManager } from "./notification-sse-manager";

const WRITE_TIMEOUT_MS = 10_000;

function fakeWriter(
  overrides: Partial<
    Pick<WritableStreamDefaultWriter<Uint8Array>, "write" | "abort" | "close">
  > = {}
): WritableStreamDefaultWriter<Uint8Array> {
  return {
    write: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as WritableStreamDefaultWriter<Uint8Array>;
}

/** A write that never settles — a client that vanished without a TCP reset. */
function stalledWrite() {
  return vi.fn().mockImplementation(() => new Promise<void>(() => {}));
}

const event = { type: "notification" as const, timestamp: 0 };

describe("NotificationSSEManager write timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await notificationSSEManager.closeAllConnections();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("delivers to a healthy connection", async () => {
    const writer = fakeWriter();
    notificationSSEManager.addConnection("user-1", writer, "ADMIN");

    await expect(
      notificationSSEManager.sendToUser("user-1", event)
    ).resolves.toBe(true);
    expect(writer.write).toHaveBeenCalledTimes(1);
  });

  it("aborts and drops a connection whose write stalls past the timeout", async () => {
    const writer = fakeWriter({ write: stalledWrite() });
    notificationSSEManager.addConnection("user-1", writer, "ADMIN");

    const send = notificationSSEManager.sendToUser("user-1", event);
    await vi.advanceTimersByTimeAsync(WRITE_TIMEOUT_MS);

    await expect(send).resolves.toBe(false);
    expect(writer.abort).toHaveBeenCalledTimes(1);
    expect(notificationSSEManager.getUserConnectionCount("user-1")).toBe(0);
  });

  it("still delivers to a healthy connection queued behind a stalled one", async () => {
    const stalled = fakeWriter({ write: stalledWrite() });
    const healthy = fakeWriter();
    notificationSSEManager.addConnection("user-1", stalled, "ADMIN");
    notificationSSEManager.addConnection("user-1", healthy, "ADMIN");

    const send = notificationSSEManager.sendToUser("user-1", event);
    await vi.advanceTimersByTimeAsync(WRITE_TIMEOUT_MS);

    await expect(send).resolves.toBe(true);
    expect(healthy.write).toHaveBeenCalledTimes(1);
    expect(notificationSSEManager.getUserConnectionCount("user-1")).toBe(1);
  });

  it("completes an admin broadcast even when one admin's connection stalls", async () => {
    const stalled = fakeWriter({ write: stalledWrite() });
    const healthy = fakeWriter();
    notificationSSEManager.addConnection("admin-1", stalled, "ADMIN");
    notificationSSEManager.addConnection("admin-2", healthy, "ADMIN");

    const broadcast = notificationSSEManager.broadcastToAdmins(event);
    await vi.advanceTimersByTimeAsync(WRITE_TIMEOUT_MS);

    await expect(broadcast).resolves.toBe(1);
    expect(healthy.write).toHaveBeenCalledTimes(1);
  });
});
